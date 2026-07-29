// wasm/src/bridge.ts

import {
  uiState, chatLog, engineHeader, workingSurface, braidHistory, activeThreadId,
  currentRole, currentMode, braidThreads, selectedThreadId, sandboxes, manualPrompt, apiLog,
  manifoldLog, lastQuery
} from './state';

import {
  selectedCircuitId, activeCircuit, updateActiveCircuitDoc0, beginLedgerTurn,
  appendConsoleRow, resolveCircuitLineage, systemSettings
} from './ledger/grid-state';

import { vfsDb } from './ledger/fs';
import { LedgerVFS } from './ledger/vfs-wrapper';
import { callBuiltInAPI } from './llm-client';
import init, { create_engine_with_state, dispatchable_kinds } from 'k4_manifold';
import { updateStanceTensionsFromJSON } from './screens/arena-state';
import { primeDispatchableKinds, resolveKind, resolveKindAlias } from './kinds/kinds-registry';
import { createEffect } from './reactive';

let engine: any;
let currentLoadedEngineCircuitId: string | null = null;

function logManifold(type: 'info' | 'warn' | 'error', source: 'system' | 'engine' | 'bridge' | 'parser', msg: string) {
  manifoldLog.value = [
    ...manifoldLog.value,
    { id: crypto.randomUUID(), ts: Date.now(), source, type, message: msg }
  ];
}


export async function bootAirlock() {
  try {
    await init();
    engine = create_engine_with_state("{}");

    try {
      const exported = dispatchable_kinds();
      primeDispatchableKinds(exported);
    } catch (e) {
      console.warn("🟠 [Airlock] Could not fetch dispatchable_kinds from Wasm", e);
    }

    console.log("🟢 [Airlock] Rust K4 Engine coupled successfully.");
    logManifold('info', 'engine', 'Rust K4 Engine coupled successfully.');

    // Hydrate engine VFS state per Circuit switch
    createEffect(() => {
      const cId = selectedCircuitId.value;
      if (cId && cId !== currentLoadedEngineCircuitId) {
        syncEngineStateForCircuit(cId);
      }
    });

  } catch (err) {
    console.warn("🟠 [Airlock] Wasm Engine unavailable. Booting Integrity Stub.", err);
    const stub = await import('./engine-stub');
    engine = stub.create_engine_with_state("{}");
  }
}

async function syncEngineStateForCircuit(circuitId: string) {
  currentLoadedEngineCircuitId = circuitId;
  const savedState = await vfsDb.runTx<{ id: string, raw: string } | undefined>('engine_state', 'readonly', s => s.get(circuitId));
  if (savedState && savedState.raw) {
    engine.load_vfs_state(savedState.raw);
  } else {
    engine.load_vfs_state("{}");
  }
}

async function persistEngineStateForCircuit(circuitId: string) {
  if (engine && circuitId) {
    const rawState = engine.vfs_state;
    await vfsDb.runTx('engine_state', 'readwrite', s => s.put({ id: circuitId, raw: rawState }));
  }
}

export function extractHeader(text: string): { header: string; body: string } {
  const match = text.match(/^(\[STATE[\s\S]*?\][\s\S]*?)\n\n([\s\S]*)$/);
  return match ? { header: match[1], body: match[2] } : { header: '', body: text };
}

export async function processSubmission(
  arg1: string = 'chat',
  warm: boolean = false,
  doc0Override?: string,
  jsonMode: boolean = false
): Promise<void> {
  const cId = selectedCircuitId.peek();
  if (!cId) throw new Error("Cannot submit intent: No Active Circuit selected.");

  let kindKey = 'chat';
  let textToSubmit = doc0Override;

  const kindLookup = resolveKind(arg1);
  if (kindLookup || arg1 === 'chat' || arg1 === 'validator' || arg1 === 'bridge' || arg1 === 'controller' || arg1 === 'paradox') {
    kindKey = arg1;
  } else {
    kindKey = 'chat';
    textToSubmit = arg1;
  }

  if (textToSubmit !== undefined) {
    await updateActiveCircuitDoc0(textToSubmit);
  }

  const manifest = await LedgerVFS.buildResolvedManifest(kindKey, warm);
  if (!manifest) return;

  const kindDef = resolveKind(kindKey);
  const alias = resolveKindAlias(kindKey);

  lastQuery.value = manifest.doc0;
  chatLog.value = [...chatLog.value, { role: 'user', text: manifest.doc0 }];
  uiState.value = 'processing';

  let compiledPrompt = manifest.doc0;
  if (kindDef?.dispatch === 'template' && kindDef?.template) {
    compiledPrompt = kindDef.template
      .replace('{doc0}', manifest.doc0)
      .replace('{documents}', manifest.documents.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n'))
      .replace('{vocabulary}', manifest.vocabulary.map(v => `- ${v.term} [${v.k4Type}]`).join('\n'));
  }

  const outRow = await beginLedgerTurn({
    circuitId: cId,
    kind: kindKey,
    direction: 'out',
    header: `[STATE KIND:${kindKey} ${warm ? 'WARM' : 'COLD'}]`,
    body: compiledPrompt,
    snapshot: manifest.snapshot,
  });

  if (kindDef?.dispatch === 'engine') {
    engine.set_domain_context(manifest.vocabulary.map(v => `${v.term} (${v.k4Type})`).join(', '));
    const command = engine.step_submission(manifest.doc0, JSON.stringify(manifest), kindKey, warm);
    await runEngineLoop(command, outRow?.id, kindKey);
  } else {
    const { apiConfig } = await resolveCircuitLineage(cId);
    
    if (!apiConfig || apiConfig.apiProvider === 'manual') {
      manualPrompt.value = compiledPrompt;
      uiState.value = 'awaiting_llm_paste';
      return;
    }

    try {
      const responseText = await callBuiltInAPI(apiConfig as any, compiledPrompt, jsonMode);      
      const { header, body } = extractHeader(responseText);

      await beginLedgerTurn({
        circuitId: cId,
        kind: kindKey,
        direction: 'in',
        header: header || `[STATE KIND:${kindKey} RESPONSE]`,
        body: body || responseText,
        snapshot: manifest.snapshot,
        parentTurnId: outRow?.id,
      });

      await appendConsoleRow({
        circuitId: cId,
        severity: 'notice',
        category: kindKey,
        message: `Turn completed — response received for [Kind: ${alias}]`,
      });

      chatLog.value = [...chatLog.value, { role: 'system', text: responseText }];
      uiState.value = 'idle';
    } catch (err) {
      logManifold('error', 'bridge', `API Call Failed: ${err}`);
      throw new Error(`API failed: ${err}`);
    }
  }
}

export async function submitLlmPaste(llmResponseText: string): Promise<void> {
  const cId = selectedCircuitId.peek();

  chatLog.value = [...chatLog.value, { role: 'user', text: "(Pasted LLM Output)" }];
  uiState.value = 'processing';
  manualPrompt.value = '';

  const { header, body } = extractHeader(llmResponseText);

  if (cId) {
    const activeC = activeCircuit.peek();
    const { lineage } = await resolveCircuitLineage(cId);
    await beginLedgerTurn({
      circuitId: cId,
      kind: 'chat',
      direction: 'in',
      header: header || '[STATE PASTED_RESPONSE]',
      body: body || llmResponseText,
      snapshot: {
        doc0Snapshot: activeC?.doc0 || '',
        attachedDocIds: [],
        activeLanguageIds: [],
        lineagePath: lineage.map(l => l.id),
        warm: true,
      },
    });
  }

  let command = engine.step(llmResponseText);
  await runEngineLoop(command);
}

export async function processUserReply(replyText: string): Promise<void> {
  chatLog.value = [...chatLog.value, { role: 'user', text: replyText }];
  uiState.value = 'processing';

  const cId = selectedCircuitId.peek();
  if (cId) {
    const activeC = activeCircuit.peek();
    const { lineage } = await resolveCircuitLineage(cId);
    await beginLedgerTurn({
      circuitId: cId,
      kind: 'chat',
      direction: 'out',
      header: '[STATE USER_REPLY]',
      body: replyText,
      snapshot: {
        doc0Snapshot: activeC?.doc0 || '',
        attachedDocIds: [],
        activeLanguageIds: [],
        lineagePath: lineage.map(l => l.id),
        warm: true,
      },
    });
  }

  let command = engine.step(replyText);
  await runEngineLoop(command);
}

async function runEngineLoop(initialCommand: any, parentTurnId?: string, kindKey: string = 'chat') {
  let command = initialCommand;
  const cId = selectedCircuitId.peek();

  try {
    while (command) {
      switch (command.type) {
        case 'FetchLLM': {
          const { apiConfig } = cId ? await resolveCircuitLineage(cId) : { apiConfig: null };
          if (!apiConfig || apiConfig.apiProvider === 'manual') {
            manualPrompt.value = command.prompt;
            uiState.value = 'awaiting_llm_paste';
            return;
          }
          try {
            const llmResponse = await callBuiltInAPI(apiConfig as any, command.prompt, false);

            if (cId) {
              const { header, body } = extractHeader(llmResponse);
              await beginLedgerTurn({
                circuitId: cId,
                kind: kindKey,
                direction: 'in',
                header,
                body,
                snapshot: { doc0Snapshot: '', attachedDocIds: [], activeLanguageIds: [], lineagePath: [], warm: false },
                parentTurnId,
              });
              // Mid-loop checkpoint: persist after each successful LLM turn lands to the ledger.
              // The final persist happens in the outer try/finally regardless of exit path.
              await persistEngineStateForCircuit(cId);
            }

            command = engine.step(llmResponse);
          } catch (err) {
            logManifold('error', 'bridge', `API Call Failed: ${err}`);
            throw new Error(`API failed: ${err}`);
          }
          break;
        }
        case 'AwaitUser': {
          chatLog.value = [...chatLog.value, { role: 'system', text: command.text }];
          uiState.value = 'awaiting_user';
          return;
        }
        case 'Halt':
          uiState.value = 'halted';
          return;
        case 'Success':
          uiState.value = 'idle';
          return;
        default:
          uiState.value = 'halted';
          return;
      }
    }
  } finally {
    // Every exit path — AwaitUser, Halt, Success, default, or an uncaught throw —
    // persists the engine's current state for this circuit.
    if (cId) await persistEngineStateForCircuit(cId);
  }
}

