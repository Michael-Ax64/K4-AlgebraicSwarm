// wasm/src/ledger/fs.ts

import {
  CircuitNode, Vocabulary, CircuitDocOverride, CircuitLangSelection,
  AppKind, LedgerRow, ConsoleRow, WorldFrameState, SystemSettings,
  CircuitSpecialization
} from './schema';

const DB_NAME = 'K4Manifold_Unified_VFS';
const DB_VERSION = 7;

const REQUIRED_STORES = [
  'circuits',
  'vocabularies',
  'circuit_doc_overrides',
  'circuit_lang_selections',
  'kinds',
  'ledger',
  'console_log',
  'world_frame_state',
  'engine_state',
  'settings'
];

class LedgerFS {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    try {
      await this.openDatabase();
      for (const store of REQUIRED_STORES) {
        if (!this.db!.objectStoreNames.contains(store)) {
          throw new Error(`Missing required store: ${store}`);
        }
      }
    } catch (err) {
      console.warn('⚠️ [LedgerFS] Schema audit check:', err);
      await this.openDatabase();
    }
  }

  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
  }

  private createStores(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains('circuits')) {
      const circStore = db.createObjectStore('circuits', { keyPath: 'id' });
      circStore.createIndex('priorId', 'priorId', { unique: false });
      circStore.createIndex('specialization', 'specialization', { unique: false });
    }

    if (!db.objectStoreNames.contains('vocabularies')) {
      const vocabStore = db.createObjectStore('vocabularies', { keyPath: 'id' });
      vocabStore.createIndex('languageId', 'languageId', { unique: false });
    }

    if (!db.objectStoreNames.contains('circuit_doc_overrides')) {
      const cdoStore = db.createObjectStore('circuit_doc_overrides', { keyPath: 'id' });
      cdoStore.createIndex('circuitId', 'circuitId', { unique: false });
    }

    if (!db.objectStoreNames.contains('circuit_lang_selections')) {
      const clsStore = db.createObjectStore('circuit_lang_selections', { keyPath: 'id' });
      clsStore.createIndex('circuitId', 'circuitId', { unique: false });
    }

    if (!db.objectStoreNames.contains('kinds')) {
      const kindStore = db.createObjectStore('kinds', { keyPath: 'id' });
      kindStore.createIndex('key', 'key', { unique: true });
    }

    if (!db.objectStoreNames.contains('ledger')) {
      const turnStore = db.createObjectStore('ledger', { keyPath: 'id' });
      turnStore.createIndex('circuitId', 'circuitId', { unique: false });
    }

    if (!db.objectStoreNames.contains('console_log')) {
      const consoleStore = db.createObjectStore('console_log', { keyPath: 'id' });
      consoleStore.createIndex('circuitId', 'circuitId', { unique: false });
    }

    if (!db.objectStoreNames.contains('world_frame_state')) {
      const wfsStore = db.createObjectStore('world_frame_state', { keyPath: 'id' });
      wfsStore.createIndex('worldId', 'worldId', { unique: false });
    }

    if (!db.objectStoreNames.contains('engine_state')) {
      db.createObjectStore('engine_state', { keyPath: 'id' });
    }

    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'id' });
    }
  }

  public async runTx<T>(storeName: string, mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    if (!this.db) await this.init();
    return new Promise<T>((resolve, reject) => {
      const tx = this.db!.transaction(storeName, mode);
      const req = op(tx.objectStore(storeName));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  }

  private async getAllByIndex<T>(storeName: string, indexName: string, key: IDBValidKey): Promise<T[]> {
    if (!this.db) await this.init();
    return new Promise<T[]>((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).index(indexName).getAll(IDBKeyRange.only(key));
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  // ─── UNIFIED CIRCUIT NODE STORE ───────────────────────────────────────────
  async getAllCircuits(): Promise<CircuitNode[]> { return this.runTx('circuits', 'readonly', s => s.getAll()); }
  async getCircuit(id: string): Promise<CircuitNode | undefined> { return this.runTx('circuits', 'readonly', s => s.get(id)); }
  async upsertCircuit(circuit: CircuitNode): Promise<void> { await this.runTx('circuits', 'readwrite', s => s.put(circuit)); }
  async purgeCircuit(id: string): Promise<void> { await this.runTx('circuits', 'readwrite', s => s.delete(id)); }

  async getCircuitsBySpecialization(specs: CircuitSpecialization[]): Promise<CircuitNode[]> {
    const all = await this.getAllCircuits();
    return all.filter(c => specs.includes(c.specialization));
  }

  // ─── SOVEREIGN LANGUAGES ──────────────────────────────────────────────────
  async getAllLanguages(): Promise<CircuitNode[]> {
    const all = await this.getAllCircuits();
    return all.filter(c => c.specialization === 'language' && c.priorId !== '__TRASH__');
  }

  async getLanguage(id: string): Promise<CircuitNode | undefined> {
    const c = await this.getCircuit(id);
    return (c && c.specialization === 'language') ? c : undefined;
  }

  async upsertLanguage(lang: CircuitNode): Promise<void> {
    lang.specialization = 'language';
    await this.upsertCircuit(lang);
  }

  async deleteLanguage(id: string): Promise<void> {
    const node = await this.getCircuit(id);
    if (node) {
      node.priorId = '__TRASH__';
      node.updatedAt = Date.now();
      await this.upsertCircuit(node);
    }
  }

  // ─── SOVEREIGN DOCUMENTS ──────────────────────────────────────────────────
  async getAllDocuments(): Promise<CircuitNode[]> {
    const all = await this.getAllCircuits();
    return all.filter(c => c.specialization === 'document' && c.priorId !== '__TRASH__');
  }

  async getDocument(id: string): Promise<CircuitNode | undefined> {
    const c = await this.getCircuit(id);
    return (c && c.specialization === 'document') ? c : undefined;
  }

  async upsertDocument(doc: CircuitNode): Promise<void> {
    doc.specialization = 'document';
    await this.upsertCircuit(doc);
  }

  async deleteDocument(id: string): Promise<void> {
    const node = await this.getCircuit(id);
    if (node) {
      node.priorId = '__TRASH__';
      node.updatedAt = Date.now();
      await this.upsertCircuit(node);
    }
  }

  // ─── VOCABULARIES (FAIL-SAFE INDEXED + SCANNED FETCH) ────────────────────
  async getVocabulary(languageId: string): Promise<Vocabulary[]> {
    if (!languageId) return [];
    try {
      const indexed = await this.getAllByIndex<Vocabulary>('vocabularies', 'languageId', languageId);
      if (indexed && indexed.length > 0) return indexed;
    } catch (e) {
      // Fallback if index scan encounters legacy DB schema
    }
    const all = await this.runTx<Vocabulary[]>('vocabularies', 'readonly', s => s.getAll());
    return all.filter(v => v.languageId === languageId);
  }

  async upsertVocabulary(vocab: Vocabulary): Promise<void> { await this.runTx('vocabularies', 'readwrite', s => s.put(vocab)); }
  async deleteVocabulary(id: string): Promise<void> { await this.runTx('vocabularies', 'readwrite', s => s.delete(id)); }

  // ─── JUNCTIONS ────────────────────────────────────────────────────────────
  async getCircuitLangSelections(circuitId: string): Promise<CircuitLangSelection[]> {
    return this.getAllByIndex('circuit_lang_selections', 'circuitId', circuitId);
  }
  async upsertCircuitLangSelection(sel: CircuitLangSelection): Promise<void> {
    await this.runTx('circuit_lang_selections', 'readwrite', s => s.put(sel));
  }

  async getCircuitDocOverrides(circuitId: string): Promise<CircuitDocOverride[]> {
    return this.getAllByIndex('circuit_doc_overrides', 'circuitId', circuitId);
  }
  async upsertCircuitDocOverride(override: CircuitDocOverride): Promise<void> {
    await this.runTx('circuit_doc_overrides', 'readwrite', s => s.put(override));
  }
  async deleteCircuitDocOverride(id: string): Promise<void> {
    await this.runTx('circuit_doc_overrides', 'readwrite', s => s.delete(id));
  }

  // ─── KINDS ────────────────────────────────────────────────────────────────
  async getAllKinds(): Promise<AppKind[]> { return this.runTx('kinds', 'readonly', s => s.getAll()); }
  async getKindByKey(key: string): Promise<AppKind | undefined> { return this.runTx('kinds', 'readonly', s => s.get(key)); }
  async upsertKind(kind: AppKind): Promise<void> { await this.runTx('kinds', 'readwrite', s => s.put(kind)); }
  async deleteKind(id: string): Promise<void> { await this.runTx('kinds', 'readwrite', s => s.delete(id)); }

  // ─── LEDGER & CONSOLE ─────────────────────────────────────────────────────
  async getLedgerRows(circuitId: string): Promise<LedgerRow[]> {
    const rows = await this.getAllByIndex<LedgerRow>('ledger', 'circuitId', circuitId);
    return rows.sort((a, b) => a.turnNumber !== b.turnNumber ? a.turnNumber - b.turnNumber : a.seq - b.seq);
  }
  async getLedgerRow(id: string): Promise<LedgerRow | undefined> { return this.runTx('ledger', 'readonly', s => s.get(id)); }
  async upsertLedgerRow(row: LedgerRow): Promise<void> { await this.runTx('ledger', 'readwrite', s => s.put(row)); }

  async getNextLedgerTurnNumber(circuitId: string): Promise<number> {
    const rows = await this.getLedgerRows(circuitId);
    if (rows.length === 0) return 1;
    return rows[rows.length - 1].turnNumber + 1;
  }

  async getConsoleRows(circuitId: string | null): Promise<ConsoleRow[]> {
    if (circuitId === null) {
      const all = await this.runTx<ConsoleRow[]>('console_log', 'readonly', s => s.getAll());
      return all.filter(r => r.circuitId === null).sort((a, b) => a.createdAt - b.createdAt);
    }
    const rows = await this.getAllByIndex<ConsoleRow>('console_log', 'circuitId', circuitId);
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }
  async getAllConsoleRows(): Promise<ConsoleRow[]> {
    const all = await this.runTx<ConsoleRow[]>('console_log', 'readonly', s => s.getAll());
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }
  async upsertConsoleRow(row: ConsoleRow): Promise<void> { await this.runTx('console_log', 'readwrite', s => s.put(row)); }

  // ─── FRAME STATE & SETTINGS ───────────────────────────────────────────────
  async getWorldFrameStates(worldId: string): Promise<WorldFrameState[]> { return this.getAllByIndex('world_frame_state', 'worldId', worldId); }
  async getWorldFrameState(worldId: string, frameKey: string): Promise<WorldFrameState | undefined> {
    return this.runTx('world_frame_state', 'readonly', s => s.get(`${worldId}:${frameKey}`));
  }
  async upsertWorldFrameState(worldId: string, frameKey: string, stateJson: string): Promise<void> {
    const id = `${worldId}:${frameKey}`;
    const now = Date.now();
    const existing = await this.runTx<WorldFrameState | undefined>('world_frame_state', 'readonly', s => s.get(id));
    const row: WorldFrameState = { id, worldId, frameKey, stateJson, createdAt: existing?.createdAt ?? now, updatedAt: now };
    await this.runTx('world_frame_state', 'readwrite', s => s.put(row));
  }
  async deleteWorldFrameState(worldId: string, frameKey: string): Promise<void> {
    await this.runTx('world_frame_state', 'readwrite', s => s.delete(`${worldId}:${frameKey}`));
  }

  async getSettings(): Promise<SystemSettings | undefined> { return this.runTx('settings', 'readonly', s => s.get('global')); }
  async upsertSettings(settings: SystemSettings): Promise<void> { await this.runTx('settings', 'readwrite', s => s.put({ id: 'global', ...settings })); }

  async getEngineState(): Promise<{ id: string, raw: string } | undefined> { return this.runTx('engine_state', 'readonly', s => s.get('current')); }
  async putEngineState(raw: string): Promise<void> { await this.runTx('engine_state', 'readwrite', s => s.put({ id: 'current', raw })); }
  async deleteEngineState(): Promise<void> { await this.runTx('engine_state', 'readwrite', s => s.delete('current')); }

  async factoryReset(): Promise<void> {
    if (this.db) { this.db.close(); this.db = null; }
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
}

export const vfsDb = new LedgerFS();
