// wasm/ts/src/ledger/grid-state.ts

import { Signal, createEffect } from '../reactive';
import { vfsDb } from './fs';
import {
  World, Level, Vocabulary, CircuitState, LedgerEntry,
  CorpusDocEntry, K4Type, ElementRole,
} from './schema';
import { seedDatabaseIfEmpty } from './seed';

export type LedgerTab = 'vocab' | 'corpus' | 'circuit' | 'ledger' | 'settings';

export const activeWorldConfig = new Signal<World | null>(null);
export const selectedWorldId = new Signal<string | null>(null);
export const selectedLevelId = new Signal<string | null>(null);
export const activeTab = new Signal<LedgerTab>('vocab');

export const worldsGrid = new Signal<World[]>([]);
export const levelsGrid = new Signal<Level[]>([]);
export const vocabGrid = new Signal<Vocabulary[]>([]);
export const circuitGrid = new Signal<CircuitState[]>([]);
export const ledgerGrid = new Signal<LedgerEntry[]>([]);
export const corpusGrid = new Signal<CorpusDocEntry[]>([]);

export async function bootLedger(): Promise<void> {
  await vfsDb.init();               
  await seedDatabaseIfEmpty();      
  await refreshWorlds();            
}

export async function refreshWorlds(): Promise<void> {
  worldsGrid.value = await vfsDb.getWorlds();
}

createEffect(() => {
  const wId = selectedWorldId.value;
  const worlds = worldsGrid.value;
  if (wId) {
    activeWorldConfig.value = worlds.find(w => w.id === wId) ?? null;
    void vfsDb.getLevels(wId).then(levels => {
      levelsGrid.value = levels.slice().sort((a, b) => a.levelIndex - b.levelIndex);
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

let activeFetchLevelId: string | null = null; // FIXED: Prevent race condition lock

createEffect(() => {
  const lId = selectedLevelId.value;
  if (!lId) {
    vocabGrid.value = [];
    circuitGrid.value = [];
    ledgerGrid.value = [];
    return;
  }
  void loadLevelData(lId);
});

async function loadLevelData(levelId: string): Promise<void> {
  activeFetchLevelId = levelId;
  const [vocabs, circuits] = await Promise.all([
    vfsDb.getVocabulary(levelId),
    vfsDb.getCircuitState(levelId),
  ]);
  const entriesPerCircuit = await Promise.all(
    circuits.map(c => vfsDb.getLedgerEntries(c.id))
  );
  
  if (activeFetchLevelId !== levelId) return; // Drop stale responses

  const entries = entriesPerCircuit.flat();
  vocabGrid.value = vocabs;
  circuitGrid.value = circuits;
  ledgerGrid.value = entries.sort(
    (a, b) => (b.cycle - a.cycle) || (b.seq - a.seq)
  ); 
}

export async function addVocabTerm(term: string, k4Type: K4Type, role: ElementRole): Promise<void> {
  const lId = selectedLevelId.value;
  if (!lId) return;

  const newVocab: Vocabulary = {
    id: crypto.randomUUID(),
    levelId: lId,
    term,
    k4Type,
    role,
    description: '',
  };

  await vfsDb.upsertVocabulary(newVocab);
  vocabGrid.value = await vfsDb.getVocabulary(lId);
}

export function addCorpusDoc(name: string, content: string): void {
  const doc: CorpusDocEntry = {
    id: crypto.randomUUID(),
    name,
    content,
  };
  corpusGrid.value = [...corpusGrid.value, doc];
}

export function deleteCorpusDoc(id: string): void {
  corpusGrid.value = corpusGrid.value.filter(d => d.id !== id);
}

export function getActiveVocabContext(): string {
  const vocabs = vocabGrid.value;
  if (vocabs.length === 0) return 'No domain vocabulary defined.';

  return vocabs
    .map(v => `- [${v.k4Type}] (${v.role}): ${v.term}`)
    .join('\n');
}
