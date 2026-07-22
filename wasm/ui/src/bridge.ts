// wasm/ui/src/bridge.ts

// ─── L6 INVERSION OF CONTROL (IoC) PATTERN ─────────────────────
// The Wasm Engine (Rust) acts as the OS Kernel and Ledger (R/P). 
// It does not call the LLM directly. It yields its Angular Frequency (ω) 
// to the TypeScript host environment (the Event Loop / Relational Flow, I).
// ───────────────────────────────────────────────────────────────

import {
  uiState, chatLog, corpusDocs,
  engineHeader, workingSurface, braidHistory, activeThreadId,
  currentRole, currentMode,
  Pole, SlotState, EngineHeader, SurfaceSlot, PtrSummary, HeldRole, ThreadAction, CorpusDocument
} from './state';
import { activeWorldConfig, getActiveVocabContext } from './ledger/grid-state';
import { loadVfs, persistVfs } from './persistence';

// Type-only import: Safely stripped at compile time. Won't crash if Wasm is unbuilt.
import type { K4Engine } from 'k4-manifold'; 

declare function callYourLLMProvider(prompt: string): Promise<string>;

// ─── THE AIRLOCK (Dynamic Wasm Fallback) ───────────────────────
let engine: any; 

try {
  // Attempt to dynamically load the compiled WebAssembly module
  // (We hide the string in a variable so strict bundlers don't hard-fail the build if the folder is empty)
  const moduleName = 'k4-manifold';
  const wasm = await import(/* @vite-ignore */ moduleName);
  engine = wasm.create_engine_with_state(loadVfs());
  console.log("🟢 [Airlock] Rust K4 Engine coupled successfully.");
} catch (err) {
  // If Wasm is uncompiled, missing, or fails to instantiate, boot the Stub
  console.warn("🟠 [Airlock] Wasm Engine unavailable. Booting Integrity Stub.", err);
  const stub = await import('./engine-stub');
  engine = stub.create_engine_with_state(loadVfs());
}

// Sync the initial state to the UI regardless of which engine booted
syncEngineState();
// ───────────────────────────────────────────────────────────────

// ─── Entry Point 1: Text Submission ────────────────────────────
export async function processSubmission(doc0Text: string, docs: CorpusDocument[]): Promise<void> {
  chatLog.value = [...chatLog.value, { role: 'user', text: doc0Text }];
  uiState.value = 'processing';

  // Fetch the Nouns (The Client's Vocabulary for this specific Level)
  const levelVocabulary = getActiveVocabContext();

  // Weave the Nouns into the Prompt
  // We are formally telling the LLM: "Here are the variables mapped to the K4 poles."
  const enrichedDoc0 = `
[CONTEXTUAL DICTIONARY - LEVEL SPECIFIC]
${levelVocabulary}

[OPERATOR INTENT]
${doc0Text}
  `.trim();

  const corpusJson = JSON.stringify(docs.map(d => [d.name, d.content]));
  
  // Hand the enriched package to the Rust Kernel (The Verbs)
  let command = engine.step_submission(enrichedDoc0, corpusJson);
  syncEngineState();
  
  await runEngineLoop(command);
}

// ─── Entry Point 2: Manual LLM Paste ───────────────────────────
export async function submitLlmPaste(llmResponseText: string): Promise<void> {
  chatLog.value = [...chatLog.value, { role: 'user', text: "(Pasted LLM Output)" }];
  uiState.value = 'processing';

  let command = engine.step(llmResponseText);
  syncEngineState();
  
  await runEngineLoop(command);
}

// ─── The Core State Machine Loop ───────────────────────────────
async function runEngineLoop(initialCommand: any) {
  let command = initialCommand;

  while (command) {
    switch (command.type) {
      
      case 'FetchLLM': {
        const config = activeWorldConfig.value;
        
        // MANUAL MODE FALLBACK (The Airlock)
        if (!config || config.apiProvider === 'manual' || !config.apiKey) {
          chatLog.value = [...chatLog.value, { 
            role: 'prompt_to_copy', 
            text: command.prompt 
          }];
          uiState.value = 'awaiting_llm_paste';
          return; // Pause the engine loop. Wait for user paste.
        }

        // AUTOMATIC API MODE
        try {
          const llmResponse = await callStandardLLM(config, command.prompt);
          command = engine.step(llmResponse);
          syncEngineState();
        } catch (err) {
          chatLog.value = [...chatLog.value, {
            role: 'error',
            text: `API failed: ${err instanceof Error ? err.message : String(err)}. Falling back to manual mode.`
          }];
          chatLog.value = [...chatLog.value, { role: 'prompt_to_copy', text: command.prompt }];
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
        chatLog.value = [...chatLog.value, { role: 'error', text: `Unknown command: ${JSON.stringify(command)}` }];
        uiState.value = 'halted';
        return;
    }
  }
}

// ─── Basic OpenAI Compatible Fetch Wrapper ─────────────────────
async function callStandardLLM(config: any, prompt: string): Promise<string> {
  const url = config.apiBaseUrl || "https://api.openai.com/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o", // Or user-configurable
      messages: [{ role: "system", content: prompt }],
      temperature: 0.2 // Low temp for rigid structural adherence
    })
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Engine → Signals Sync ─────────────────────────────────────

interface VfsShape {
  braid: {
    active_thread_id: string | null;
    threads: Record<string, ThreadShape>;
  };
}
interface ThreadShape {
  status: string;
  ptr_latest: PtrShape | null;
  history: PtrShape[];
}
interface PtrShape {
  thread_id: string;
  thread_action: ThreadAction;
  cycle: number;
  final_seq: number;
  stance: string;
  home_variable: Pole;
  operating_plane: Pole;
  path_traversed: Pole[];
  held_pole: Pole;
  held_role: string;   
  surface_snapshot: Record<Pole, { content: string, state: SlotState }>;
  health: string;
}

function syncEngineState(): void {
  currentRole.value = engine.current_role;
  currentMode.value = engine.current_mode;

  const raw = engine.vfs_state;
  persistVfs(raw);

  let vfs: VfsShape;
  try {
    vfs = JSON.parse(raw) as VfsShape;
  } catch (err) {
    console.warn('[bridge] failed to parse vfs_state:', err);
    return;
  }

  activeThreadId.value = vfs.braid.active_thread_id;
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

function ptrToHeader(ptr: PtrShape): EngineHeader {
  return {
    cycle: ptr.cycle,
    seq: ptr.final_seq,
    stance: ptr.stance,
    plane: ptr.operating_plane,
    path: ptr.path_traversed,
    heldPole: ptr.held_pole,
    heldRole: normalizeHeldRole(ptr.held_role),
    health: ptr.health,
  };
}

function normalizeHeldRole(raw: string): HeldRole {
  return raw.toLowerCase() === 'material' ? 'material' : 'nil';
}

function snapshotToSlots(snapshot: Record<Pole, { content: string, state: SlotState }>): SurfaceSlot[] {
  const poles: Pole[] = ['P', 'U', 'I', 'R'];
  return poles.map(pole => {
    const slotData = snapshot[pole];
    return { 
        pole, 
        content: slotData?.content ?? null, 
        state: slotData?.state ?? 'Unwritten' 
    };
  });
}

function emptySurface(): SurfaceSlot[] {
  const poles: Pole[] = ['P', 'U', 'I', 'R'];
  return poles.map(pole => ({ pole, content: null, state: 'Unwritten' as SlotState }));
}

function collectPtrs(vfs: VfsShape): PtrSummary[] {
  const out: PtrSummary[] = [];
  for (const thread of Object.values(vfs.braid.threads)) {
    for (const ptr of thread.history) {
      out.push({
        threadId: ptr.thread_id,
        action: ptr.thread_action,
        cycle: ptr.cycle,
        finalSeq: ptr.final_seq,
        stance: ptr.stance,
        plane: ptr.operating_plane,
        path: ptr.path_traversed,
        heldPole: ptr.held_pole,
        heldRole: normalizeHeldRole(ptr.held_role),
        health: ptr.health,
        surfaceSnapshot: ptr.surface_snapshot,
      });
    }
  }
  return out.sort((a, b) => a.cycle - b.cycle || a.finalSeq - b.finalSeq);
}
