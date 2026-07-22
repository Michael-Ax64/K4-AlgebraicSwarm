// wasm/ui/src/bridge.ts
//
// ─── L6 INVERSION OF CONTROL (IoC) PATTERN ─────────────────────
// The Wasm Engine (Rust) acts as the OS Kernel and Ledger (R/P). 
// It does not call the LLM directly. It yields its Angular Frequency (ω) 
// to the TypeScript host environment (the Event Loop / Relational Flow, I).
// The Engine registers a `FetchLLM` command and waits. The TS host executes
// the LLM API call (the uncollapsed potential Q) and invokes the engine's step.
// This is the literal architectural translation of "Don't call us, we'll call you."
// ───────────────────────────────────────────────────────────────

import {
  uiState, chatLog, corpusDocs,
  engineHeader, workingSurface, braidHistory, activeThreadId,
  currentRole, currentMode,
  Pole, SlotState, EngineHeader, SurfaceSlot, PtrSummary, HeldRole, ThreadAction, CorpusDocument
} from './state';
import { create_engine_with_state, K4Engine } from 'k4-manifold';
import { loadVfs, persistVfs } from './persistence';

declare function callYourLLMProvider(prompt: string): Promise<string>;

const engine: K4Engine = create_engine_with_state(loadVfs());
syncEngineState();

// Renamed from processInput to support D0 + D1..N
export async function processSubmission(doc0Text: string, docs: CorpusDocument[]): Promise<void> {
  chatLog.value = [...chatLog.value, { role: 'user', text: doc0Text }];
  uiState.value = 'processing';

  // Pack the corpus as JSON to cross the Wasm boundary
  const corpusJson = JSON.stringify(docs.map(d => [d.name, d.content]));
  
  // Call the new step_submission signature
  let command = engine.step_submission(doc0Text, corpusJson);
  syncEngineState();

  while (command) {
    switch (command.type) {
      case 'FetchLLM': {
        let llmResponse: string;
        try {
          llmResponse = await callYourLLMProvider(command.prompt);
        } catch (err) {
          chatLog.value = [...chatLog.value, {
            role: 'error',
            text: `LLM fetch failed: ${err instanceof Error ? err.message : String(err)}. Engine state preserved; try again.`,
          }];
          uiState.value = 'idle';
          return;
        }
        command = engine.step(llmResponse);
        syncEngineState();
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
        chatLog.value = [...chatLog.value, {
          role: 'error',
          text: `Unknown command type: ${JSON.stringify(command)}`,
        }];
        uiState.value = 'halted';
        return;
    }
  }
}

// ─── Engine → signals sync ─────────────────────────────────────

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
