// wasm/src/ledger/schema.ts

export type K4Type = 'P' | 'I' | 'U' | 'R' | 'P-U' | 'I-R' | 'P-R' | 'I-U' | 'P-I' | 'U-R';
export type K4Pole = 'P' | 'I' | 'U' | 'R';
export type ElementRole = 'SPEC' | 'MATERIAL' | 'NIL';

export type CircuitSpecialization = 
  | 'circuit' 
  | 'world' 
  | 'project' 
  | 'view' 
  | 'language' 
  | 'document';

// ─── WORLD CLASS SETTINGS ───────────────────────────────────────────────────
export interface WorldSettings {
  apiProvider: 'manual' | 'auto' | 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  apiBaseUrl: string;
  worldDirectives: string;
}

// ─── DOCUMENT CLASS PAYLOAD ─────────────────────────────────────────────────
export interface DocumentPayload {
  content: string;
  defaultA: boolean;               // Shared across all faces
  defaultP: boolean;               // Included for Fire (Drive)
  defaultU: boolean;               // Included for Air (Structure)
  defaultI: boolean;               // Included for Water (Flow)
  defaultR: boolean;               // Included for Earth (Ground)
  kind: 'source' | 'derived';
}

// ─── THE SINGLE UNIVERSAL ENTITY: CIRCUIT NODE ───────────────────────────────
export interface CircuitNode {
  id: string;
  priorId: string | null;          // null = Root; '__TRASH__' = Trashed; or parent node ID
  
  specialization: CircuitSpecialization;
  
  // Specialization Payloads
  specializationData?: WorldSettings;     // Present when specialization === 'world'
  documentData?: DocumentPayload;         // Present when specialization === 'document'

  name: string;
  description: string;
  doc0: string;                    // Live draft intent / prompt

  // AC Baseline Physics Substrate
  physics: {
    omega: number;                 // Driving frequency (pacing)
    r: number;                     // Resistance (friction)
    l: number;                     // Inductance (memory/momentum)
    c: number;                     // Capacitance (anticipation/tension)
  };

  activeFace: K4Pole;
  heldAbsentVar: K4Pole;

  createdAt: number;
  updatedAt: number;
}

export type Circuit = CircuitNode;
export type Language = CircuitNode;
export type Document = CircuitNode;

// ─── VOCABULARIES (Belong to Language CircuitNodes) ─────────────────────────
export interface Vocabulary {
  id: string;
  languageId: string;             // FK -> CircuitNode.id (where specialization === 'language')
  term: string;
  k4Type: K4Type;
  role: ElementRole;
  description: string;
}

// ─── JUNCTIONS: CIRCUITS POINTING TO SOVEREIGN NODES ───────────────────────
export interface CircuitLangSelection {
  id: string;                     // `${circuitId}:${languageId}`
  circuitId: string;               // FK -> CircuitNode.id
  languageId: string;              // FK -> Sovereign Language CircuitNode.id
  active: boolean;
}

export interface CircuitDocOverride {
  id: string;                     // `${circuitId}:${documentId}`
  circuitId: string;               // FK -> CircuitNode.id
  documentId: string;              // FK -> Sovereign Document CircuitNode.id
  A: boolean | null;
  P: boolean | null;
  U: boolean | null;
  I: boolean | null;
  R: boolean | null;
}

// ─── SYSTEM FLOWS: KINDS REGISTRY ──────────────────────────────────────────
export type KindDispatch = 'engine' | 'template';

export interface AppKind {
  id: string;
  key: string;                    // Unique flow key ('validator', 'bridge', 'controller', 'paradox', 'chat', etc.)
  alias: string;
  hint: string;
  family: string;
  dispatch: KindDispatch;
  template?: string;
  engineMechanicsDoc?: string;
  requires: {
    circuit?: boolean;
    attachedDocs?: 'none' | 'at-least-one' | 'exactly-one';
    lockedCoordinate?: boolean;
    anchor?: boolean;
  };
  isSystemFlow: boolean;
  createdAt: number;
  updatedAt: number;
}

// ─── EXECUTION AUDIT LOG ────────────────────────────────────────────────────
export type LedgerDirection = 'out' | 'in' | 'system';

export interface LedgerRow {
  id: string;
  circuitId: string;               // FK -> CircuitNode.id
  turnNumber: number;
  seq: number;
  parentId?: string;
  kind: string;                   // SystemKind.key
  direction: LedgerDirection;
  header: string;
  body: string;
  kept?: boolean;

  // Execution Snapshot
  doc0Snapshot: string;
  attachedDocIds: string[];
  activeLanguageIds: string[];
  lineagePath: string[];          // List of circuit IDs up the prior chain
  warm: boolean;

  // Wasm PTR Payload
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
  circuitId: string | null;        // null = System-wide event
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

// ─── GLOBAL APP SETTINGS ───────────────────────────────────────────────────
export interface SystemSettings {
  autoLoadSeedData: boolean;      // Default: false
  seedDataFileNames: string;     // e.g. "seed-data.json"
  telemetryMaxEntries: number;
}
