// wasm/ui/src/state.ts
//
// Global reactive state for the K4 UI shell (chat log, working surface,
// braid history, thread selector, role/mode indicators).
//
// The corpus registry (Document 1..N attached to the Validator's Markov
// Blanket) does NOT live here — it lives in `./ledger/grid-state.ts` next
// to the World/Level selection it belongs to. Anything that needs corpus
// docs should import `corpusGrid` from grid-state, not from this module.

import { Signal } from './reactive';

export type UIState = 'idle' | 'processing' | 'awaiting_user' | 'awaiting_llm_paste' | 'halted';

export interface ChatMessage {
  role: 'user' | 'system' | 'error' | 'prompt_to_copy';
  text: string;
}

// --- Chat / operator input surface ---
export const uiState = new Signal<UIState>('idle');
export const chatLog = new Signal<ChatMessage[]>([]);

// Reserved for a future feature that surfaces the current in-flight prompt
// to the operator. Kept exported so downstream code can begin wiring
// against a stable name.
export const currentPrompt = new Signal<string>('');

// --- Working surface & braid state (mirrored from Rust vfs_state) ---
export type Pole = 'P' | 'U' | 'I' | 'R';
export type SlotState = 'Unwritten' | 'Prior' | 'Current' | 'Stale';
export type HeldRole = 'nil' | 'material';
export type ThreadAction = 'Continue' | 'Sever';

export interface EngineHeader {
  cycle: number;
  seq: number;
  stance: string;
  plane: Pole;
  path: Pole[];
  heldPole: Pole;
  heldRole: HeldRole;
  health: string;
}

export interface SurfaceSlot {
  pole: Pole;
  content: string | null;
  state: SlotState;
}

export interface PtrSummary {
  threadId: string;
  action: ThreadAction;
  cycle: number;
  finalSeq: number;
  stance: string;
  plane: Pole;
  path: Pole[];
  heldPole: Pole;
  heldRole: HeldRole;
  health: string;
  surfaceSnapshot: Record<Pole, { content: string; state: SlotState }>;
}

export const engineHeader = new Signal<EngineHeader | null>(null);
export const workingSurface = new Signal<SurfaceSlot[]>(
  (['P', 'U', 'I', 'R'] as Pole[]).map(pole => ({ pole, content: null, state: 'Unwritten' as SlotState }))
);
export const braidHistory = new Signal<PtrSummary[]>([]);
export const activeThreadId = new Signal<string | null>(null);

// --- Braid Thread Selector ---
export interface ThreadShape {
  status: string;
  ptr_latest: any | null;
  history: any[];
}
export const braidThreads = new Signal<Record<string, ThreadShape>>({});
export const selectedThreadId = new Signal<string | null>(null);

// --- Sandbox inspector & manual-mode prompt buffer ---
export const sandboxes = new Signal<Record<string, Record<string, string>>>({});
export const manualPrompt = new Signal<string>('');

// Reserved: raise/interrupt surface for future in-cycle operator overrides.
export const activeRaise = new Signal<{ target: string; reason: string } | null>(null);

// --- Role / mode indicators (mirrored from engine.current_role / current_mode) ---
export type CurrentRole = 'Validator' | 'Bridge' | 'Controller' | 'Paradox';
export type CurrentMode = 'cold' | 'expect_llm' | 'expect_user';
export const currentRole = new Signal<CurrentRole>('Validator');
export const currentMode = new Signal<CurrentMode>('cold');

// --- Persistence heartbeat ---
// Updated by persistence.ts every time the engine VFS snapshot is written
// or cleared. The Database management tab reads this to auto-refresh its
// stats after every engine step, without polling.
export const enginePersistedAt = new Signal<number>(0);
