// wasm/src/bridge.ts

import {
  uiState, chatLog, engineHeader, workingSurface, braidHistory, activeThreadId,
  currentRole, currentMode, braidThreads, selectedThreadId, sandboxes, manualPrompt, apiLog,
  manifoldLog, lastQuery, Pole, SlotState, EngineHeader, SurfaceSlot, PtrSummary, HeldRole, ThreadShape
} from './state';
import {
  activeWorldConfig, selectedViewId, activeView, ledgerGrid,
  updateActiveViewDoc0, beginLedgerTurn, appendConsoleRow
} from './ledger/grid-state';
import { vfsDb } from './ledger/fs';
import { LedgerRow } from './ledger/schema';
import { LedgerVFS } from './ledger/vfs-wrapper';
import { loadVfs, persistVfs } from './persistence';
import { callBuiltInAPI } from './llm-client';
import init, { create_engine_with_state, dispatchable_kinds } from 'k4_manifold';
import { updateStanceTensionsFromJSON } from './screens/arena-state';
import { primeDispatchableKinds, resolveKind, resolveKindAlias } from './kinds/kinds-registry';

let engine: any;

function logManifold(type: 'info' | 'warn' | 'error', source: 'system' | 'engine' | 'bridge' | 'parser', msg: string) {
  manifoldLog.value = [
    ...manifoldLog.value,
    { id: crypto.randomUUID(), ts: Date.now(), source, type, message: msg }
  ];
}

export async function bootAirlock() {
  try {
    await init();
    const savedVfs = await loadVfs();
    engine = create_engine_with_state(savedVfs);

    try {
      const exported = dispatchable_kinds();
      primeDispatchableKinds(exported);
    } catch (e) {
      console.warn("🟠 [Airlock] Could not fetch dispatchable_kinds from Wasm", e);
    }

    console.log("🟢 [Airlock] Rust K4 Engine coupled successfully.");
    logManifold('info', 'engine', 'Rust K4 Engine coupled successfully.');
    syncEngineState();
  } catch (err) {
    console.warn("🟠 [Airlock] Wasm Engine unavailable. Booting Integrity Stub.", err);
    logManifold('warn', 'system', `Wasm unavailable. Booting Integrity Stub. Error: ${err}`);
    const stub = await import('./engine-stub');
    engine = stub.create_engine_with_state(await loadVfs());
    syncEngineState();
  }
}

export function extractHeader(text: string): { header: string; body: string } {
  const match = text.match(/^(\[STATE[\s\S]*?\][\s\S]*?)\n\n([\s\S]*)$/);
  return match ? { header: match[1], body: match[2] } : { header: '', body: text };
}

export async function processSubmission(
  arg1: string = 'chat',
  warm: boolean = false,
  doc0Override?: string
): Promise<void> {
  const vId = selectedViewId.peek();
  if (!vId) {
    throw new Error("Cannot submit intent: No Active View selected.");
  }

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
    if (textToSubmit.includes("[STATE]")) {
      await submitLlmPaste(textToSubmit);
      return;
    }
    await updateActiveViewDoc0(textToSubmit);
  }

  const manifest = await LedgerVFS.buildResolvedManifest(kindKey, warm);
  if (!manifest) return;

  const kindDef = resolveKind(kindKey);
  const alias = resolveKindAlias(kindKey);

  lastQuery.value = manifest.doc0;
  chatLog.value = [...chatLog.value, { role: 'user', text: manifest.doc0 }];
  uiState.value = 'processing';

  // Compile full prompt payload
  let compiledPrompt = manifest.doc0;
  if (kindDef?.dispatch === 'template' && kindDef?.template) {
    compiledPrompt = kindDef.template
      .replace('{doc0}', manifest.doc0)
      .replace('{documents}', manifest.documents.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n'))
      .replace('{vocabulary}', manifest.vocabulary.map(v => `- ${v.term} [${v.k4Type}]`).join('\n'));
  }

  // 1. Begin Ledger 'out' row capturing FULL compiled prompt payload
  const outRow = await beginLedgerTurn({
    viewId: vId,
    kind: kindKey,
    direction: 'out',
    header: `[STATE KIND:${kindKey} ${warm ? 'WARM' : 'COLD'}]`,
    body: compiledPrompt, // <--- Full compiled prompt
    snapshot: manifest.snapshot,
  });

  if (kindDef?.dispatch === 'engine') {
    engine.set_domain_context(manifest.vocabulary.map(v => `${v.term} (${v.k4Type})`).join(', '));
    const command = engine.step_submission(manifest.doc0, JSON.stringify(manifest), kindKey, warm);
    syncEngineState();
    await runEngineLoop(command, outRow?.id, kindKey);
  } else {
    const config = activeWorldConfig.value;
    
    // Check Manual Mode vs Automated API Call for template kinds
    if (!config || config.apiProvider === 'manual') {
      manualPrompt.value = compiledPrompt;
      uiState.value = 'awaiting_llm_paste';
      return;
    }

    try {
      const responseText = await callBuiltInAPI(config, compiledPrompt, false);
      const { header, body } = extractHeader(responseText);

      await beginLedgerTurn({
        viewId: vId,
        kind: kindKey,
        direction: 'in',
        header: header || `[STATE KIND:${kindKey} RESPONSE]`,
        body: body || responseText,
        snapshot: manifest.snapshot,
        parentTurnId: outRow?.id,
      });

      await appendConsoleRow({
        viewId: vId,
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

function sanitizeLlmOutput(rawText: string): string {
  let cleaned = rawText.replace(/#\s*COLD\s*START\s*MAP\s*json?/gi, '# HELD PARADOXES\n```json');
  cleaned = cleaned.replace(/#\s*COLD\s*START\s*MAP/gi, '# HELD PARADOXES');
  return cleaned;
}

export async function submitLlmPaste(llmResponseText: string): Promise<void> {
  const sanitized = sanitizeLlmOutput(llmResponseText);
  const vId = selectedViewId.peek();

  if (sanitized.includes('"stances"')) {
    updateStanceTensionsFromJSON(sanitized);
  }

  chatLog.value = [...chatLog.value, { role: 'user', text: "(Pasted LLM Output)" }];
  uiState.value = 'processing';
  manualPrompt.value = '';

  const { header, body } = extractHeader(sanitized);

  if (vId) {
    const activeV = activeView.peek();
    await beginLedgerTurn({
      viewId: vId,
      kind: 'chat',
      direction: 'in',
      header: header || '[STATE PASTED_RESPONSE]',
      body: body || sanitized,
      snapshot: {
        doc0Snapshot: activeV?.doc0 || '',
        attachedDocIds: [],
        activeLanguageIds: [],
        warm: true,
      },
    });

    await appendConsoleRow({
      viewId: vId,
      severity: 'notice',
      category: 'chat',
      message: 'Row complete — response received via paste',
    });
  }

  let command = engine.step(sanitized);
  syncEngineState();
  await runEngineLoop(command);
}

export async function processUserReply(replyText: string): Promise<void> {
  chatLog.value = [...chatLog.value, { role: 'user', text: replyText }];
  uiState.value = 'processing';

  const vId = selectedViewId.peek();
  if (vId) {
    const activeV = activeView.peek();
    await beginLedgerTurn({
      viewId: vId,
      kind: 'chat',
      direction: 'out',
      header: '[STATE USER_REPLY]',
      body: replyText,
      snapshot: {
        doc0Snapshot: activeV?.doc0 || '',
        attachedDocIds: [],
        activeLanguageIds: [],
        warm: true,
      },
    });
  }

  let command = engine.step(replyText);
  syncEngineState();
  await runEngineLoop(command);
}

export function resetEngineRun(): void {
  engine.reset_run();
  syncEngineState();
}

export function resetEngineAll(): void {
  engine.reset_all();
  syncEngineState();
}

async function runEngineLoop(initialCommand: any, parentTurnId?: string, kindKey: string = 'chat') {
  let command = initialCommand;
  const vId = selectedViewId.peek();

  while (command) {
    switch (command.type) {
      case 'FetchLLM': {
        const config = activeWorldConfig.value;
        if (!config || config.apiProvider === 'manual') {
          manualPrompt.value = command.prompt;
          uiState.value = 'awaiting_llm_paste';
          return;
        }
        try {
          const outId = crypto.randomUUID();
          apiLog.value = [...apiLog.value, {
            id: outId, ts: Date.now(), direction: 'out', role: currentRole.value.toLowerCase() as any,
            temperature: currentMode.value === 'cold' ? 'cold' : 'warm', bodyText: command.prompt
          }];

          const llmResponse = await callBuiltInAPI(config, command.prompt, false);

          apiLog.value = [...apiLog.value, {
            id: crypto.randomUUID(), ts: Date.now(), direction: 'in', role: currentRole.value.toLowerCase() as any,
            temperature: currentMode.value === 'cold' ? 'cold' : 'warm', bodyText: llmResponse, linkedExchangeId: outId
          }];

          if (vId) {
            const { header, body } = extractHeader(llmResponse);
            await beginLedgerTurn({
              viewId: vId,
              kind: kindKey,
              direction: 'in',
              header,
              body,
              snapshot: { doc0Snapshot: '', attachedDocIds: [], activeLanguageIds: [], warm: false },
              parentTurnId,
            });

            await appendConsoleRow({
              viewId: vId,
              severity: 'notice',
              category: kindKey,
              message: `Turn completed — response received for [Kind: ${kindKey}]`,
            });
          }

          command = engine.step(llmResponse);
          syncEngineState();
        } catch (err) {
          logManifold('error', 'bridge', `API Call Failed: ${err}`);
          throw new Error(`API failed: ${err}`);
        }
        break;
      }
      case 'AwaitUser': {
        chatLog.value = [...chatLog.value, { role: 'system', text: command.text }];
        if (command.text.includes('"stances"')) {
          updateStanceTensionsFromJSON(command.text);
        }
        uiState.value = 'awaiting_user';
        return;
      }
      case 'Halt':
        logManifold('warn', 'engine', `HALT: ${command.reason}`);
        chatLog.value = [...chatLog.value, { role: 'error', text: `HALT: ${command.reason}` }];
        uiState.value = 'halted';
        return;
      case 'Success':
        logManifold('info', 'engine', `Success: ${command.message}`);
        chatLog.value = [...chatLog.value, { role: 'system', text: `Success: ${command.message}` }];
        uiState.value = 'idle';
        return;
      default: {
        const diag = `[BRIDGE] Unknown JsCommand shape: ${JSON.stringify(command)}`;
        console.error(diag);
        logManifold('error', 'bridge', diag);
        chatLog.value = [...chatLog.value, { role: 'error', text: diag }];
        uiState.value = 'halted';
        return;
      }
    }
  }
}

interface VfsShape {
  braid?: { active_thread_id: string | null; threads: Record<string, ThreadShape>; };
  sandboxes?: Record<string, Record<string, string>>;
}

function syncEngineState(): void {
  currentRole.value = engine.current_role;
  currentMode.value = engine.current_mode;

  const raw = engine.vfs_state;
  persistVfs(raw);

  let vfs: VfsShape;
  try { vfs = JSON.parse(raw) as VfsShape; } catch (err) { return; }

  const safeBraid = vfs.braid || { active_thread_id: null, threads: {} };
  const safeThreads = safeBraid.threads || {};

  sandboxes.value = vfs.sandboxes || {};
  braidThreads.value = safeThreads;
  activeThreadId.value = safeBraid.active_thread_id || null;

  if (!selectedThreadId.value && safeBraid.active_thread_id) {
    selectedThreadId.value = safeBraid.active_thread_id;
  }

  const ptrs = collectPtrs(vfs);
  braidHistory.value = ptrs;

  const activeId = safeBraid.active_thread_id;
  const activeThread = activeId ? (safeThreads[activeId] || null) : null;
  const latest = activeThread?.ptr_latest ?? null;

  if (latest) {
    engineHeader.value = ptrToHeader(latest);
    workingSurface.value = snapshotToSlots(latest.surface_snapshot || {});
  } else {
    engineHeader.value = null;
    workingSurface.value = emptySurface();
  }

  const vId = selectedViewId.peek();
  if (vId && ptrs.length > 0) {
    syncLedgerRowsAsync(vId, ptrs).catch(err => {
      console.error("[ETL] Failed to sync PTRs to LedgerRow store", err);
    });
  }
}

async function syncLedgerRowsAsync(viewId: string, ptrs: PtrSummary[]) {
  const existing = await vfsDb.getLedgerRows(viewId);
  const existingKeys = new Set(existing.map(e => `${e.ptrCycle}-${e.ptrSeq}`));

  let added = false;
  for (const ptr of ptrs) {
    const key = `${ptr.cycle}-${ptr.finalSeq}`;
    if (!existingKeys.has(key)) {
      const row: LedgerRow = {
        id: `led-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        viewId,
        turnNumber: ptr.cycle,
        seq: ptr.finalSeq,
        kind: 'controller',
        direction: 'in',
        header: `[STATE] CYCLE: ${ptr.cycle} | SEQ: ${ptr.finalSeq} | STANCE: ${ptr.stance}`,
        body: JSON.stringify(ptr),
        kept: true,
        doc0Snapshot: '',
        attachedDocIds: [],
        activeLanguageIds: [],
        warm: false,
        ptrCycle: ptr.cycle,
        ptrSeq: ptr.finalSeq,
        ptrStance: ptr.stance,
        ptrHealth: ptr.health,
        ptrSnapshotJson: JSON.stringify(ptr.surfaceSnapshot),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await vfsDb.upsertLedgerRow(row);
      added = true;
    }
  }

  if (added) {
    ledgerGrid.value = await vfsDb.getLedgerRows(viewId);
  }
}

function ptrToHeader(ptr: any): EngineHeader {
  return {
    cycle: ptr.cycle, seq: ptr.final_seq, stance: ptr.stance, plane: ptr.operating_plane,
    path: ptr.path_traversed, heldPole: ptr.held_pole, heldRole: normalizeHeldRole(ptr.held_role), health: ptr.health,
  };
}

function normalizeHeldRole(raw: string): HeldRole {
  return raw?.toLowerCase() === 'material' ? 'material' : 'nil';
}

function snapshotToSlots(snapshot: Record<Pole, { content: string, state: SlotState }>): SurfaceSlot[] {
  return (['P', 'U', 'I', 'R'] as Pole[]).map(pole => ({
    pole,
    content: snapshot[pole]?.content ?? null,
    state: snapshot[pole]?.state ?? 'Unwritten'
  }));
}

function emptySurface(): SurfaceSlot[] {
  return (['P', 'U', 'I', 'R'] as Pole[]).map(pole => ({
    pole,
    content: null,
    state: 'Unwritten' as SlotState
  }));
}

function collectPtrs(vfs: VfsShape): PtrSummary[] {
  const out: PtrSummary[] = [];
  const safeBraid = vfs.braid || { threads: {} };
  const threads = safeBraid.threads || {};
  for (const thread of Object.values(threads)) {
    if (!thread || !thread.history) continue;
    for (const ptr of thread.history) {
      out.push({
        threadId: ptr.thread_id, action: ptr.thread_action, cycle: ptr.cycle, finalSeq: ptr.final_seq,
        stance: ptr.stance, plane: ptr.operating_plane, path: ptr.path_traversed, heldPole: ptr.held_pole,
        heldRole: normalizeHeldRole(ptr.held_role), health: ptr.health, surfaceSnapshot: ptr.surface_snapshot,
      });
    }
  }
  return out.sort((a, b) => a.cycle - b.cycle || a.finalSeq - b.finalSeq);
}

