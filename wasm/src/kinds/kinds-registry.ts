// wasm/src/kinds/kinds-registry.ts
//
// ============================================================================
// KIND REGISTRY — REACTIVE LAYER OVER `kinds` STORE
// ============================================================================
//
// Reads Kinds out of IndexedDB into Signals, composes them across scopes for
// the picker, validates dispatch=engine keys against what the Rust engine
// actually exports, and provides the lookup surface the Ledger uses to
// render Kind aliases on row display.
//
// Follows the same pattern as Languages and Documents:
//   - per-scope Signals (worldKinds, projectKinds)
//   - a composed selector (composedKinds) returning ordered ComposedSection
//     with header dividers
//   - grid-state.ts cascades update these Signals on World/Project change
//
// ─── ENGINE-DISPATCHABLE VALIDATION ─────────────────────────────────────────
//
// A Kind with `dispatch: 'engine'` must have its `key` in the set the Rust
// engine actually exports. On boot, we call `engine.dispatchable_kinds()`
// once and cache the result. Every upsert of an engine-dispatched Kind
// validates against it — mismatch produces a Console warn and the row is
// rejected. This is data-integrity gating; it does NOT prevent the operator
// from CREATING a Kind, only from marking it engine-dispatched with an
// invalid key.
//
// If the engine is not booted (Wasm not yet loaded, boot failure, etc.),
// the dispatchable set is empty and all engine-dispatch upserts are rejected
// until engine boot completes. Seeds fire after engine boot.
//
// ─── SURGICAL-OP RULES ──────────────────────────────────────────────────────
//
// * Do NOT bypass upsertKindValidated when creating engine-dispatched Kinds.
//   Direct vfsDb.upsertKind is legal for template-dispatched Kinds only.
// * The Ledger renders row alias via `resolveKindAlias(key)` — a synchronous
//   lookup against the composed cache. Do NOT fetch from IndexedDB per row.
// * When the operator edits a Kind's alias, the change propagates to all
//   existing Ledger rows via the reactive lookup. No row-level rewrites.
// * Composed order in the picker: Project first (nearest scope), then World.
//   Header dividers per section.
//
// ============================================================================

// wasm/src/kinds/kinds-registry.ts

import { Signal } from '../reactive';
import { vfsDb } from '../ledger/fs';
import { AppKind } from '../ledger/schema';
import { appendConsoleRow } from '../ledger/grid-state';
import { INITIAL_KINDS } from './seed-kinds';

export const worldKindsGrid = new Signal<AppKind[]>([]);
export const projectKindsGrid = new Signal<AppKind[]>([]);
export const engineDispatchableKinds = new Signal<Set<string>>(new Set());

export interface ComposedKindSection {
  scope: 'project' | 'world';
  scopeName: string;
  items: AppKind[];
}

export function composedKinds(
  activeProjectName: string | null,
  activeWorldName: string | null
): ComposedKindSection[] {
  const sections: ComposedKindSection[] = [];
  if (activeProjectName && projectKindsGrid.value.length > 0) {
    sections.push({ scope: 'project', scopeName: activeProjectName, items: projectKindsGrid.value });
  }
  if (activeWorldName && worldKindsGrid.value.length > 0) {
    sections.push({ scope: 'world', scopeName: activeWorldName, items: worldKindsGrid.value });
  }
  return sections;
}

export function resolveKindAlias(key: string): string {
  if (key === 'system') return 'system';
  const all = [...projectKindsGrid.value, ...worldKindsGrid.value];
  const match = all.find(k => k.key === key);
  return match?.alias ?? key;
}

export function resolveKind(key: string): AppKind | null {
  if (key === 'system') return null;
  const all = [...projectKindsGrid.value, ...worldKindsGrid.value];
  return all.find(k => k.key === key) ?? null;
}

export function primeDispatchableKinds(engineExport: unknown): void {
  if (!Array.isArray(engineExport)) {
    console.warn('[Kinds] engine.dispatchable_kinds() returned non-array; cache stays empty');
    return;
  }
  const keys = engineExport.filter((x): x is string => typeof x === 'string');
  engineDispatchableKinds.value = new Set(keys);
}

export async function upsertKindValidated(kind: AppKind): Promise<boolean> {
  if (kind.dispatch === 'engine') {
    if (!engineDispatchableKinds.value.has(kind.key)) {
      await appendConsoleRow({
        viewId: null,
        severity: 'warn',
        category: 'kinds',
        message: `Kind '${kind.key}' marked dispatch='engine' but is not in engine.dispatchable_kinds(). Rejected.`,
      });
      return false;
    }
  }
  await vfsDb.upsertKind(kind);
  if (kind.scope === 'world') {
    worldKindsGrid.value = await vfsDb.getKinds('world', kind.scopeId);
  } else {
    projectKindsGrid.value = await vfsDb.getKinds('project', kind.scopeId);
  }
  return true;
}

export async function refreshWorldKinds(worldId: string | null): Promise<void> {
  if (!worldId) {
    worldKindsGrid.value = [];
    return;
  }
  let kinds = await vfsDb.getKinds('world', worldId);

  // Self-Healing Auto-Seed if World has no Kinds populated
  if (kinds.length === 0) {
    const now = Date.now();
    for (const sk of INITIAL_KINDS) {
      await vfsDb.upsertKind({
        id: `kind-${worldId}-${sk.key}`,
        scope: 'world',
        scopeId: worldId,
        key: sk.key,
        alias: sk.alias,
        hint: sk.hint,
        family: sk.family,
        dispatch: sk.dispatch,
        template: sk.template,
        engineMechanicsDoc: sk.engineMechanicsDoc,
        requires: sk.requires || {},
        createdAt: now,
        updatedAt: now,
      });
    }
    kinds = await vfsDb.getKinds('world', worldId);
  }
  worldKindsGrid.value = kinds;
}

export async function refreshProjectKinds(projectId: string | null): Promise<void> {
  projectKindsGrid.value = projectId ? await vfsDb.getKinds('project', projectId) : [];
}

