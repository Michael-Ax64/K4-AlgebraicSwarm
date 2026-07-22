// wasm/ts/src/ledger/fs.ts
import { World, Level, Vocabulary, CircuitState, LedgerEntry } from './schema';

const DB_NAME = 'K4Manifold_VFS';
const DB_VERSION = 1;

class LedgerFS {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('worlds')) {
          db.createObjectStore('worlds', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('levels')) {
          const store = db.createObjectStore('levels', { keyPath: 'id' });
          store.createIndex('worldId', 'worldId', { unique: false });
        }
        if (!db.objectStoreNames.contains('vocabularies')) {
          const store = db.createObjectStore('vocabularies', { keyPath: 'id' });
          store.createIndex('levelId', 'levelId', { unique: false });
        }
        if (!db.objectStoreNames.contains('circuits')) {
          const store = db.createObjectStore('circuits', { keyPath: 'id' });
          store.createIndex('levelId', 'levelId', { unique: false });
        }
        if (!db.objectStoreNames.contains('ledger_entries')) {
          const store = db.createObjectStore('ledger_entries', { keyPath: 'id' });
          store.createIndex('circuitId', 'circuitId', { unique: false });
        }
        // FIXED: Missing Engine State store added
        if (!db.objectStoreNames.contains('engine_state')) {
          db.createObjectStore('engine_state', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
  }

  private async runTx<T>(storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = operation(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async getAllByIndex<T>(storeName: string, indexName: string, key: string): Promise<T[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(IDBKeyRange.only(key));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Worlds
  async getWorlds(): Promise<World[]> { return this.runTx('worlds', 'readonly', s => s.getAll()); }
  async upsertWorld(world: World): Promise<void> { await this.runTx('worlds', 'readwrite', s => s.put(world)); }

  // Levels
  async getLevels(worldId: string): Promise<Level[]> { return this.getAllByIndex('levels', 'worldId', worldId); }
  async upsertLevel(level: Level): Promise<void> { await this.runTx('levels', 'readwrite', s => s.put(level)); }

  // Vocabulary
  async getVocabulary(levelId: string): Promise<Vocabulary[]> { return this.getAllByIndex('vocabularies', 'levelId', levelId); }
  async upsertVocabulary(vocab: Vocabulary): Promise<void> { await this.runTx('vocabularies', 'readwrite', s => s.put(vocab)); }

  // Circuits
  async getCircuitState(levelId: string): Promise<CircuitState[]> { return this.getAllByIndex('circuits', 'levelId', levelId); }
  async upsertCircuitState(state: CircuitState): Promise<void> { await this.runTx('circuits', 'readwrite', s => s.put(state)); }

  // Ledger Entries
  async getLedgerEntries(circuitId: string): Promise<LedgerEntry[]> { return this.getAllByIndex('ledger_entries', 'circuitId', circuitId); }
  async appendLedgerEntry(entry: LedgerEntry): Promise<void> { await this.runTx('ledger_entries', 'readwrite', s => s.put(entry)); }

  // FIXED: Engine State Methods
  async getEngineState(): Promise<{id: string, raw: string} | undefined> { 
    return this.runTx('engine_state', 'readonly', s => s.get('current')); 
  }
  async putEngineState(raw: string): Promise<void> { 
    await this.runTx('engine_state', 'readwrite', s => s.put({ id: 'current', raw })); 
  }
  async deleteEngineState(): Promise<void> { 
    await this.runTx('engine_state', 'readwrite', s => s.delete('current')); 
  }

  async factoryReset(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject();
    });
  }
}

export const vfsDb = new LedgerFS();
