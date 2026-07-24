// wasm/src/ledger/grid-state.ts
import { Signal, createEffect } from '../reactive';
import { vfsDb } from './fs';
import { World, Language, Vocabulary, View, Circuit, LedgerEntry, CorpusDocEntry, K4Type, ElementRole } from './schema';
import { seedDatabaseIfEmpty } from './seed';

export const activeWorldConfig = new Signal<World | null>(null);
export const selectedWorldId = new Signal<string | null>(null);
export const selectedLanguageId = new Signal<string | null>(null);
export const selectedViewId = new Signal<string | null>(null);
export const selectedCircuitId = new Signal<string | null>(null);

export const worldsGrid = new Signal<World[]>([]);
export const languagesGrid = new Signal<Language[]>([]);
export const viewsGrid = new Signal<View[]>([]);
export const vocabGrid = new Signal<Vocabulary[]>([]);
export const circuitGrid = new Signal<Circuit[]>([]);
export const ledgerGrid = new Signal<LedgerEntry[]>([]);
export const corpusGrid = new Signal<CorpusDocEntry[]>([]);

export async function bootLedger(): Promise<void> {
    await vfsDb.init();
    await seedDatabaseIfEmpty();
    worldsGrid.value = await vfsDb.getWorlds();
    if (worldsGrid.value.length > 0) selectedWorldId.value = worldsGrid.value[0].id;
}

// CASCADE 1: World -> Languages, Views, Corpus
createEffect(() => {
    const wId = selectedWorldId.value;
    if (wId) {
        activeWorldConfig.value = worldsGrid.value.find(w => w.id === wId) ?? null;
        Promise.all([vfsDb.getLanguages(wId), vfsDb.getViews(wId), vfsDb.getCorpusDocs(wId)]).then(([langs, views, corpus]) => {
            languagesGrid.value = langs;
            viewsGrid.value = views;
            corpusGrid.value = corpus;
        });
    } else {
        activeWorldConfig.value = null; languagesGrid.value = []; viewsGrid.value = []; corpusGrid.value = [];
        selectedLanguageId.value = null; selectedViewId.value = null;
    }
});

// CASCADE 2: Language -> Vocab 
// (Fires when editing a language OR when switching to a View that uses a language)
createEffect(() => {
    // If a View is selected, prioritize its associated Language for the operational context
    let targetLangId = selectedLanguageId.value;
    const activeView = viewsGrid.value.find(v => v.id === selectedViewId.value);
    if (activeView) {
        targetLangId = activeView.languageId;
    }

    if (!targetLangId) {
        vocabGrid.value = [];
        return;
    }
    vfsDb.getVocabulary(targetLangId).then(vocabs => vocabGrid.value = vocabs);
});

// CASCADE 3: View -> Circuits & Ledger
createEffect(() => {
    const vId = selectedViewId.value;
    if (!vId) {
        circuitGrid.value = []; ledgerGrid.value = []; selectedCircuitId.value = null;
        return;
    }
    Promise.all([vfsDb.getCircuits(vId), vfsDb.getLedgerEntries(vId)]).then(([circuits, entries]) => {
        circuitGrid.value = circuits;
        ledgerGrid.value = entries.sort((a, b) => (b.cycle - a.cycle) || (b.seq - a.seq));
    });
});

export async function addVocabTerm(term: string, k4Type: K4Type, role: ElementRole, languageId: string): Promise<void> { 
    await vfsDb.upsertVocabulary({ id: crypto.randomUUID(), languageId, term, k4Type, role, description: '' });
    if (selectedLanguageId.value === languageId || viewsGrid.value.find(v => v.id === selectedViewId.value)?.languageId === languageId) {
        vocabGrid.value = await vfsDb.getVocabulary(languageId);
    }
}
export function getActiveVocabContext(): string {
    const vocabs = vocabGrid.value;
    if (vocabs.length === 0) return 'No domain vocabulary defined.';
    return vocabs.map(v => `- [${v.k4Type}] (${v.role}): ${v.term}`).join('\n');
}
