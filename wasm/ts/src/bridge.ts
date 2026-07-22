// wasm/ui/src/bridge.ts
import {
  uiState, chatLog, engineHeader, workingSurface, braidHistory, activeThreadId,
  currentRole, currentMode, braidThreads, selectedThreadId, sandboxes, manualPrompt,
  Pole, SlotState, EngineHeader, SurfaceSlot, PtrSummary, HeldRole, ThreadAction, ThreadShape
} from './state';
import { activeWorldConfig, getActiveVocabContext, corpusGrid } from './ledger/grid-state';
import { loadVfs, persistVfs } from './persistence';

import type { K4Engine } from 'k4-manifold';
declare function callYourLLMProvider(prompt: string): Promise<string>;

let engine: any;
try {
  const moduleName = 'k4-manifold';
  const wasm = await import(/* @vite-ignore */ moduleName);
  engine = wasm.create_engine_with_state(loadVfs());
  console.log("🟢 [Airlock] Rust K4 Engine coupled successfully.");
} catch (err) {
  console.warn("🟠 [Airlock] Wasm Engine unavailable. Booting Integrity Stub.", err);
  const stub = await import('./engine-stub');
  engine = stub.create_engine_with_state(loadVfs());
}
syncEngineState();

export async function processSubmission(doc0Text: string): Promise<void> {
  chatLog.value = [...chatLog.value, { role: 'user', text: doc0Text }];
  uiState.value = 'processing';

  const levelVocabulary = getActiveVocabContext();
  const enrichedDoc0 = `[CONTEXTUAL DICTIONARY - LEVEL SPECIFIC]\n${levelVocabulary}\n[OPERATOR INTENT]\n${doc0Text}`.trim();

  const docs = corpusGrid.value.map(d => [d.name, d.content]);
  const corpusJson = JSON.stringify(docs);

  let command = engine.step_submission(enrichedDoc0, corpusJson);
  syncEngineState();
  await runEngineLoop(command);
}

export async function submitLlmPaste(llmResponseText: string): Promise<void> {
  chatLog.value = [...chatLog.value, { role: 'user', text: "(Pasted LLM Output)" }];
  uiState.value = 'processing';
  manualPrompt.value = '';
  
  let command = engine.step(llmResponseText);
  syncEngineState();
  await runEngineLoop(command);
}

async function runEngineLoop(initialCommand: any) {
  let command = initialCommand;
  while (command) {
    switch (command.type) {
      case 'FetchLLM': {
        const config = activeWorldConfig.value;
        if (!config || config.apiProvider === 'manual' || !config.apiKey) {
          manualPrompt.value = command.prompt;
          uiState.value = 'awaiting_llm_paste';
          return; 
        }
        try {
          const llmResponse = await callStandardLLM(config, command.prompt);
          command = engine.step(llmResponse);
          syncEngineState();
        } catch (err) {
          chatLog.value = [...chatLog.value, { role: 'error', text: `API failed: ${err}. Falling back to manual.` }];
          manualPrompt.value = command.prompt;
          uiState.value = 'awaiting_llm_paste';
          return;
        }
        break;
      }
      case 'AwaitUser':
        chatLog.value = [...chatLog.value, { role: 'system', text: command.text }];
        uiState.value = 'awaiting_user';
        return;
      case 'Halt':
        chatLog.value = [...chatLog.value, { role: 'error', text: `HALT: ${command.reason}` }];
        uiState.value = 'halted';
        return;
      case 'Success':
        chatLog.value = [...chatLog.value, { role: 'system', text: `Success: ${command.message}` }];
        uiState.value = 'idle';
        return;
      default:
        uiState.value = 'halted';
        return;
    }
  }
}

async function callStandardLLM(config: any, prompt: string): Promise<string> {
  const url = config.apiBaseUrl || "https://api.openai.com/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: prompt }], temperature: 0.2 })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

interface VfsShape {
  braid: { active_thread_id: string | null; threads: Record<string, ThreadShape>; };
  sandboxes: Record<string, Record<string, string>>;
}

function syncEngineState(): void {
  currentRole.value = engine.current_role;
  currentMode.value = engine.current_mode;
  
  const raw = engine.vfs_state;
  persistVfs(raw);
  
  let vfs: VfsShape;
  try { vfs = JSON.parse(raw) as VfsShape; } catch (err) { return; }

  sandboxes.value = vfs.sandboxes || {};
  braidThreads.value = vfs.braid.threads;
  activeThreadId.value = vfs.braid.active_thread_id;
  
  if (!selectedThreadId.value && vfs.braid.active_thread_id) {
    selectedThreadId.value = vfs.braid.active_thread_id;
  }

  braidHistory.value = collectPtrs(vfs);

  const activeId = vfs.braid.active_thread_id;
  const activeThread = activeId ? vfs.braid.threads[activeId] : null;
  const latest = activeThread?.ptr_latest ?? null;
  
  if (latest) {
    engineHeader.value = ptrToHeader(latest);
    workingSurface.value = snapshotToSlots(latest.surface_snapshot);
  } else {
    engineHeader.value = null;
    workingSurface.value = emptySurface();
  }
}

function ptrToHeader(ptr: any): EngineHeader {
  return {
    cycle: ptr.cycle, seq: ptr.final_seq, stance: ptr.stance, plane: ptr.operating_plane,
    path: ptr.path_traversed, heldPole: ptr.held_pole, heldRole: normalizeHeldRole(ptr.held_role), health: ptr.health,
  };
}
function normalizeHeldRole(raw: string): HeldRole { return raw.toLowerCase() === 'material' ? 'material' : 'nil'; }
function snapshotToSlots(snapshot: Record<Pole, { content: string, state: SlotState }>): SurfaceSlot[] {
  return (['P', 'U', 'I', 'R'] as Pole[]).map(pole => ({ pole, content: snapshot[pole]?.content ?? null, state: snapshot[pole]?.state ?? 'Unwritten' }));
}
function emptySurface(): SurfaceSlot[] {
  return (['P', 'U', 'I', 'R'] as Pole[]).map(pole => ({ pole, content: null, state: 'Unwritten' as SlotState }));
}
function collectPtrs(vfs: VfsShape): PtrSummary[] {
  const out: PtrSummary[] = [];
  for (const thread of Object.values(vfs.braid.threads)) {
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
