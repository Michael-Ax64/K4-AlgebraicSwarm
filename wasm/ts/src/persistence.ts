// wasm/ui/src/persistence.ts
//
// The Rust engine exposes `engine.vfs_state` as an opaque JSON string. This
// module is the only place that string is read from or written to the
// browser's IndexedDB, and the only place that publishes state-change
// notifications so the Database management tab can re-render.
//
// The shape of the JSON blob is owned by Rust and MUST be treated as
// opaque here. The Semantic Ledger (Worlds, Levels, Vocabularies,
// Circuits, PTRs) lives in the same IndexedDB but in its own object
// stores; see `./ledger/fs.ts`.

import { vfsDb } from './ledger/fs';
import { enginePersistedAt } from './state';

/**
 * Return the last persisted VFS snapshot, or "{}" for a cold start.
 * Async because it may need to open the IndexedDB connection first.
 */
export async function loadVfs(): Promise<string> {
  try {
    const row = await vfsDb.getEngineState();
    return row && row.raw.length > 0 ? row.raw : '{}';
  } catch (err) {
    console.warn('[persistence] loadVfs failed:', err);
    return '{}';
  }
}

/**
 * Persist the engine's current VFS snapshot. Called after every engine
 * step from `syncEngineState`. Fires a signal notification on success so
 * the Database tab and any other watcher can refresh.
 *
 * Silently no-ops on failure — the engine loop must not crash because
 * durable storage is unavailable.
 */
export async function persistVfs(raw: string): Promise<void> {
  if (typeof raw !== 'string' || raw.length === 0) return;
  try {
    await vfsDb.putEngineState(raw);
    enginePersistedAt.value = Date.now();
  } catch (err) {
    console.warn('[persistence] persistVfs failed:', err);
  }
}

/**
 * Delete the persisted engine state. Called from the top-bar Reset
 * button and from the Database management tab. Callers are responsible
 * for reloading the page afterwards if they want the in-memory engine
 * to actually reset — this function only touches storage.
 */
export async function clearVfs(): Promise<void> {
  try {
    await vfsDb.deleteEngineState();
    enginePersistedAt.value = Date.now();
  } catch (err) {
    console.warn('[persistence] clearVfs failed:', err);
  }
}
