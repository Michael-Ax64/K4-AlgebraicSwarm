// wasm/src/ledger/schema.ts

export type K4Type = 'P' | 'I' | 'U' | 'R' | 'P-U' | 'I-R' | 'P-R' | 'I-U' | 'P-I' | 'U-R';
export type ElementRole = 'SPEC' | 'MATERIAL' | 'NIL';

// ─── TIER 1: WORLD ──────────────────────────────────────────────────────────
export interface World {
  id: string;
  name: string;
  description: string;
  apiProvider: 'manual' | 'auto' | 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  apiBaseUrl: string;
  createdAt: number;
  updatedAt: number;
}

// ─── TIER 2: PROJECT ────────────────────────────────────────────────────────
export interface Project {
  id: string;
  worldId: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

// ─── TIER 3: VIEW ───────────────────────────────────────────────────────────
export interface View {
  id: string;
  projectId: string;
  name: string;
  description: string;
  doc0: string; // The growing draft prompt
  innateOmega: number;
  innateR: number;
  innateL: number;
  innateC: number;
  createdAt: number;
  updatedAt: number;
}

// ─── CROSS-WORLD RESOURCE: LANGUAGES (PEER TO WORLDS) ───────────────────────
export interface Language {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Vocabulary {
  id: string;
  languageId: string;
  term: string;
  k4Type: K4Type;
  role: ElementRole;
  description: string;
}

/** World's linked subset of cross-world Languages */
export interface WorldLangSelection {
  id: string; // `${worldId}:${languageId}`
  worldId: string;
  languageId: string;
  active: boolean;
}

/** View's active subset of Languages */
export interface ViewLangSelection {
  id: string; // `${viewId}:${languageId}`
  viewId: string;
  languageId: string;
  active: boolean;
}

// ─── COMPOSABLE RESOURCE: DOCUMENTS ─────────────────────────────────────────
export interface Document {
  id: string;
  ownerScope: 'world' | 'project';
  ownerId: string;
  name: string;
  content: string;
  defaultA: boolean;
  defaultP: boolean;
  defaultU: boolean;
  defaultI: boolean;
  defaultR: boolean;
  kind: 'source' | 'derived';
  createdAt: number;
  updatedAt: number;
}

export interface ViewDocOverride {
  id: string;
  viewId: string;
  documentId: string;
  A: boolean | null;
  P: boolean | null;
  U: boolean | null;
  I: boolean | null;
  R: boolean | null;
}

// ─── APP-KINDS REGISTRY ─────────────────────────────────────────────────────
export type KindScope = 'world' | 'project';
export type KindDispatch = 'engine' | 'template';

export interface KindRequires {
  view?: boolean;
  attachedDocs?: 'none' | 'at-least-one' | 'exactly-one';
  lockedCoordinate?: boolean;
  anchor?: boolean;
}

export interface AppKind {
  id: string;
  scope: KindScope;
  scopeId: string;
  key: string;
  alias: string;
  hint: string;
  family: string;
  dispatch: KindDispatch;
  template?: string;
  engineMechanicsDoc?: string;
  requires: KindRequires;
  createdAt: number;
  updatedAt: number;
}

// ─── TURN LOG (THE LEDGER) ──────────────────────────────────────────────────
export type LedgerDirection = 'out' | 'in' | 'system';

export interface LedgerRow {
  id: string;
  viewId: string;
  turnNumber: number;
  seq: number;
  parentId?: string;
  kind: string;
  direction: LedgerDirection;
  header: string;
  body: string;
  kept?: boolean;

  doc0Snapshot: string;
  attachedDocIds: string[];
  activeLanguageIds: string[];
  warm: boolean;

  ptrCycle?: number;
  ptrSeq?: number;
  ptrStance?: string;
  ptrHealth?: string;
  ptrSnapshotJson?: string;

  createdAt: number;
  updatedAt: number;
}

// ─── CONSOLE LOG ────────────────────────────────────────────────────────────
export type ConsoleSeverity = 'info' | 'notice' | 'warn' | 'error';

export interface ConsoleRow {
  id: string;
  viewId: string | null;
  severity: ConsoleSeverity;
  category: string;
  message: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorldFrameState {
  id: string;
  worldId: string;
  frameKey: string;
  stateJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface Circuit {
  id: string;
  viewId: string;
  name: string;
  activeFace: K4Type;
  heldAbsentVar: K4Type;
  omega: number;
  r: number;
  l: number;
  c: number;
  diagnosticVocab: string[];
  rewardQuestion: string;
}

