// wasm/src/ledger/grid-state.ts

import { Signal, createEffect, computed } from '../reactive';
import { vfsDb } from './fs';
import {
  World, Project, View, Language, Vocabulary,
  Document, ViewDocOverride, ViewLangSelection, AppKind,
  LedgerRow, ConsoleRow, Circuit, K4Type, ElementRole,
  ConsoleSeverity
} from './schema';
import { seedDatabaseIfEmpty } from './seed';
import { mountWorldFrameState } from './world-frame-state';
import {
  refreshWorldKinds, refreshProjectKinds,
  worldKindsGrid, projectKindsGrid
} from '../kinds/kinds-registry';

// ─── SELECTION SIGNALS ──────────────────────────────────────────────────────
export const selectedWorldId = new Signal<string | null>(null);
export const selectedProjectId = new Signal<string | null>(null);
export const selectedViewId = new Signal<string | null>(null);

export const selectedDocumentId = new Signal<string | null>(null);
export const selectedLanguageId = new Signal<string | null>(null);

// ─── WORLD-LEVEL SIGNALS ────────────────────────────────────────────────────
export const worldsGrid = new Signal<World[]>([]);
export const activeWorldConfig = new Signal<World | null>(null);
export const worldLanguagesGrid = new Signal<Language[]>([]);
export const worldDocumentsGrid = new Signal<Document[]>([]);

// ─── PROJECT-LEVEL SIGNALS ──────────────────────────────────────────────────
export const projectsGrid = new Signal<Project[]>([]);
export const activeProject = new Signal<Project | null>(null);
export const projectLanguagesGrid = new Signal<Language[]>([]);
export const projectDocumentsGrid = new Signal<Document[]>([]);

// ─── VIEW-LEVEL SIGNALS ─────────────────────────────────────────────────────
export const viewsGrid = new Signal<View[]>([]);
export const activeView = new Signal<View | null>(null);
export const viewLanguagesGrid = new Signal<Language[]>([]);
export const viewLangSelectionsGrid = new Signal<ViewLangSelection[]>([]);
export const viewDocOverridesGrid = new Signal<ViewDocOverride[]>([]);

export const ledgerGrid = new Signal<LedgerRow[]>([]);
export const ledgerRowsSignal = ledgerGrid;

export const consoleGrid = new Signal<ConsoleRow[]>([]);
export const globalConsoleGrid = new Signal<ConsoleRow[]>([]);

export const vocabGrid = new Signal<Vocabulary[]>([]);
export const circuitGrid = new Signal<Circuit[]>([]);

export const selectedWorldIdSignal = selectedWorldId;
export const selectedProjectIdSignal = selectedProjectId;
export const selectedViewIdSignal = selectedViewId;
export const activeViewSignal = activeView;

// ─── BOOT ───────────────────────────────────────────────────────────────────
export async function bootLedger(): Promise<void> {
  await vfsDb.init();
  await seedDatabaseIfEmpty();
  worldsGrid.value = await vfsDb.getWorlds();
  globalConsoleGrid.value = await vfsDb.getAllConsoleRows();

  mountWorldFrameState();

  if (worldsGrid.value.length > 0) {
    selectedWorldId.value = worldsGrid.value[0].id;
  }
}

// ─── CASCADE: WORLD ─────────────────────────────────────────────────────────
createEffect(() => {
  const wId = selectedWorldId.value;
  if (!wId) {
    activeWorldConfig.value = null;
    projectsGrid.value = [];
    worldLanguagesGrid.value = [];
    worldDocumentsGrid.value = [];
    selectedProjectId.value = null;
    refreshWorldKinds(null);
    return;
  }
  activeWorldConfig.value = worldsGrid.value.find(w => w.id === wId) ?? null;
  refreshWorldKinds(wId);

  Promise.all([
    vfsDb.getProjects(wId),
    vfsDb.getAllLanguages(),
    vfsDb.getWorldLangSelections(wId),
    vfsDb.getDocuments('world', wId),
  ]).then(async ([projects, allLangs, worldSels, docs]) => {
    // Keep World assigned languages as assigned across startups/imports
    const activeLangIds = new Set(worldSels.filter(s => s.active).map(s => s.languageId));
    worldLanguagesGrid.value = allLangs.filter(l => activeLangIds.has(l.id));
    worldDocumentsGrid.value = docs;

    // Auto-create & auto-open Project if none exists
    if (projects.length === 0) {
      const now = Date.now();
      const mainProject: Project = {
        id: `proj-${wId}-main`,
        worldId: wId,
        name: 'Main',
        description: 'Default Main Project',
        createdAt: now,
        updatedAt: now,
      };
      await vfsDb.upsertProject(mainProject);
      projectsGrid.value = [mainProject];
      selectedProjectId.value = mainProject.id;
    } else {
      projectsGrid.value = projects;
      if (!selectedProjectId.peek() || !projects.some(p => p.id === selectedProjectId.peek())) {
        selectedProjectId.value = projects[0].id;
      }
    }
  });
});

// ─── CASCADE: PROJECT ───────────────────────────────────────────────────────
createEffect(() => {
  const pId = selectedProjectId.value;
  if (!pId) {
    activeProject.value = null;
    viewsGrid.value = [];
    projectLanguagesGrid.value = [];
    projectDocumentsGrid.value = [];
    selectedViewId.value = null;
    refreshProjectKinds(null);
    return;
  }
  activeProject.value = projectsGrid.value.find(p => p.id === pId) ?? null;
  refreshProjectKinds(pId);

  Promise.all([
    vfsDb.getViews(pId),
    vfsDb.getLanguages('project', pId),
    vfsDb.getDocuments('project', pId),
  ]).then(([views, langs, docs]) => {
    viewsGrid.value = views;
    projectLanguagesGrid.value = langs;
    projectDocumentsGrid.value = docs;
    if (!selectedViewId.peek() && views.length > 0) {
      selectedViewId.value = views[0].id;
    }
  });
});

// ─── CASCADE: VIEW ──────────────────────────────────────────────────────────
createEffect(() => {
  const vId = selectedViewId.value;
  if (!vId) {
    activeView.value = null;
    viewLanguagesGrid.value = [];
    viewLangSelectionsGrid.value = [];
    viewDocOverridesGrid.value = [];
    ledgerGrid.value = [];
    consoleGrid.value = [];
    circuitGrid.value = [];
    return;
  }
  activeView.value = viewsGrid.value.find(v => v.id === vId) ?? null;
  Promise.all([
    vfsDb.getLanguages('view', vId),
    vfsDb.getViewLangSelections(vId),
    vfsDb.getViewDocOverrides(vId),
    vfsDb.getLedgerRows(vId),
    vfsDb.getConsoleRows(vId),
    vfsDb.getCircuits(vId),
  ]).then(([langs, langSels, docOvers, ledger, console_, circuits]) => {
    viewLanguagesGrid.value = langs;
    viewLangSelectionsGrid.value = langSels;
    viewDocOverridesGrid.value = docOvers;
    ledgerGrid.value = ledger;
    consoleGrid.value = console_;
    circuitGrid.value = circuits;
  });
});

// ─── CASCADE: VOCABULARY ───────────────────────────────────────────────────
createEffect(() => {
  const lId = selectedLanguageId.value;
  if (!lId) {
    vocabGrid.value = [];
    return;
  }
  vfsDb.getVocabulary(lId).then(v => vocabGrid.value = v);
});

// ─── COMPOSITE VIEWS & WRITES ───────────────────────────────────────────────
export interface ComposedSection<T> {
  scope: 'view' | 'project' | 'world';
  scopeName: string;
  items: T[];
}

export function composedLanguages(): ComposedSection<Language>[] {
  const sections: ComposedSection<Language>[] = [];
  const view = activeView.value;
  const project = activeProject.value;
  const world = activeWorldConfig.value;

  if (view && viewLanguagesGrid.value.length > 0) {
    sections.push({ scope: 'view', scopeName: view.name, items: viewLanguagesGrid.value });
  }
  if (project && projectLanguagesGrid.value.length > 0) {
    sections.push({ scope: 'project', scopeName: project.name, items: projectLanguagesGrid.value });
  }
  if (world && worldLanguagesGrid.value.length > 0) {
    sections.push({ scope: 'world', scopeName: world.name, items: worldLanguagesGrid.value });
  }
  return sections;
}

export function composedDocuments(): ComposedSection<Document>[] {
  const sections: ComposedSection<Document>[] = [];
  const project = activeProject.value;
  const world = activeWorldConfig.value;

  if (project && projectDocumentsGrid.value.length > 0) {
    sections.push({ scope: 'project', scopeName: project.name, items: projectDocumentsGrid.value });
  }
  if (world && worldDocumentsGrid.value.length > 0) {
    sections.push({ scope: 'world', scopeName: world.name, items: worldDocumentsGrid.value });
  }
  return sections;
}

export async function beginLedgerTurn(params: {
  viewId?: string;
  kind: string;
  direction: 'out' | 'in' | 'system';
  header: string;
  body: string;
  snapshot: {
    doc0Snapshot: string;
    attachedDocIds: string[];
    activeLanguageIds: string[];
    warm: boolean;
  };
  parentTurnId?: string;
}): Promise<LedgerRow | null> {
  const vId = params.viewId || selectedViewId.peek();
  if (!vId) return null;

  const turnNumber = await vfsDb.getNextLedgerTurnNumber(vId);
  const now = Date.now();
  const row: LedgerRow = {
    id: `led-${now}-${Math.random().toString(36).substring(2, 7)}`,
    viewId: vId,
    turnNumber,
    seq: 1,
    parentId: params.parentTurnId,
    kind: params.kind,
    direction: params.direction,
    header: params.header,
    body: params.body,
    kept: params.direction === 'in',
    doc0Snapshot: params.snapshot.doc0Snapshot,
    attachedDocIds: params.snapshot.attachedDocIds,
    activeLanguageIds: params.snapshot.activeLanguageIds,
    warm: params.snapshot.warm,
    createdAt: now,
    updatedAt: now,
  };
  await vfsDb.upsertLedgerRow(row);
  ledgerGrid.value = await vfsDb.getLedgerRows(vId);
  return row;
}

export async function appendConsoleRow(params: {
  viewId?: string | null;
  severity: ConsoleSeverity;
  category: string;
  message: string;
}): Promise<ConsoleRow> {
  const now = Date.now();
  const vId = params.viewId !== undefined ? params.viewId : selectedViewId.peek();
  const row: ConsoleRow = {
    id: `con-${now}-${Math.random().toString(36).substring(2, 7)}`,
    viewId: vId,
    severity: params.severity,
    category: params.category,
    message: params.message,
    createdAt: now,
    updatedAt: now,
  };
  await vfsDb.upsertConsoleRow(row);

  const activeVId = selectedViewId.peek();
  if (vId === activeVId) {
    consoleGrid.value = await vfsDb.getConsoleRows(activeVId);
  }
  globalConsoleGrid.value = await vfsDb.getAllConsoleRows();
  return row;
}

export interface ResolvedInclusion {
  document: Document;
  A: boolean; P: boolean; U: boolean; I: boolean; R: boolean;
  overridden: boolean;
}

export function resolvedInclusionForActiveView(): ResolvedInclusion[] {
  const sections = composedDocuments();
  const overrides = viewDocOverridesGrid.value;
  const out: ResolvedInclusion[] = [];

  for (const section of sections) {
    for (const doc of section.items) {
      const override = overrides.find(o => o.documentId === doc.id);
      const pick = <K extends 'A'|'P'|'U'|'I'|'R'>(k: K): boolean => {
        if (override && override[k] !== null && override[k] !== undefined) {
          return override[k] as boolean;
        }
        return (doc as any)['default' + k] as boolean;
      };
      out.push({
        document: doc,
        A: pick('A'), P: pick('P'), U: pick('U'), I: pick('I'), R: pick('R'),
        overridden: !!override,
      });
    }
  }
  return out;
}

export async function setViewDocOverride(
  documentId: string,
  column: 'A' | 'P' | 'U' | 'I' | 'R',
  value: boolean | null
): Promise<void> {
  const vId = selectedViewId.peek();
  if (!vId) return;

  let row = viewDocOverridesGrid.value.find(r => r.documentId === documentId);
  if (!row) {
    row = {
      id: crypto.randomUUID(),
      viewId: vId,
      documentId,
      A: null, P: null, U: null, I: null, R: null,
    };
  }
  row[column] = value;

  const allNull = row.A === null && row.P === null && row.U === null && row.I === null && row.R === null;
  if (allNull) {
    await vfsDb.deleteViewDocOverride(row.id);
  } else {
    await vfsDb.upsertViewDocOverride(row);
  }
  viewDocOverridesGrid.value = await vfsDb.getViewDocOverrides(vId);
}

export async function clearAllViewDocOverrides(): Promise<void> {
  const vId = selectedViewId.peek();
  if (!vId) return;
  await vfsDb.clearViewDocOverrides(vId);
  viewDocOverridesGrid.value = [];
}

export async function updateActiveViewDoc0(newDoc0: string): Promise<void> {
  const view = activeView.peek();
  if (!view) return;
  const updated: View = { ...view, doc0: newDoc0, updatedAt: Date.now() };
  await vfsDb.upsertView(updated);
  activeView.value = updated;
  viewsGrid.value = viewsGrid.value.map(v => v.id === updated.id ? updated : v);
}

export async function markLedgerAnswerKept(viewId: string, rowId: string): Promise<void> {
  const rows = await vfsDb.getLedgerRows(viewId);
  const target = rows.find(r => r.id === rowId);
  if (!target) return;

  for (const r of rows) {
    if (r.turnNumber === target.turnNumber && r.direction === 'in') {
      const isTarget = r.id === rowId;
      if (r.kept !== isTarget) {
        r.kept = isTarget;
        r.updatedAt = Date.now();
        await vfsDb.upsertLedgerRow(r);
      }
    }
  }
  ledgerGrid.value = await vfsDb.getLedgerRows(viewId);
}

export async function editLedgerRow(
  id: string,
  patch: Partial<Pick<LedgerRow,
    'header' | 'body' | 'doc0Snapshot' | 'attachedDocIds' |
    'activeLanguageIds' | 'warm' | 'kept' |
    'ptrCycle' | 'ptrSeq' | 'ptrStance' | 'ptrHealth' | 'ptrSnapshotJson'
  >>
): Promise<void> {
  const vId = selectedViewId.peek();
  if (!vId) return;
  const existing = await vfsDb.getLedgerRow(id);
  if (!existing) return;
  const updated: LedgerRow = { ...existing, ...patch, updatedAt: Date.now() };
  await vfsDb.upsertLedgerRow(updated);
  ledgerGrid.value = await vfsDb.getLedgerRows(vId);
}

export async function addVocabTerm(
  term: string,
  k4Type: K4Type,
  role: ElementRole,
  languageId: string
): Promise<void> {
  await vfsDb.upsertVocabulary({
    id: crypto.randomUUID(),
    languageId,
    term,
    k4Type,
    role,
    description: '',
  });
  if (selectedLanguageId.peek() === languageId) {
    vocabGrid.value = await vfsDb.getVocabulary(languageId);
  }
}
