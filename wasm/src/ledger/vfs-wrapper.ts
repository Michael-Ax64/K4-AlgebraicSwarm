// wasm/src/ledger/vfs-wrapper.ts
//
// ============================================================================
// LEDGER VFS WRAPPER — Virtual File System & Manifest Resolver
// ============================================================================

import { vfsDb } from './fs';
import { Document, View, Project } from './schema';
import {
  resolvedInclusionForActiveView, activeViewSignal,
  selectedWorldIdSignal, selectedProjectIdSignal
} from './grid-state';

export interface ResolvedDocFile {
  id: string;
  name: string;
  content: string;
  ownerScope: 'world' | 'project';
  poles: ('A' | 'P' | 'U' | 'I' | 'R')[];
}

export interface ResolvedVocabTerm {
  term: string;
  k4Type: string;
  role: string;
  description: string;
}

export interface ResolvedManifest {
  viewId: string;
  doc0: string;
  kind: string;
  warm: boolean;
  documents: {
    id: string;
    name: string;
    content: string;
    poles: ('A' | 'P' | 'U' | 'I' | 'R')[];
  }[];
  vocabulary: ResolvedVocabTerm[];
  snapshot: {
    doc0Snapshot: string;
    attachedDocIds: string[];
    activeLanguageIds: string[];
    warm: boolean;
  };
}

export interface ResolvedVfsManifest {
  viewId: string;
  projectId: string;
  worldId: string;
  doc0: string;
  domainContext: string;
  documentation: Record<string, string>;
  distilled: {
    P: Record<string, string>;
    U: Record<string, string>;
    I: Record<string, string>;
    R: Record<string, string>;
  };
  braidContext: {
    lastStance: string | null;
    legalFacets: number[];
  };
}

export class LedgerVFS {
  /**
   * Build complete ResolvedManifest payload for Wasm or template execution (Phase 2).
   */
  static async buildResolvedManifest(kindKey: string = 'chat', warm: boolean = false): Promise<ResolvedManifest | null> {
    const activeView = activeViewSignal.value;
    const worldId = selectedWorldIdSignal.value;
    const projectId = selectedProjectIdSignal.value;

    if (!activeView || !worldId || !projectId) return null;

    // 1. Resolve Document Inclusions (5-Column Axis)
    const inclusions = resolvedInclusionForActiveView();
    const docs: ResolvedManifest['documents'] = [];

    for (const inc of inclusions) {
      const poles: ('A' | 'P' | 'U' | 'I' | 'R')[] = [];
      if (inc.A) poles.push('A');
      if (inc.P) poles.push('P');
      if (inc.U) poles.push('U');
      if (inc.I) poles.push('I');
      if (inc.R) poles.push('R');

      if (poles.length > 0) {
        docs.push({
          id: inc.document.id,
          name: inc.document.name,
          content: inc.document.content,
          poles,
        });
      }
    }

    // 2. Resolve Active Vocabulary Context from ticked Languages
    const langSelections = await vfsDb.getViewLangSelections(activeView.id);
    const activeLangIds = langSelections.filter(s => s.active).map(s => s.languageId);

    const vocabularies: ResolvedVocabTerm[] = [];
    for (const langId of activeLangIds) {
      const terms = await vfsDb.getVocabulary(langId);
      for (const t of terms) {
        vocabularies.push({
          term: t.term,
          k4Type: t.k4Type,
          role: t.role,
          description: t.description || '',
        });
      }
    }

    return {
      viewId: activeView.id,
      doc0: activeView.doc0,
      kind: kindKey,
      warm,
      documents: docs,
      vocabulary: vocabularies,
      snapshot: {
        doc0Snapshot: activeView.doc0,
        attachedDocIds: docs.map(d => d.id),
        activeLanguageIds: activeLangIds,
        warm,
      },
    };
  }

  /**
   * Legacy VFS Manifest compiler for backward-compatibility.
   */
  async compileManifest(viewId: string): Promise<ResolvedVfsManifest> {
    const view = await vfsDb.getView(viewId);
    if (!view) throw new Error(`[LedgerVFS] View '${viewId}' not found.`);

    const project = await vfsDb.runTx<Project>('projects', 'readonly', s => s.get(view.projectId));
    const worldId = project ? project.worldId : '';

    const inclusions = resolvedInclusionForActiveView();
    const documentation: Record<string, string> = {};
    const distilled: ResolvedVfsManifest['distilled'] = { P: {}, U: {}, I: {}, R: {} };

    for (const inc of inclusions) {
      const doc = inc.document;
      if (inc.A) {
        documentation[doc.name] = doc.content;
      } else {
        if (inc.P) distilled.P[doc.name] = doc.content;
        if (inc.U) distilled.U[doc.name] = doc.content;
        if (inc.I) distilled.I[doc.name] = doc.content;
        if (inc.R) distilled.R[doc.name] = doc.content;
      }
    }

    const langSelections = await vfsDb.getViewLangSelections(viewId);
    const activeLangIds = langSelections.filter(s => s.active).map(s => s.languageId);

    const vocabTerms: any[] = [];
    for (const langId of activeLangIds) {
      const vocabs = await vfsDb.getVocabulary(langId);
      vocabTerms.push(...vocabs);
    }

    let domainContext = '';
    if (vocabTerms.length > 0) {
      domainContext = vocabTerms
        .map(v => `- ${v.term} [${v.k4Type}] (${v.role}): ${v.description || 'No description'}`)
        .join('\n');
    }

    const rows = await vfsDb.getLedgerRows(viewId);
    const lastPtr = [...rows].reverse().find(r => r.ptrStance);

    return {
      viewId,
      projectId: view.projectId,
      worldId,
      doc0: view.doc0,
      domainContext,
      documentation,
      distilled,
      braidContext: {
        lastStance: lastPtr?.ptrStance || null,
        legalFacets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
    };
  }

  /**
   * Save or update a document at owner scope (World or Project).
   * Called by `src/screens/doc-editor.ts`.
   */
  async saveDocument(
    ownerScope: 'world' | 'project',
    ownerId: string,
    name: string,
    content: string,
    defaults: { A?: boolean; P?: boolean; U?: boolean; I?: boolean; R?: boolean },
    id?: string,
    kind: 'source' | 'derived' = 'source'
  ): Promise<Document> {
    const now = Date.now();
    const doc: Document = {
      id: id || `doc-${now}-${Math.random().toString(36).substring(2, 7)}`,
      ownerScope,
      ownerId,
      name,
      content,
      defaultA: defaults.A ?? false,
      defaultP: defaults.P ?? false,
      defaultU: defaults.U ?? false,
      defaultI: defaults.I ?? false,
      defaultR: defaults.R ?? false,
      kind,
      createdAt: now,
      updatedAt: now,
    };
    await vfsDb.upsertDocument(doc);
    return doc;
  }

  /**
   * Delete a document from owner scope.
   */
  async deleteDocument(id: string): Promise<void> {
    await vfsDb.deleteDocument(id);
  }
}

export const ledgerVfs = new LedgerVFS();

