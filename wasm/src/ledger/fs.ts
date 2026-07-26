// wasm/src/ledger/fs.ts

import {
  World, Project, View, Language, Vocabulary,
  Document, ViewDocOverride, WorldLangSelection, ViewLangSelection,
  AppKind, LedgerRow, ConsoleRow, WorldFrameState, Circuit
} from './schema';

const DB_NAME = 'K4Manifold_VFS';
const DB_VERSION = 5;

const REQUIRED_STORES = [
  'worlds',
  'projects',
  'views',
  'languages',
  'vocabularies',
  'world_lang_selections',
  'documents',
  'view_doc_overrides',
  'view_lang_selections',
  'kinds',
  'ledger',
  'console_log',
  'world_frame_state',
  'circuits',
  'engine_state',
];

class LedgerFS {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    try {
      await this.openDatabase();
      for (const store of REQUIRED_STORES) {
        if (!this.db!.objectStoreNames.contains(store)) {
          throw new Error(`Missing required object store: ${store}`);
        }
      }
    } catch (err) {
      console.warn('⚠️ [LedgerFS] Schema audit failed — factory reset as last resort.', err);
      await this.factoryReset();
      await this.openDatabase();
    }
  }

  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const existingStores = Array.from(db.objectStoreNames);
        for (const name of existingStores) {
          db.deleteObjectStore(name);
        }
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
    db.createObjectStore('worlds', { keyPath: 'id' });

    const projStore = db.createObjectStore('projects', { keyPath: 'id' });
    projStore.createIndex('worldId', 'worldId', { unique: false });

    const viewStore = db.createObjectStore('views', { keyPath: 'id' });
    viewStore.createIndex('projectId', 'projectId', { unique: false });

    // Global Languages (Peer to Worlds)
    db.createObjectStore('languages', { keyPath: 'id' });

    const vocabStore = db.createObjectStore('vocabularies', { keyPath: 'id' });
    vocabStore.createIndex('languageId', 'languageId', { unique: false });

    const wlsStore = db.createObjectStore('world_lang_selections', { keyPath: 'id' });
    wlsStore.createIndex('worldId', 'worldId', { unique: false });

    const docStore = db.createObjectStore('documents', { keyPath: 'id' });
    docStore.createIndex('ownerScope_ownerId', ['ownerScope', 'ownerId'], { unique: false });

    const vdoStore = db.createObjectStore('view_doc_overrides', { keyPath: 'id' });
    vdoStore.createIndex('viewId', 'viewId', { unique: false });

    const vlsStore = db.createObjectStore('view_lang_selections', { keyPath: 'id' });
    vlsStore.createIndex('viewId', 'viewId', { unique: false });

    const kindStore = db.createObjectStore('kinds', { keyPath: 'id' });
    kindStore.createIndex('scope_scopeId', ['scope', 'scopeId'], { unique: false });
    kindStore.createIndex('key', 'key', { unique: false });

    const turnStore = db.createObjectStore('ledger', { keyPath: 'id' });
    turnStore.createIndex('viewId', 'viewId', { unique: false });
    turnStore.createIndex('viewId_turnNumber_seq', ['viewId', 'turnNumber', 'seq'], { unique: false });

    const consoleStore = db.createObjectStore('console_log', { keyPath: 'id' });
    consoleStore.createIndex('viewId', 'viewId', { unique: false });

    const wfsStore = db.createObjectStore('world_frame_state', { keyPath: 'id' });
    wfsStore.createIndex('worldId', 'worldId', { unique: false });

    const circStore = db.createObjectStore('circuits', { keyPath: 'id' });
    circStore.createIndex('viewId', 'viewId', { unique: false });

    db.createObjectStore('engine_state', { keyPath: 'id' });
  }

  private async runTx<T>(storeName: string, mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
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

  // ─── WORLDS, PROJECTS, VIEWS ──────────────────────────────────────────────
  async getWorlds(): Promise<World[]> { return this.runTx('worlds', 'readonly', s => s.getAll()); }
  async upsertWorld(world: World): Promise<void> { await this.runTx('worlds', 'readwrite', s => s.put(world)); }
  async deleteWorld(id: string): Promise<void> { await this.runTx('worlds', 'readwrite', s => s.delete(id)); }

  async getProjects(worldId: string): Promise<Project[]> { return this.getAllByIndex('projects', 'worldId', worldId); }
  async upsertProject(project: Project): Promise<void> { await this.runTx('projects', 'readwrite', s => s.put(project)); }
  async deleteProject(id: string): Promise<void> { await this.runTx('projects', 'readwrite', s => s.delete(id)); }

  async getViews(projectId: string): Promise<View[]> { return this.getAllByIndex('views', 'projectId', projectId); }
  async getView(id: string): Promise<View | undefined> { return this.runTx('views', 'readonly', s => s.get(id)); }
  async upsertView(view: View): Promise<void> { await this.runTx('views', 'readwrite', s => s.put(view)); }
  async deleteView(id: string): Promise<void> { await this.runTx('views', 'readwrite', s => s.delete(id)); }

  // ─── GLOBAL LANGUAGES (CROSS-WORLD PEERS) ─────────────────────────────────
  async getAllLanguages(): Promise<Language[]> { return this.runTx('languages', 'readonly', s => s.getAll()); }
  async getLanguage(id: string): Promise<Language | undefined> { return this.runTx('languages', 'readonly', s => s.get(id)); }
  async upsertLanguage(lang: Language): Promise<void> { await this.runTx('languages', 'readwrite', s => s.put(lang)); }
  async deleteLanguage(id: string): Promise<void> { await this.runTx('languages', 'readwrite', s => s.delete(id)); }

  /**
   * Helper query resolving linked Languages for a given scope.
   */
  async getLanguages(scope?: 'world' | 'project' | 'view', scopeId?: string): Promise<Language[]> {
    const all = await this.getAllLanguages();
    if (!scope || !scopeId) return all;

    if (scope === 'world') {
      const worldSels = await this.getWorldLangSelections(scopeId);
      const activeIds = new Set(worldSels.filter(s => s.active).map(s => s.languageId));
      return all.filter(l => activeIds.has(l.id));
    } else if (scope === 'view') {
      const viewSels = await this.getViewLangSelections(scopeId);
      const activeIds = new Set(viewSels.filter(s => s.active).map(s => s.languageId));
      return all.filter(l => activeIds.has(l.id));
    }
    return all;
  }

  async getVocabulary(languageId: string): Promise<Vocabulary[]> { return this.getAllByIndex('vocabularies', 'languageId', languageId); }
  async upsertVocabulary(vocab: Vocabulary): Promise<void> { await this.runTx('vocabularies', 'readwrite', s => s.put(vocab)); }
  async deleteVocabulary(id: string): Promise<void> { await this.runTx('vocabularies', 'readwrite', s => s.delete(id)); }

  async getWorldLangSelections(worldId: string): Promise<WorldLangSelection[]> { return this.getAllByIndex('world_lang_selections', 'worldId', worldId); }
  async upsertWorldLangSelection(sel: WorldLangSelection): Promise<void> { await this.runTx('world_lang_selections', 'readwrite', s => s.put(sel)); }

  async getViewLangSelections(viewId: string): Promise<ViewLangSelection[]> { return this.getAllByIndex('view_lang_selections', 'viewId', viewId); }
  async upsertViewLangSelection(sel: ViewLangSelection): Promise<void> { await this.runTx('view_lang_selections', 'readwrite', s => s.put(sel)); }

  // ─── DOCUMENTS & OVERRIDES ────────────────────────────────────────────────
  async getDocuments(ownerScope: 'world' | 'project', ownerId: string): Promise<Document[]> {
    return this.getAllByIndex('documents', 'ownerScope_ownerId', [ownerScope, ownerId]);
  }
  async upsertDocument(doc: Document): Promise<void> { await this.runTx('documents', 'readwrite', s => s.put(doc)); }
  async deleteDocument(id: string): Promise<void> { await this.runTx('documents', 'readwrite', s => s.delete(id)); }

  async getViewDocOverrides(viewId: string): Promise<ViewDocOverride[]> { return this.getAllByIndex('view_doc_overrides', 'viewId', viewId); }
  async upsertViewDocOverride(override: ViewDocOverride): Promise<void> { await this.runTx('view_doc_overrides', 'readwrite', s => s.put(override)); }
  async deleteViewDocOverride(id: string): Promise<void> { await this.runTx('view_doc_overrides', 'readwrite', s => s.delete(id)); }
  async clearViewDocOverrides(viewId: string): Promise<void> {
    const rows = await this.getViewDocOverrides(viewId);
    for (const r of rows) await this.deleteViewDocOverride(r.id);
  }

  // ─── KINDS STORE ──────────────────────────────────────────────────────────
  async getKinds(scope: 'world' | 'project', scopeId: string): Promise<AppKind[]> {
    return this.getAllByIndex('kinds', 'scope_scopeId', [scope, scopeId]);
  }
  async getKindByKey(key: string): Promise<AppKind | undefined> {
    const results = await this.getAllByIndex<AppKind>('kinds', 'key', key);
    return results[0];
  }
  async upsertKind(kind: AppKind): Promise<void> { await this.runTx('kinds', 'readwrite', s => s.put(kind)); }
  async deleteKind(id: string): Promise<void> { await this.runTx('kinds', 'readwrite', s => s.delete(id)); }

  // ─── LEDGER (EXCHANGES & TURNS) ───────────────────────────────────────────
  async getLedgerRows(viewId: string): Promise<LedgerRow[]> {
    const rows = await this.getAllByIndex<LedgerRow>('ledger', 'viewId', viewId);
    return rows.sort((a, b) => a.turnNumber !== b.turnNumber ? a.turnNumber - b.turnNumber : a.seq - b.seq);
  }
  async getLedgerRow(id: string): Promise<LedgerRow | undefined> { return this.runTx('ledger', 'readonly', s => s.get(id)); }
  async upsertLedgerRow(row: LedgerRow): Promise<void> { await this.runTx('ledger', 'readwrite', s => s.put(row)); }
  async deleteLedgerRow(id: string): Promise<void> { await this.runTx('ledger', 'readwrite', s => s.delete(id)); }

  async getNextLedgerTurnNumber(viewId: string): Promise<number> {
    const rows = await this.getLedgerRows(viewId);
    if (rows.length === 0) return 1;
    return rows[rows.length - 1].turnNumber + 1;
  }

  async getNextLedgerSeq(viewId: string, turnNumber: number): Promise<number> {
    const rows = await this.getLedgerRows(viewId);
    const inTurn = rows.filter(r => r.turnNumber === turnNumber);
    if (inTurn.length === 0) return 1;
    return Math.max(...inTurn.map(r => r.seq)) + 1;
  }

  // ─── CONSOLE & UI STATE ───────────────────────────────────────────────────
  async getConsoleRows(viewId: string | null): Promise<ConsoleRow[]> {
    if (viewId === null) {
      const all = await this.runTx<ConsoleRow[]>('console_log', 'readonly', s => s.getAll());
      return all.filter(r => r.viewId === null).sort((a, b) => a.createdAt - b.createdAt);
    }
    const rows = await this.getAllByIndex<ConsoleRow>('console_log', 'viewId', viewId);
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }

  async getAllConsoleRows(): Promise<ConsoleRow[]> {
    const all = await this.runTx<ConsoleRow[]>('console_log', 'readonly', s => s.getAll());
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }

  async upsertConsoleRow(row: ConsoleRow): Promise<void> { await this.runTx('console_log', 'readwrite', s => s.put(row)); }
  async deleteConsoleRow(id: string): Promise<void> { await this.runTx('console_log', 'readwrite', s => s.delete(id)); }

  async getWorldFrameStates(worldId: string): Promise<WorldFrameState[]> { return this.getAllByIndex('world_frame_state', 'worldId', worldId); }
  async getWorldFrameState(worldId: string, frameKey: string): Promise<WorldFrameState | undefined> {
    return this.runTx('world_frame_state', 'readonly', s => s.get(`${worldId}:${frameKey}`));
  }
  async upsertWorldFrameState(worldId: string, frameKey: string, stateJson: string): Promise<void> {
    const id = `${worldId}:${frameKey}`;
    const now = Date.now();
    const existing = await this.runTx<WorldFrameState | undefined>('world_frame_state', 'readonly', s => s.get(id));
    const row: WorldFrameState = {
      id, worldId, frameKey, stateJson,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.runTx('world_frame_state', 'readwrite', s => s.put(row));
  }

  async getCircuits(viewId: string): Promise<Circuit[]> { return this.getAllByIndex('circuits', 'viewId', viewId); }
  async upsertCircuit(circuit: Circuit): Promise<void> { await this.runTx('circuits', 'readwrite', s => s.put(circuit)); }
  async deleteCircuit(id: string): Promise<void> { await this.runTx('circuits', 'readwrite', s => s.delete(id)); }

  async getEngineState(): Promise<{ id: string, raw: string } | undefined> { return this.runTx('engine_state', 'readonly', s => s.get('current')); }
  async putEngineState(raw: string): Promise<void> { await this.runTx('engine_state', 'readwrite', s => s.put({ id: 'current', raw })); }

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

