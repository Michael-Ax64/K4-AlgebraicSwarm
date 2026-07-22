// wasm/ui/src/ledger/schema.ts
//
// Canonical data model for the 5D Semantic Ledger (Worlds → Levels →
// Vocabularies / Circuits / LedgerEntries) plus the Corpus documents
// attached to the Validator's Markov Blanket.

export type K4Type =
  | 'P' | 'I' | 'U' | 'R'
  | 'P-U' | 'I-R' | 'P-R' | 'I-U' | 'P-I' | 'U-R';

export type ElementRole = 'SPEC' | 'MATERIAL' | 'NIL';

export interface World {
  id: string;
  name: string;
  description: string;
  apiProvider: 'manual' | 'auto' | 'openai' | 'anthropic' | 'custom'; // 'manual' forces copy/paste mode
  apiKey: string;
  apiBaseUrl: string; // useful for local models like LMStudio/Ollama
  createdAt: number;
  updatedAt: number;
}

export interface Level {
  id: string;
  worldId: string;
  name: string;
  levelIndex: number;
}

export interface Vocabulary {
  id: string;
  levelId: string;
  term: string;
  k4Type: K4Type;
  role: ElementRole;
  description: string;
}

// The Circuit model (AC extension)
export interface CircuitState {
  id: string;
  levelId: string;
  name: string;

  // Thermodynamic / AC parameters
  resistanceR: number;    // R: Grounding / Dissipation / Friction
  inductanceL: number;    // L: Memory / Momentum / Resistance to flow change
  capacitanceC: number;   // C: Anticipation / Tension / Resistance to pressure
  drivingOmega: number;   // ω: Current pacing / Angular Frequency

  // Framework topology data
  activeFace: K4Type;
  heldAbsentVar: K4Type;
  currentCycle: number;
}

export interface LedgerEntry {
  id: string;
  circuitId: string;
  cycle: number;
  seq: number;
  stance: string;
  health: string;
  snapshotJson: string;
  createdAt: number;
}

/**
 * A Corpus document — Document 1..N attached to the Validator's Markov
 * Blanket alongside Document 0. Currently held in memory only; add an
 * IndexedDB store here if durable per-world corpora become a requirement.
 */
export interface CorpusDocEntry {
  id: string;
  name: string;
  content: string;
}
