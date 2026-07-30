// wasm/src/ledger/grid-state.ts

import { Signal, createEffect } from '../reactive';
import { vfsDb } from './fs';
import {
  CircuitNode, Vocabulary, CircuitDocOverride, CircuitLangSelection,
  AppKind, LedgerRow, ConsoleRow, SystemSettings, ConsoleSeverity,
  WorldSettings, DocumentPayload
} from './schema';
import { seedDatabaseIfEmpty } from './seed';
import { refreshKinds } from '../kinds/kinds-registry';

// ─── ACTIVE SOVEREIGN SPACE ────────────────────────────────────────────────
export type SovereignSpace = 'circuits' | 'documents' | 'languages';
export const activeSovereignSpace = new Signal<SovereignSpace>('circuits');

// ─── SIDEBAR VISIBILITY STATE ──────────────────────────────────────────────
export const sidebarCollapsed = new Signal<boolean>(false);

// ─── UNIFIED STATE SIGNALS ─────────────────────────────────────────────────
export const selectedCircuitId = new Signal<string | null>(null);
export const activeCircuit = new Signal<CircuitNode | null>(null);

export const selectedLanguageId = new Signal<string | null>(null);
export const selectedDocumentId = new Signal<string | null>(null);

// Sovereign Domain Grids
export const circuitsGrid = new Signal<CircuitNode[]>([]);
export const languagesGrid = new Signal<CircuitNode[]>([]);
export const documentsGrid = new Signal<CircuitNode[]>([]);

// Sovereign Domain Trash Counters
export const circuitTrashCount = new Signal<number>(0);
export const languageTrashCount = new Signal<number>(0);
export const documentTrashCount = new Signal<number>(0);
export const trashCount = circuitTrashCount; // Alias

// Re-Homing Freeze Mode State
export const rehomingState = new Signal<{
  active: boolean;
  sourceId: string | null;
}>({ active: false, sourceId: null });

// Workspace Active Selections for Selected Circuit
export const activeCircuitLangs = new Signal<CircuitLangSelection[]>([]);
export const activeCircuitDocOverrides = new Signal<CircuitDocOverride[]>([]);
export const vocabGrid = new Signal<Vocabulary[]>([]);
export const ledgerGrid = new Signal<LedgerRow[]>([]);
export const consoleGrid = new Signal<ConsoleRow[]>([]);
export const globalConsoleGrid = new Signal<ConsoleRow[]>([]);

// Lineage Ancestor State
export const activeCircuitLineage = new Signal<CircuitNode[]>([]);
export const activeWorldNode = new Signal<CircuitNode | null>(null);

// System Settings
export const systemSettings = new Signal<SystemSettings>({
  autoLoadSeedData: false,
  seedDataFileNames: 'seed-data.json',
  telemetryMaxEntries: 0
});

// // EXPIRED Backwards-compatibility Aliases  USER WILL DELETE MANUALLY.
// export const activeProject = activeCircuit;
// export const activeView = activeCircuit;
// export const activeWorldConfig = activeCircuit;

// export const selectedWorldId = selectedCircuitId;
// export const selectedProjectId = selectedCircuitId;
// export const selectedViewId = selectedCircuitId;

// export const worldsGrid = circuitsGrid;
// export const projectsGrid = circuitsGrid;
// export const viewsGrid = circuitsGrid;
// export const projectCircuitsGrid = circuitsGrid;
// export const circuitGrid = circuitsGrid;

// export const worldLanguagesGrid = languagesGrid;
// export const globalLanguagesGrid = languagesGrid;
// export const worldDocumentsGrid = documentsGrid;
// export const globalDocumentsGrid = documentsGrid;

// export const viewLangSelectionsGrid = activeCircuitLangs;
// export const viewDocOverridesGrid = activeCircuitDocOverrides;



// THIS FILE CONTAINS FUTURE WORK, NOT YET USED HERE.
// keep namings current and keep the functions.
// e.g.: markLedgerAnswerKept(circuitId, rowId)
//       editLedgerRow(id, patch)
// also -- keep comments up to date, do not remove them!



// ─── BOOT LEDGER FROM DATABASE ─────────────────────────────────────────────
export async function bootLedger(): Promise<void> {
  await vfsDb.init();
  
  const savedSettings = await vfsDb.getSettings();
  if (savedSettings) systemSettings.value = savedSettings;

  await seedDatabaseIfEmpty();
  await refreshAllGrids();
  await refreshKinds();
  await recalculateTrashCounters();

  if (circuitsGrid.value.length > 0 && !selectedCircuitId.value) {
    const activeFirst = circuitsGrid.value.find(c => c.priorId !== '__TRASH__');
    if (activeFirst) selectedCircuitId.value = activeFirst.id;
  }
}

export async function recalculateTrashCounters(): Promise<void> {
  const allNodes = await vfsDb.getAllCircuits();

  const cNodes = allNodes.filter(c => ['circuit', 'world', 'project', 'view'].includes(c.specialization));
  const lNodes = allNodes.filter(c => c.specialization === 'language');
  const dNodes = allNodes.filter(c => c.specialization === 'document');

  circuitTrashCount.value = cNodes.filter(c => c.priorId === '__TRASH__').length;
  languageTrashCount.value = lNodes.filter(c => c.priorId === '__TRASH__').length;
  documentTrashCount.value = dNodes.filter(c => c.priorId === '__TRASH__').length;
}

export async function refreshAllGrids(): Promise<void> {
  const allNodes = await vfsDb.getAllCircuits();

  const cNodes = allNodes.filter(c => ['circuit', 'world', 'project', 'view'].includes(c.specialization));
  const lNodes = allNodes.filter(c => c.specialization === 'language');
  const dNodes = allNodes.filter(c => c.specialization === 'document');

  circuitsGrid.value = cNodes;
  languagesGrid.value = lNodes;
  documentsGrid.value = dNodes;

  globalConsoleGrid.value = await vfsDb.getAllConsoleRows();
}

// ─── CASCADE: ACTIVE CIRCUIT RESOLUTION & RECURSIVE LINEAGE ─────────────────
createEffect(() => {
  const cId = selectedCircuitId.value;
  if (!cId) {
    activeCircuit.value = null;
    activeCircuitLineage.value = [];
    activeWorldNode.value = null;
    activeCircuitLangs.value = [];
    activeCircuitDocOverrides.value = [];
    ledgerGrid.value = [];
    consoleGrid.value = [];
    return;
  }

  resolveCircuitLineage(cId).then(async ({ lineage, activeCircuit: current, worldNode }) => {
    activeCircuit.value = current || null;
    activeCircuitLineage.value = lineage;
    activeWorldNode.value = worldNode || null;

    if (!current) return;

    const [langs, docOvers, ledger, console_] = await Promise.all([
      vfsDb.getCircuitLangSelections(cId),
      vfsDb.getCircuitDocOverrides(cId),
      vfsDb.getLedgerRows(cId),
      vfsDb.getConsoleRows(cId)
    ]);

    activeCircuitLangs.value = langs;
    activeCircuitDocOverrides.value = docOvers;
    ledgerGrid.value = ledger;
    consoleGrid.value = console_;
  });
});

// ─── RECURSIVE LINEAGE RESOLUTION ───────────────────────────────────────────
export async function resolveCircuitLineage(circuitId: string) {
  let current = await vfsDb.getCircuit(circuitId);
  const lineage: CircuitNode[] = [];
  const visited = new Set<string>();

  while (current && current.priorId !== '__TRASH__' && !visited.has(current.id)) {
    visited.add(current.id);
    lineage.push(current);
    current = current.priorId ? await vfsDb.getCircuit(current.priorId) : undefined;
  }

  const nearestWorld = lineage.find(c => c.specialization === 'world');
  const apiConfig = nearestWorld?.specializationData;

  return { lineage, activeCircuit: lineage[0], worldNode: nearestWorld, apiConfig };
}

// ─── COMPOSABLE HELPERS FOR WORKSPACE PANELS ───────────────────────────────
export function composedDocuments() {
  return [{
    scope: 'world' as const,
    scopeName: 'Sovereign Master Documents',
    items: documentsGrid.value
  }];
}

export function composedLanguages() {
  return [{
    scope: 'world' as const,
    scopeName: 'Sovereign Languages',
    items: languagesGrid.value
  }];
}

export function resolvedInclusionForActiveView() {
  const docs = documentsGrid.value;
  const overrides = activeCircuitDocOverrides.value;
  
  return docs.map(d => {
    const ov = overrides.find(o => o.documentId === d.id);
    const dPayload: DocumentPayload = d.documentData || {
      content: d.doc0 || '',
      defaultA: true, defaultP: false, defaultU: false, defaultI: false, defaultR: false,
      kind: 'source'
    };
    return {
      document: d,
      A: ov?.A ?? dPayload.defaultA,
      P: ov?.P ?? dPayload.defaultP,
      U: ov?.U ?? dPayload.defaultU,
      I: ov?.I ?? dPayload.defaultI,
      R: ov?.R ?? dPayload.defaultR,
      overridden: !!ov
    };
  });
}

export async function setViewDocOverride(documentId: string, column: 'A' | 'P' | 'U' | 'I' | 'R', value: boolean | null): Promise<void> {
  const cId = selectedCircuitId.peek();
  if (!cId) return;

  let row = activeCircuitDocOverrides.peek().find(r => r.documentId === documentId);
  if (!row) {
    row = { id: crypto.randomUUID(), circuitId: cId, documentId, A: null, P: null, U: null, I: null, R: null };
  }
  row[column] = value;
  await vfsDb.upsertCircuitDocOverride(row);
  activeCircuitDocOverrides.value = await vfsDb.getCircuitDocOverrides(cId);
}

export async function clearAllViewDocOverrides(): Promise<void> {
  const cId = selectedCircuitId.peek();
  if (!cId) return;
  const rows = await vfsDb.getCircuitDocOverrides(cId);
  for (const r of rows) await vfsDb.deleteCircuitDocOverride(r.id);
  activeCircuitDocOverrides.value = [];
}

// ─── RE-HOMING ACTIONS ──────────────────────────────────────────────────────
export function startRehoming(circuitId: string) { rehomingState.value = { active: true, sourceId: circuitId }; }
export function cancelRehoming() { rehomingState.value = { active: false, sourceId: null }; }

export async function executeRehome(targetCircuitId: string | null) {
  const sourceId = rehomingState.value.sourceId;
  if (!sourceId) return;

  const node = await vfsDb.getCircuit(sourceId);
  if (node) {
    const oldPrior = node.priorId;
    node.priorId = targetCircuitId;
    node.updatedAt = Date.now();
    await vfsDb.upsertCircuit(node);

    if (node.specialization === 'language') {
      if (oldPrior === '__TRASH__' && targetCircuitId !== '__TRASH__') languageTrashCount.value--;
      if (oldPrior !== '__TRASH__' && targetCircuitId === '__TRASH__') languageTrashCount.value++;
    } else if (node.specialization === 'document') {
      if (oldPrior === '__TRASH__' && targetCircuitId !== '__TRASH__') documentTrashCount.value--;
      if (oldPrior !== '__TRASH__' && targetCircuitId === '__TRASH__') documentTrashCount.value++;
    } else {
      if (oldPrior === '__TRASH__' && targetCircuitId !== '__TRASH__') circuitTrashCount.value--;
      if (oldPrior !== '__TRASH__' && targetCircuitId === '__TRASH__') circuitTrashCount.value++;
    }

    await refreshAllGrids();
  }
  cancelRehoming();
}

// ─── DELETE / TRASH ACTIONS ─────────────────────────────────────────────────
export async function deleteCircuitToTrash(circuitId: string) {
  const node = await vfsDb.getCircuit(circuitId);
  if (!node || node.priorId === '__TRASH__') return;

  node.priorId = '__TRASH__';
  node.updatedAt = Date.now();
  await vfsDb.upsertCircuit(node);

  if (node.specialization === 'language') languageTrashCount.value++;
  else if (node.specialization === 'document') documentTrashCount.value++;
  else circuitTrashCount.value++;

  await refreshAllGrids();
}

export async function purgeCircuitPermanent(circuitId: string) {
  const node = await vfsDb.getCircuit(circuitId);
  if (!node) return;

  if (node.priorId === '__TRASH__') {
    if (node.specialization === 'language') languageTrashCount.value--;
    else if (node.specialization === 'document') documentTrashCount.value--;
    else circuitTrashCount.value--;
  }

  await vfsDb.purgeCircuit(circuitId);
  await refreshAllGrids();

  // Auto-repick to preserve the "always at least one Circuit selected" invariant.
  // The rule (per operator spec): try another trash item first (operator stays in
  // trash view); else the first root (priorId === null); else instantiate the
  // default root and pick that. Language and Document selections just null out —
  // they have their own selection signals and don't share this invariant.
  if (selectedCircuitId.peek() === circuitId) {
    const grid = circuitsGrid.peek();
    const nextTrash = grid.find(c => c.priorId === '__TRASH__' && c.id !== circuitId);
    if (nextTrash) {
      selectedCircuitId.value = nextTrash.id;
    } else {
      const firstRoot = grid.find(c => c.priorId === null && c.id !== circuitId);
      if (firstRoot) {
        selectedCircuitId.value = firstRoot.id;
      } else {
        // Nothing left — re-seed and pick the reconstituted default.
        await seedDatabaseIfEmpty();
        await refreshAllGrids();
        const seeded = circuitsGrid.peek().find(c => c.priorId === null);
        selectedCircuitId.value = seeded?.id ?? null;
      }
    }
  }
  if (selectedLanguageId.peek() === circuitId) selectedLanguageId.value = null;
  if (selectedDocumentId.peek() === circuitId) selectedDocumentId.value = null;
}

// ─── LEDGER & CONSOLE LOGGING ───────────────────────────────────────────────
export async function beginLedgerTurn(params: {
  circuitId?: string;
  kind: string;
  direction: 'out' | 'in' | 'system';
  header: string;
  body: string;
  snapshot: {
    doc0Snapshot: string;
    attachedDocIds: string[];
    activeLanguageIds: string[];
    lineagePath: string[];
    warm: boolean;
  };
  parentTurnId?: string;
}): Promise<LedgerRow | null> {
  const cId = params.circuitId || selectedCircuitId.peek();
  if (!cId) return null;

  const turnNumber = await vfsDb.getNextLedgerTurnNumber(cId);
  const now = Date.now();
  const row: LedgerRow = {
    id: `led-${now}-${Math.random().toString(36).substring(2, 7)}`,
    circuitId: cId,
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
    lineagePath: params.snapshot.lineagePath,
    warm: params.snapshot.warm,
    createdAt: now,
    updatedAt: now,
  };
  await vfsDb.upsertLedgerRow(row);
  ledgerGrid.value = await vfsDb.getLedgerRows(cId);
  return row;
}

export async function appendConsoleRow(params: {
  circuitId?: string | null;
  severity: ConsoleSeverity;
  category: string;
  message: string;
}): Promise<ConsoleRow> {
  const now = Date.now();
  const cId = params.circuitId !== undefined ? params.circuitId : selectedCircuitId.peek();
  const row: ConsoleRow = {
    id: `con-${now}-${Math.random().toString(36).substring(2, 7)}`,
    circuitId: cId,
    severity: params.severity,
    category: params.category,
    message: params.message,
    createdAt: now,
    updatedAt: now,
  };
  await vfsDb.upsertConsoleRow(row);

  if (cId === selectedCircuitId.peek()) {
    consoleGrid.value = await vfsDb.getConsoleRows(cId);
  }
  globalConsoleGrid.value = await vfsDb.getAllConsoleRows();
  return row;
}

export async function updateActiveCircuitDoc0(newDoc0: string): Promise<void> {
  const circ = activeCircuit.peek();
  if (!circ) return;
  const updated: CircuitNode = { ...circ, doc0: newDoc0, updatedAt: Date.now() };
  await vfsDb.upsertCircuit(updated);
  activeCircuit.value = updated;
  await refreshAllGrids();
}


export async function markLedgerAnswerKept(circuitId: string, rowId: string): Promise<void> {
  const rows = await vfsDb.getLedgerRows(circuitId);
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
  ledgerGrid.value = await vfsDb.getLedgerRows(circuitId);
}

export async function editLedgerRow(id: string, patch: Partial<LedgerRow>): Promise<void> {
  const cId = selectedCircuitId.peek();
  if (!cId) return;
  const existing = await vfsDb.getLedgerRow(id);
  if (!existing) return;
  const updated: LedgerRow = { ...existing, ...patch, updatedAt: Date.now() };
  await vfsDb.upsertLedgerRow(updated);
  ledgerGrid.value = await vfsDb.getLedgerRows(cId);
}

export async function addVocabTerm(term: string, k4Type: any, role: any, languageId: string): Promise<void> {
  await vfsDb.upsertVocabulary({
    id: crypto.randomUUID(),
    languageId,
    term,
    k4Type,
    role,
    description: ''
  });
  if (selectedLanguageId.peek() === languageId) {
    vocabGrid.value = await vfsDb.getVocabulary(languageId);
  }
}
