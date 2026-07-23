// wasm/src/state.ts

import { Signal } from './reactive';

export type UIState = 'idle' | 'processing' | 'awaiting_user' | 'awaiting_llm_paste' | 'halted';

export interface ChatMessage {
  role: 'user' | 'system' | 'error' | 'prompt_to_copy';
  text: string;
}

export const uiState = new Signal<UIState>('idle');
export const chatLog = new Signal<ChatMessage[]>([]);
export const currentPrompt = new Signal<string>('');

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

export interface ThreadShape {
  status: string;
  ptr_latest: any | null;
  history: any[];
}
export const braidThreads = new Signal<Record<string, ThreadShape>>({});
export const selectedThreadId = new Signal<string | null>(null);

export const sandboxes = new Signal<Record<string, Record<string, string>>>({});
export const manualPrompt = new Signal<string>('');

export const activeRaise = new Signal<{ target: string; reason: string } | null>(null);

export type CurrentRole = 'Validator' | 'Bridge' | 'Controller' | 'Paradox';
export type CurrentMode = 'cold' | 'expect_llm' | 'expect_user';
export const currentRole = new Signal<CurrentRole>('Validator');
export const currentMode = new Signal<CurrentMode>('cold');

export const enginePersistedAt = new Signal<number>(0);

// --- 12-Perspectives & Manifold Anti-Debug Layer ---
export const lastQuery = new Signal<string>('');

export interface ManifoldMessage {
    id: string;
    ts: number;
    source: 'system' | 'engine' | 'bridge' | 'parser';
    type: 'info' | 'warn' | 'error' | 'state_dump';
    message: string;
    data?: any;
}
export const manifoldLog = new Signal<ManifoldMessage[]>([]);

// --- Screen Router & History ---
export type ScreenId = 'chat' | 'arena' | 'log' | 'ledger' | 'manifold';
export interface NavEntry {
    screen: ScreenId;
    focus?: any;
}
export const activeScreen = new Signal<ScreenId>('chat');
export const navHistory = new Signal<NavEntry[]>([{ screen: 'chat' }]);
export const navCursor = new Signal<number>(0);


// wasm/src/state.ts

export interface ApiLogEntry {
  id: string;
  ts: number;
  direction: 'out'|'in';
  role: 'validator'|'bridge'|'controller'|'paradox'|'arena'|'raw';
  temperature: 'cold'|'warm';
  bodyText: string;
  linkedExchangeId?: string;
}

export interface LogConfig { maxEntries: number; } // 0 = unlimited
export const apiLog = new Signal<ApiLogEntry[]>([]);
export const logConfig = new Signal<LogConfig>({ maxEntries: 0 });

// --- UI Session Drafts ---
export const draftQuery = new Signal<string>('');

