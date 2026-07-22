// wasm/ui/src/state.ts
import { Signal } from './reactive';

export type UIState = 'idle' | 'processing' | 'awaiting_user' | 'awaiting_llm_paste' | 'halted';
export interface ChatMessage {
  role: 'user' | 'system' | 'error' | 'prompt_to_copy';
  text: string;
}

// Support for Validator Merged Submission (D0 + D1..N)
export const uiState = new Signal<UIState>('idle');
export const chatLog = new Signal<ChatMessage[]>([]);
export const currentPrompt = new Signal<string>('');

// --- The Corpus Registry ---
export interface CorpusDocument {
  name: string;
  content: string;
}

export interface CorpusDocEntry {
  id: string;
  name: string;
  content: string;
}
export const corpusRegistry = new Signal<CorpusDocEntry[]>([]);

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
  surfaceSnapshot: Record<Pole, { content: string, state: SlotState }>;
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

export const sandboxes = new Signal<Record<string, Record<string, string>>>({});
export const manualPrompt = new Signal<string>('');
export const activeRaise = new Signal<{ target: string, reason: string } | null>(null);

export type CurrentRole = 'Validator' | 'Bridge' | 'Controller' | 'Paradox';
export type CurrentMode = 'cold' | 'expect_llm' | 'expect_user';
export const currentRole = new Signal<CurrentRole>('Validator');
export const currentMode = new Signal<CurrentMode>('cold');
