// src/bridge.ts
//
// The airlock between the reactive UI and the deterministic Wasm engine.
//
// Two changes over the original bridge:
//   1. Uses `create_engine_with_state` to restore any previously-persisted VFS.
//   2. After every engine transition, syncs the derived signals (header,
//      working surface, braid history) from `engine.vfs_state` and persists.
//
// The AwaitUser → user-reply → HALT problem is not fixable at this layer
// alone — it needs a small Rust patch. See README, "Open items."

import {
  uiState, chatLog,
  engineHeader, workingSurface, braidHistory, activeThreadId,
  currentRole, currentMode,
  Pole, SlotState, EngineHeader, SurfaceSlot, PtrSummary, HeldRole, ThreadAction,
} from './state';
import { create_engine_with_state, K4Engine } from 'k4-manifold';
import { loadVfs, persistVfs } from './persistence';

// LLM provider — supply your own. Signature is (prompt: string) => Promise<string>.
declare function callYourLLMProvider(prompt: string): Promise<string>;

const engine: K4Engine = create_engine_with_state(loadVfs());
syncEngineState();

export async function processInput(userText: string): Promise<void> {
  chatLog.value = [...chatLog.value, { role: 'user', text: userText }];
  uiState.value = 'processing';

  let command = engine.step(userText);
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
  held_role: string;   // "nil" | "material"
  surface_snapshot: Partial<Record<Pole, string>>;
  health: string;
}

function syncEngineState(): void {
  // Role and mode come off the engine directly — always current, no JSON round-trip.
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

function snapshotToSlots(snapshot: Partial<Record<Pole, string>>): SurfaceSlot[] {
  const poles: Pole[] = ['P', 'U', 'I', 'R'];
  return poles.map(pole => {
    const content = snapshot[pole] ?? null;
    const state: SlotState = content !== null ? 'Current' : 'Unwritten';
    return { pole, content, state };
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
