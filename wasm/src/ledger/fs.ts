// wasm/src/ledger/fs.ts

import { World, Language, Vocabulary, View, Circuit, LedgerEntry, CorpusDocEntry } from './schema';

const DB_NAME = 'K4Manifold_VFS';
const DB_VERSION = 3;

class LedgerFS {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        try {
            await this.openDatabase();
            // Self-Healing Audit: Verify that ALL required stores exist
            const requiredStores = ['worlds', 'languages', 'vocabularies', 'views', 'circuits', 'ledger_entries', 'engine_state', 'corpus'];
            for (const store of requiredStores) {
                if (!this.db!.objectStoreNames.contains(store)) {
                    throw new Error(`Missing required object store: ${store}`);
                }
            }
        } catch (err) {
            console.warn("⚠️ [LedgerFS] Schema invalid or lock encountered. Triggering automatic self-healing reset...", err);
            await this.factoryReset();
            await this.openDatabase();
        }
    }

    private async openDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                
                // Clean wipe of obsolete legacy tables
                ['worlds', 'levels', 'vocabularies', 'circuits', 'ledger_entries', 'engine_state', 'corpus', 'languages', 'views'].forEach(name => {
                    if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
                });

                db.createObjectStore('worlds', { keyPath: 'id' });
                
                const langStore = db.createObjectStore('languages', { keyPath: 'id' });
                langStore.createIndex('worldId', 'worldId', { unique: false });
                
                const vocabStore = db.createObjectStore('vocabularies', { keyPath: 'id' });
                vocabStore.createIndex('languageId', 'languageId', { unique: false });
                
                const viewStore = db.createObjectStore('views', { keyPath: 'id' });
                viewStore.createIndex('worldId', 'worldId', { unique: false });
                
                const circStore = db.createObjectStore('circuits', { keyPath: 'id' });
                circStore.createIndex('viewId', 'viewId', { unique: false });
                
                const ledgerStore = db.createObjectStore('ledger_entries', { keyPath: 'id' });
                ledgerStore.createIndex('viewId', 'viewId', { unique: false });
                
                db.createObjectStore('engine_state', { keyPath: 'id' });
                
                const corpStore = db.createObjectStore('corpus', { keyPath: 'id' });
                corpStore.createIndex('worldId', 'worldId', { unique: false });
            };
            request.onsuccess = (event) => { this.db = (event.target as IDBOpenDBRequest).result; resolve(); };
            request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
        });
    }

    private async runTx<T>(storeName: string, mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
        if (!this.db) await this.init();
        try {
            return await new Promise((resolve, reject) => {
                const tx = this.db!.transaction(storeName, mode);
                const req = op(tx.objectStore(storeName));
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn(`⚠️ [LedgerFS] Transaction on '${storeName}' failed. Recovering...`, err);
            await this.init();
            return new Promise((resolve, reject) => {
                const tx = this.db!.transaction(storeName, mode);
                const req = op(tx.objectStore(storeName));
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
    }

    private async getAllByIndex<T>(storeName: string, indexName: string, key: string): Promise<T[]> {
        if (!this.db) await this.init();
        try {
            return await new Promise((resolve, reject) => {
                const tx = this.db!.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).index(indexName).getAll(IDBKeyRange.only(key));
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn(`⚠️ [LedgerFS] Index fetch on '${storeName}' failed. Recovering...`, err);
            await this.init();
            return new Promise((resolve, reject) => {
                const tx = this.db!.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).index(indexName).getAll(IDBKeyRange.only(key));
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
    }

    async getWorlds(): Promise<World[]> { return this.runTx('worlds', 'readonly', s => s.getAll()); }
    async upsertWorld(world: World): Promise<void> { await this.runTx('worlds', 'readwrite', s => s.put(world)); }

    async getLanguages(worldId: string): Promise<Language[]> { return this.getAllByIndex('languages', 'worldId', worldId); }
    async upsertLanguage(lang: Language): Promise<void> { await this.runTx('languages', 'readwrite', s => s.put(lang)); }

    async getVocabulary(languageId: string): Promise<Vocabulary[]> { return this.getAllByIndex('vocabularies', 'languageId', languageId); }
    async upsertVocabulary(vocab: Vocabulary): Promise<void> { await this.runTx('vocabularies', 'readwrite', s => s.put(vocab)); }

    async getViews(worldId: string): Promise<View[]> { return this.getAllByIndex('views', 'worldId', worldId); }
    async upsertView(view: View): Promise<void> { await this.runTx('views', 'readwrite', s => s.put(view)); }

    async getCircuits(viewId: string): Promise<Circuit[]> { return this.getAllByIndex('circuits', 'viewId', viewId); }
    async upsertCircuit(circuit: Circuit): Promise<void> { await this.runTx('circuits', 'readwrite', s => s.put(circuit)); }

    async getLedgerEntries(viewId: string): Promise<LedgerEntry[]> { return this.getAllByIndex('ledger_entries', 'viewId', viewId); }
    async appendLedgerEntry(entry: LedgerEntry): Promise<void> { await this.runTx('ledger_entries', 'readwrite', s => s.put(entry)); }

    async getEngineState(): Promise<{id: string, raw: string} | undefined> { return this.runTx('engine_state', 'readonly', s => s.get('current')); }
    async putEngineState(raw: string): Promise<void> { await this.runTx('engine_state', 'readwrite', s => s.put({ id: 'current', raw })); }
    async deleteEngineState(): Promise<void> { await this.runTx('engine_state', 'readwrite', s => s.delete('current')); }

    async getCorpusDocs(worldId: string): Promise<CorpusDocEntry[]> { return this.getAllByIndex('corpus', 'worldId', worldId); }
    async upsertCorpusDoc(doc: CorpusDocEntry): Promise<void> { await this.runTx('corpus', 'readwrite', s => s.put(doc)); }
    async deleteCorpusDoc(id: string): Promise<void> { await this.runTx('corpus', 'readwrite', s => s.delete(id)); }

    async factoryReset(): Promise<void> {
        if (this.db) { 
            this.db.close(); 
            this.db = null; 
        }
        return new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve(); // Resolve anyway so caller can proceed smoothly
            req.onblocked = () => resolve(); // Non-blocking
        });
    }
}

export const vfsDb = new LedgerFS();
