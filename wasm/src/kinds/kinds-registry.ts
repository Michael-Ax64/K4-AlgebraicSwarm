// wasm/src/kinds/kinds-registry.ts

import { Signal } from '../reactive';
import { vfsDb } from '../ledger/fs';
import { AppKind } from '../ledger/schema';
import { INITIAL_KINDS } from './seed-kinds';

export const systemKindsGrid = new Signal<AppKind[]>([]);
export const worldKindsGrid = systemKindsGrid;
export const projectKindsGrid = new Signal<AppKind[]>([]);
export const engineDispatchableKinds = new Signal<Set<string>>(new Set());

export interface ComposedKindSection {
  scope: 'project' | 'world';
  scopeName: string;
  items: AppKind[];
}

export function composedKinds(
  activeProjectName?: string | null,
  activeWorldName?: string | null
): ComposedKindSection[] {
  return [{
    scope: 'world',
    scopeName: 'System Flows',
    items: systemKindsGrid.value
  }];
}

export function resolveKindAlias(key: string): string {
  if (key === 'system') return 'system';
  const match = systemKindsGrid.value.find(k => k.key === key);
  return match?.alias ?? key;
}

export function resolveKind(key: string): AppKind | null {
  if (key === 'system') return null;
  return systemKindsGrid.value.find(k => k.key === key) ?? null;
}

export function primeDispatchableKinds(engineExport: unknown): void {
  if (!Array.isArray(engineExport)) return;
  const keys = engineExport.filter((x): x is string => typeof x === 'string');
  engineDispatchableKinds.value = new Set(keys);
}

export async function upsertKindValidated(kind: AppKind): Promise<boolean> {
  await vfsDb.upsertKind(kind);
  systemKindsGrid.value = await vfsDb.getAllKinds();
  return true;
}

export async function refreshWorldKinds(worldId: string | null): Promise<void> {
  await refreshKinds();
}

export async function refreshProjectKinds(projectId: string | null): Promise<void> {
  await refreshKinds();
}

export async function refreshKinds(): Promise<void> {
  let kinds = await vfsDb.getAllKinds();

  // Cold-start seed for system flows if empty
  if (kinds.length === 0) {
    const now = Date.now();
    for (const sk of INITIAL_KINDS) {
      await vfsDb.upsertKind({
        id: `kind-system-${sk.key}`,
        scope: 'world',
        scopeId: 'system',
        key: sk.key,
        alias: sk.alias,
        hint: sk.hint,
        family: sk.family,
        dispatch: sk.dispatch,
        template: sk.template,
        engineMechanicsDoc: sk.engineMechanicsDoc,
        requires: sk.requires || {},
        isSystemFlow: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    kinds = await vfsDb.getAllKinds();
  }
  systemKindsGrid.value = kinds;
}
