// wasm/src/ledger/world-frame-state.ts
//
// ============================================================================
// WORLD FRAME STATE REGISTRY — per-frame per-World UI scratch persistence
// ============================================================================
//
// UI frames that want their state persisted across World switches register
// here at boot (or later, on-demand). Registration supplies two functions:
//
//   getWorldState(): unknown       — called on World-OUT (framework serializes)
//   setWorldState(state: unknown)  — called on World-IN  (framework rehydrates)
//
// Nothing else. There is no `save()`, no debounce, no dirty flag, no unload
// hook. The database is always live. Persistence fires ONLY when the active
// World changes.
//
// ─── LIFECYCLE ──────────────────────────────────────────────────────────────
//
// `bootLedger()` calls `mountWorldFrameState()` once, AFTER Signals exist and
// BEFORE the boot World is selected. That call binds a createEffect on
// `selectedWorldId`. On change from `prev` to `next`:
//
//   1. For every registered frame:
//         try   frame.getWorldState()  → JSON.stringify → upsert row keyed
//                                        by (prev, frameKey)
//         catch                        → log to Console; skip; other frames
//                                        continue unaffected
//
//   2. For every registered frame:
//         fetch row (next, frameKey)   → JSON.parse
//         try   frame.setWorldState(s) → frame rehydrates
//         catch                        → log; skip; others continue
//
// A frame registering AFTER the app has already selected a World is not
// disadvantaged: `registerWorldFrame` immediately fetches the current World's
// row for that frameKey and calls setWorldState if a row exists. If no row
// exists yet, the frame starts with its own default state, and on next
// World-out its getWorldState will be captured.
//
// ─── SURGICAL-OP RULES ──────────────────────────────────────────────────────
//
// * The registry is a module-level Map. Frame keys are strings; conflicts
//   overwrite silently (last registration wins). Choose descriptive keys.
// * Errors in getWorldState or setWorldState MUST be caught per-frame.
//   Never allow one frame's bug to block others' persistence.
// * Do NOT introduce migration or versioning here. If a frame's stored state
//   shape drifts from what its setWorldState expects, the FRAME is defensive
//   (validates, ignores unknowns, supplies defaults). See schema.ts.
// * Do NOT auto-persist on state mutation. The database is live at row level
//   for schema-typed data (Ledger, Console, Docs, etc.). Frame scratch is
//   captured only at World-boundary events, by design.
// * Unregistering a frame does NOT delete its stored row. Rows persist so a
//   re-registering frame (e.g. after hot-reload) picks up where it left off.
//   Point-deletion happens via `vfsDb.deleteWorldFrameState` — Phase 4 wires
//   this to the per-frame "reset" affordance.
//
// ============================================================================

import { createEffect } from '../reactive';
import { selectedWorldId } from './grid-state';
import { vfsDb } from './fs';
import { appendConsoleRow } from './grid-state';

// ─── PUBLIC TYPES ───────────────────────────────────────────────────────────

/**
 * Adapter registered by a frame. Both functions are optional at the type
 * level — a frame that only wants to be rehydrated (never resaved) may omit
 * getWorldState; a frame that only wants to save (never rehydrate — unusual)
 * may omit setWorldState. In practice most frames supply both.
 */
export interface WorldFrameAdapter {
  getWorldState?: () => unknown;
  setWorldState?: (state: unknown) => void;
}

/** Handle returned by `registerWorldFrame`. Call to unregister. */
export type WorldFrameHandle = () => void;

// ─── INTERNAL STATE ─────────────────────────────────────────────────────────

const registry = new Map<string, WorldFrameAdapter>();

/**
 * The World id the registry believes is "currently in". Tracked so we can
 * pass `prev` to the save phase during a change. Starts null; the first
 * `selectedWorldId.value` transition treats prev as null (no save phase).
 */
let currentWorldId: string | null = null;

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Register a frame's persistence adapter. If a World is already selected,
 * the frame's setWorldState is called immediately with any stored row
 * (or skipped if no row exists yet — the frame keeps its own defaults).
 *
 * Returns an unregister function. Unregistering does NOT delete stored data.
 */
export function registerWorldFrame(
  frameKey: string,
  adapter: WorldFrameAdapter
): WorldFrameHandle {
  registry.set(frameKey, adapter);

  // If a World is already active, immediately dispatch stored state to this
  // late-registering frame. Boot-time frames also flow through here.
  if (currentWorldId !== null && adapter.setWorldState) {
    const worldId = currentWorldId;
    vfsDb.getWorldFrameState(worldId, frameKey).then(row => {
      if (!row) return;
      try {
        const parsed = JSON.parse(row.stateJson);
        adapter.setWorldState!(parsed);
      } catch (err) {
        logFrameError('set (on-register)', frameKey, err);
      }
    }).catch(err => {
      logFrameError('fetch (on-register)', frameKey, err);
    });
  }

  return () => {
    // Only remove if this exact adapter is still the current registration
    // (a hot-reload might have replaced it under the same key).
    if (registry.get(frameKey) === adapter) {
      registry.delete(frameKey);
    }
  };
}

// ─── MOUNT ──────────────────────────────────────────────────────────────────

/**
 * Called once from bootLedger() AFTER Signals exist and BEFORE the boot
 * World is selected. Binds the createEffect that drives save/load on every
 * World transition.
 *
 * Idempotent-guarded: repeated calls do not add duplicate effects. In
 * practice bootLedger only calls this once; the guard is belt-and-braces.
 */
let mounted = false;
export function mountWorldFrameState(): void {
  if (mounted) return;
  mounted = true;

  createEffect(() => {
    const next = selectedWorldId.value;

    // No transition: initial evaluation before any world is selected, or the
    // Signal fired without a change. Nothing to do either way.
    if (next === currentWorldId) return;

    const prev = currentWorldId;
    currentWorldId = next;

    (async () => {
      if (prev !== null) {
        await saveAll(prev);
      }
      if (next !== null) {
        await loadAll(next);
      }
    })().catch(err => {
      // The per-frame try/catch inside save/loadAll should have swallowed
      // frame-specific errors already; anything reaching here is registry-
      // level (JSON parse of the whole batch, IndexedDB unreachable, etc.)
      // and is logged best-effort.
      logFrameError('world-change', '<registry>', err);
    });
  });
}

// ─── INTERNAL — SAVE PHASE ──────────────────────────────────────────────────

async function saveAll(worldId: string): Promise<void> {
  for (const [frameKey, adapter] of registry) {
    if (!adapter.getWorldState) continue;

    let state: unknown;
    try {
      state = adapter.getWorldState();
    } catch (err) {
      logFrameError('get', frameKey, err);
      continue;
    }

    let json: string;
    try {
      json = JSON.stringify(state);
    } catch (err) {
      logFrameError('stringify', frameKey, err);
      continue;
    }

    try {
      await vfsDb.upsertWorldFrameState(worldId, frameKey, json);
    } catch (err) {
      logFrameError('upsert', frameKey, err);
    }
  }
}

// ─── INTERNAL — LOAD PHASE ──────────────────────────────────────────────────

async function loadAll(worldId: string): Promise<void> {
  let rows: Awaited<ReturnType<typeof vfsDb.getWorldFrameStates>>;
  try {
    rows = await vfsDb.getWorldFrameStates(worldId);
  } catch (err) {
    logFrameError('fetch-all', '<registry>', err);
    return;
  }

  const byKey = new Map(rows.map(r => [r.frameKey, r]));

  for (const [frameKey, adapter] of registry) {
    if (!adapter.setWorldState) continue;
    const row = byKey.get(frameKey);
    if (!row) continue;  // no stored state yet for this frame + this World

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.stateJson);
    } catch (err) {
      logFrameError('parse', frameKey, err);
      continue;
    }

    try {
      adapter.setWorldState(parsed);
    } catch (err) {
      logFrameError('set', frameKey, err);
    }
  }
}

// ─── INTERNAL — ERROR REPORTING ─────────────────────────────────────────────

/**
 * A frame-level error surfaces as a Console row (severity=warn). It is
 * non-fatal — the registry continues with the next frame.
 *
 * The Console message is intentionally terse. The full error is `console.warn`-ed
 * to the browser console for developer inspection.
 */
function logFrameError(phase: string, frameKey: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  console.warn(`[WorldFrameState:${phase}:${frameKey}]`, err);
  // Best-effort — if Console write itself fails, we don't cascade.
  appendConsoleRow({
    viewId: null,
    severity: 'warn',
    category: 'ui-state',
    message: `Frame '${frameKey}' failed during ${phase}: ${detail}`,
  }).catch(() => { /* swallow — cannot report */ });
}
