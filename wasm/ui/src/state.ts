// src/state.ts
import { Signal } from './reactive';

// ─── Existing UI state ───────────────────────────────────────────

export type UIState = 'idle' | 'processing' | 'awaiting_user' | 'halted';

export interface ChatMessage {
  role: 'user' | 'system' | 'error';
  text: string;
}

export const uiState = new Signal<UIState>('idle');
export const chatLog = new Signal<ChatMessage[]>([]);
export const currentPrompt = new Signal<string>('');

// ─── Engine-derived state (read out of vfs_state after every step) ─

export type Pole = 'P' | 'U' | 'I' | 'R';
export type SlotState = 'Unwritten' | 'Prior' | 'Current' | 'Stale';
export type HeldRole = 'nil' | 'material';
export type ThreadAction = 'Continue' | 'Sever';

export interface EngineHeader {
  cycle: number;
  seq: number;
  stance: string;      // equation name, e.g. "Synthesis (P = U × I)"
  plane: Pole;
  path: Pole[];
  heldPole: Pole;
  heldRole: HeldRole;
  health: string;      // "clear" | "raises: k" | "HALTED: reason"
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
  surfaceSnapshot: Partial<Record<Pole, string>>;
}

export const engineHeader = new Signal<EngineHeader | null>(null);

export const workingSurface = new Signal<SurfaceSlot[]>(
  (['P', 'U', 'I', 'R'] as Pole[]).map(pole => ({ pole, content: null, state: 'Unwritten' as SlotState }))
);

export const braidHistory = new Signal<PtrSummary[]>([]);
export const activeThreadId = new Signal<string | null>(null);

// ─── Which K4 instrument is in the loop (exposed by the engine) ────

export type CurrentRole = 'Validator' | 'Bridge' | 'Controller' | 'Paradox';
export type CurrentMode = 'cold' | 'expect_llm' | 'expect_user';

/// The instrument the engine is currently in dialogue with. Not the same as
/// `uiState`: uiState tracks the UI's own view (idle/processing/etc), while
/// this tracks which of the four K4 stations owns the current turn.
export const currentRole = new Signal<CurrentRole>('Validator');
export const currentMode = new Signal<CurrentMode>('cold');
