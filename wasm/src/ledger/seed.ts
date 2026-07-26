// wasm/src/ledger/seed.ts
//
// ============================================================================
// COLD-START SEEDER — populates a fresh IndexedDB with a demonstration ontology
// ============================================================================
//
// Runs once on first launch (when `worlds` is empty). Populates the full new
// tier: Worlds, Projects, Views, Languages (World/Project/View-scoped),
// Vocabularies, Documents (World+Project-scoped, with A/P/U/I/R defaults),
// and initial ViewLangSelection rows so the seeded Views land ready to run.
//
// ─── SURGICAL-OP RULES ──────────────────────────────────────────────────────
//
// * Seed data is DEMONSTRATION, not test fixtures. It's what a new user sees.
//   Every seeded row should teach the tier structure: at least one Project
//   with multiple Views, at least one Document at each scope, at least one
//   ViewDocOverride showing the override pattern, at least one View-scoped
//   Language showing that Languages can live below World.
// * Circuit seeding is BACK. The legacy demonstration Worlds (World 0-6)
//   ship their 12-stance sets so existing examples remain functional under
//   the new tier. The EXEMPLAR World (Cartography) still ships no Circuits
//   — it teaches the tier, not the stance mapping. When the Circuits-as-
//   project-identity conversation lands, the legacy shape may be rebuilt;
//   until then, keep the seed's Circuit output compatible with
//   screens/circuit.ts.
// * Every seeded View gets its innate AC coordinates. These are View identity.
// * Every seeded Document sets defaults deliberately — do not blanket-ly set
//   defaultA=true. The demo teaches inclusion; that requires visible variance.
//
// ============================================================================

import { vfsDb } from './fs';
import { SEED_ONTOLOGY } from './seed-data';
import {
  World, Project, View, Language, Vocabulary,
  Document, ViewLangSelection, Circuit
} from './schema';


export async function seedDatabaseIfEmpty(): Promise<void> {
  const existing = await vfsDb.getWorlds();
  if (existing.length > 0) return;   // Not cold — leave the user's data alone.

  console.log('🌱 [Seed] Cold DB detected. Populating demonstration ontology...');
  const now = Date.now();

  for (const w of SEED_ONTOLOGY.worlds) {
    // World
    const world: World = {
      id: w.id,
      name: w.name,
      description: w.description,
      apiProvider: 'manual',
      apiKey: '',
      apiBaseUrl: '',
      createdAt: now,
      updatedAt: now,
    };
    await vfsDb.upsertWorld(world);

    // World-scope Languages
    for (const lang of (w.languages || [])) {
      const language: Language = {
        id: lang.id,
        scope: 'world',
        scopeId: w.id,
        name: lang.name,
        description: lang.description,
        createdAt: now,
        updatedAt: now,
      };
      await vfsDb.upsertLanguage(language);

      for (const v of (lang.vocabularies || [])) {
        const vocab: Vocabulary = {
          id: crypto.randomUUID(),
          languageId: lang.id,
          term: v.term,
          k4Type: v.k4Type,
          role: v.role,
          description: v.description || '',
        };
        await vfsDb.upsertVocabulary(vocab);
      }
    }

    // World-scope Documents
    for (const d of (w.documents || [])) {
      const doc: Document = {
        id: d.id,
        ownerScope: 'world',
        ownerId: w.id,
        name: d.name,
        content: d.content,
        defaultA: d.defaultA ?? false,
        defaultP: d.defaultP ?? false,
        defaultU: d.defaultU ?? false,
        defaultI: d.defaultI ?? false,
        defaultR: d.defaultR ?? false,
        kind: d.kind ?? 'source',
        createdAt: now,
        updatedAt: now,
      };
      await vfsDb.upsertDocument(doc);
    }

    // Projects (and their inner Languages, Documents, Views)
    for (const p of (w.projects || [])) {
      const project: Project = {
        id: p.id,
        worldId: w.id,
        name: p.name,
        description: p.description,
        createdAt: now,
        updatedAt: now,
      };
      await vfsDb.upsertProject(project);

      // Project-scope Languages
      for (const lang of (p.languages || [])) {
        const language: Language = {
          id: lang.id,
          scope: 'project',
          scopeId: p.id,
          name: lang.name,
          description: lang.description,
          createdAt: now,
          updatedAt: now,
        };
        await vfsDb.upsertLanguage(language);

        for (const v of (lang.vocabularies || [])) {
          const vocab: Vocabulary = {
            id: crypto.randomUUID(),
            languageId: lang.id,
            term: v.term,
            k4Type: v.k4Type,
            role: v.role,
            description: v.description || '',
          };
          await vfsDb.upsertVocabulary(vocab);
        }
      }

      // Project-scope Documents
      for (const d of (p.documents || [])) {
        const doc: Document = {
          id: d.id,
          ownerScope: 'project',
          ownerId: p.id,
          name: d.name,
          content: d.content,
          defaultA: d.defaultA ?? false,
          defaultP: d.defaultP ?? false,
          defaultU: d.defaultU ?? false,
          defaultI: d.defaultI ?? false,
          defaultR: d.defaultR ?? false,
          kind: d.kind ?? 'source',
          createdAt: now,
          updatedAt: now,
        };
        await vfsDb.upsertDocument(doc);
      }

      // Views under this Project
      for (const v of (p.views || [])) {
        const view: View = {
          id: v.id,
          projectId: p.id,
          name: v.name,
          description: v.description || '',
          doc0: v.doc0 || '',
          innateOmega: v.innateOmega,
          innateR: v.innateR,
          innateL: v.innateL,
          innateC: v.innateC,
          createdAt: now,
          updatedAt: now,
        };
        await vfsDb.upsertView(view);

        // View-scope Languages (if any)
        for (const lang of (v.languages || [])) {
          const language: Language = {
            id: lang.id,
            scope: 'view',
            scopeId: v.id,
            name: lang.name,
            description: lang.description,
            createdAt: now,
            updatedAt: now,
          };
          await vfsDb.upsertLanguage(language);

          for (const voc of (lang.vocabularies || [])) {
            const vocab: Vocabulary = {
              id: crypto.randomUUID(),
              languageId: lang.id,
              term: voc.term,
              k4Type: voc.k4Type,
              role: voc.role,
              description: voc.description || '',
            };
            await vfsDb.upsertVocabulary(vocab);
          }
        }

        // Initial ViewLangSelections: whatever the seed marks as active.
        for (const activeLangId of (v.activeLanguageIds || [])) {
          const sel: ViewLangSelection = {
            id: crypto.randomUUID(),
            viewId: v.id,
            languageId: activeLangId,
            active: true,
          };
          await vfsDb.upsertViewLangSelection(sel);
        }

        // Legacy Circuits attached to this View. Shape unchanged from prior
        // schema — the Circuits-as-project-identity conversation will
        // eventually reshape these; until then screens/circuit.ts continues
        // to read them by viewId.
        for (const c of (v.circuits || [])) {
          const circuit: Circuit = {
            id: c.id,
            viewId: v.id,
            name: c.name,
            activeFace: c.activeFace,
            heldAbsentVar: c.heldAbsentVar,
            omega: c.omega,
            r: c.r,
            l: c.l,
            c: c.c,
            diagnosticVocab: c.diagnosticVocab,
            rewardQuestion: c.rewardQuestion,
          };
          await vfsDb.upsertCircuit(circuit);
        }
      }
    }
  }

  console.log('🌱 [Seed] Demonstration ontology populated.');
}
