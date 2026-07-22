// wasm/ui/src/ledger/grid_state.ts

import { Signal, createEffect } from '../reactive';
import { vfsDb } from './fs';
import { World, Level, Vocabulary, CircuitState, LedgerEntry, K4Type, ElementRole } from './schema';

// ─── Selection State ─────────────────────────────────────────────
export const activeWorldConfig = new Signal<World | null>(null);

export const selectedWorldId = new Signal<string | null>(null);
export const selectedLevelId = new Signal<string | null>(null);
export const activeTab = new Signal<'vocab' | 'circuit' | 'ledger'>('vocab');

// ─── Data Signals (The Live Grids) ───────────────────────────────
export const worldsGrid = new Signal<World[]>([]);
export const levelsGrid = new Signal<Level[]>([]);
export const vocabGrid = new Signal<Vocabulary[]>([]);
export const circuitGrid = new Signal<CircuitState[]>([]);
export const ledgerGrid = new Signal<LedgerEntry[]>([]);

// ─── Boot & Cascading Updates ────────────────────────────────────

import { seedDatabaseIfEmpty } from './seed';

export async function bootLedger() {
  await vfsDb.init();                 // 1. Initialize the IndexedDB connection
  await seedDatabaseIfEmpty();        // 2. Parse the JSON and populate 0-DoF baseline
  await refreshWorlds();              // 3. Flow data into the reactive UI Signals
}

export async function refreshWorlds() {
  worldsGrid.value = await vfsDb.getWorlds();
}

createEffect(() => {
  const wId = selectedWorldId.value;
  if (wId) {
    const world = worldsGrid.value.find(w => w.id === wId);
    activeWorldConfig.value = world || null;
    
    vfsDb.getLevels(wId).then(levels => {
      levelsGrid.value = levels.sort((a, b) => a.levelIndex - b.levelIndex);
      if (levels.length > 0 && !selectedLevelId.value) {
        selectedLevelId.value = levels[0].id;
      }
    });
  } else {
    activeWorldConfig.value = null;
    levelsGrid.value = [];
    selectedLevelId.value = null;
  }
});

// When selected level changes, fetch its Vocab, Circuit, and Ledger data
createEffect(() => {
  const lId = selectedLevelId.value;
  if (lId) {
    Promise.all([
      vfsDb.getVocabulary(lId),
      vfsDb.getCircuitState(lId),
      vfsDb.getLedgerEntries(lId)
    ]).then(([vocabs, circuits, entries]) => {
      vocabGrid.value = vocabs;
      circuitGrid.value = circuits;
      ledgerGrid.value = entries.sort((a, b) => b.cycle - a.cycle || b.seq - a.seq); // Newest first
    });
  } else {
    vocabGrid.value = [];
    circuitGrid.value = [];
    ledgerGrid.value = [];
  }
});

// ─── Grid Actions (Mutations) ────────────────────────────────────

export async function addVocabTerm(term: string, k4Type: K4Type, role: ElementRole) {
  const lId = selectedLevelId.value;
  if (!lId) return;

  const newVocab: Vocabulary = {
    id: crypto.randomUUID(),
    levelId: lId,
    term,
    k4Type,
    role,
    description: ''
  };

  await vfsDb.upsertVocabulary(newVocab);
  vocabGrid.value = await vfsDb.getVocabulary(lId); // Trigger UI update
}

// Quick helper to dump current vocab context for the Rust Engine / LLM Prompt
export function getActiveVocabContext(): string {
  const vocabs = vocabGrid.value;
  if (vocabs.length === 0) return "No domain vocabulary defined.";
  
  return vocabs.map(v => 
    `- [${v.k4Type}] (${v.role}): ${v.term}`
  ).join('\n');
}
