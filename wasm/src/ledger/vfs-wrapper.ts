// wasm/src/ledger/vfs-wrapper.ts

import { vfsDb } from './fs';
import { CircuitNode, DocumentPayload } from './schema';
import {
  selectedCircuitId, resolveCircuitLineage, activeCircuit,
  refreshAllGrids, resolvedInclusionForActiveView
} from './grid-state';

export interface ResolvedVocabTerm {
  term: string;
  k4Type: string;
  role: string;
  description: string;
}

export interface ResolvedManifest {
  circuitId: string;
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
    lineagePath: string[];
    warm: boolean;
  };
}

export class LedgerVFS {
  static async buildResolvedManifest(kindKey: string = 'chat', warm: boolean = false): Promise<ResolvedManifest | null> {
    const cId = selectedCircuitId.peek();
    if (!cId) return null;

    const { lineage, activeCircuit: currentCircuit } = await resolveCircuitLineage(cId);
    if (!currentCircuit) return null;

    const lineageIds = lineage.map(c => c.id);

    // 1. EXPLICIT 5-COLUMN GRID INCLUSION
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
        const dPayload: DocumentPayload = inc.document.documentData || {
          content: inc.document.doc0 || '',
          defaultA: true, defaultP: false, defaultU: false, defaultI: false, defaultR: false,
          kind: 'source'
        };

        docs.push({
          id: inc.document.id,
          name: inc.document.name,
          content: dPayload.content || inc.document.doc0 || '',
          poles,
        });
      }
    }

    // 2. EXPLICIT LANGUAGE OVERRIDE RESOLUTION ACROSS LINEAGE
    const activeLangIds = new Set<string>();
    const rootToLeafLineage = lineage.slice().reverse();

    for (const node of rootToLeafLineage) {
      const sels = await vfsDb.getCircuitLangSelections(node.id);
      for (const s of sels) {
        if (s.active) {
          activeLangIds.add(s.languageId);
        } else {
          activeLangIds.delete(s.languageId);
        }
      }
    }

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
      circuitId: currentCircuit.id,
      doc0: currentCircuit.doc0,
      kind: kindKey,
      warm,
      documents: docs,
      vocabulary: vocabularies,
      snapshot: {
        doc0Snapshot: currentCircuit.doc0,
        attachedDocIds: docs.map(d => d.id),
        activeLanguageIds: Array.from(activeLangIds),
        lineagePath: lineageIds,
        warm,
      },
    };
  }

  async saveDocumentNode(
    name: string,
    content: string,
    defaults: { A?: boolean; P?: boolean; U?: boolean; I?: boolean; R?: boolean },
    id?: string,
    kind: 'source' | 'derived' = 'source',
    description?: string
  ): Promise<CircuitNode> {
    const activeC = activeCircuit.peek();
    const now = Date.now();

    const existingNode = id ? await vfsDb.getCircuit(id) : undefined;

    const docNode: CircuitNode = {
      id: id || `doc-${now}-${Math.random().toString(36).substring(2, 7)}`,
      priorId: existingNode ? existingNode.priorId : (activeC ? activeC.id : null),
      specialization: 'document',
      name,
      description: description !== undefined ? description : (existingNode?.description || ''),
      doc0: content,
      physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
      activeFace: 'P',
      heldAbsentVar: 'I',
      documentData: {
        content,
        defaultA: defaults.A ?? false,
        defaultP: defaults.P ?? false,
        defaultU: defaults.U ?? false,
        defaultI: defaults.I ?? false,
        defaultR: defaults.R ?? false,
        kind,
      },
      createdAt: existingNode?.createdAt || now,
      updatedAt: now,
    };

    await vfsDb.upsertCircuit(docNode);
    await refreshAllGrids();
    return docNode;
  }

  async deleteDocument(id: string): Promise<void> {
    const node = await vfsDb.getCircuit(id);
    if (node) {
      node.priorId = '__TRASH__';
      await vfsDb.upsertCircuit(node);
      await refreshAllGrids();
    }
  }
}

export const ledgerVfs = new LedgerVFS();
