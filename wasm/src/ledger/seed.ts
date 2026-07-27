// wasm/src/ledger/seed.ts

import { vfsDb } from './fs';
import { CircuitNode, Vocabulary } from './schema';
import { systemSettings } from './grid-state';
import { SEED_ONTOLOGY } from './seed-data';

export async function seedDatabaseIfEmpty(): Promise<void> {
  await vfsDb.init();
  const allCircuits = await vfsDb.getAllCircuits();
  const now = Date.now();

  // 1. ENSURE DEFAULT ROOT CIRCUIT
  let defaultRoot = allCircuits.find(c => c.id === 'circ-root-default');
  if (!defaultRoot) {
    console.log('🌱 [Seed] Creating Default Root Circuit...');
    defaultRoot = {
      id: 'circ-root-default',
      priorId: null, // Root node
      specialization: 'circuit',
      name: 'Default Circuit',
      description: 'Initial neutral baseline execution circuit.',
      doc0: '',
      physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
      activeFace: 'P',
      heldAbsentVar: 'I',
      createdAt: now,
      updatedAt: now,
    };
    await vfsDb.upsertCircuit(defaultRoot);
  }

  // 2. ENSURE DEFAULT K4 LANGUAGE NODE
  let defaultLang = allCircuits.find(c => c.id === 'lang-default-k4');
  if (!defaultLang) {
    console.log('🌱 [Seed] Creating Default K4 Language...');
    defaultLang = {
      id: 'lang-default-k4',
      priorId: null, // Root sovereign language
      specialization: 'language',
      name: 'Default K4 Language',
      description: 'Universal 16-term four-pole and stance manifold lexicon.',
      doc0: '',
      physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
      activeFace: 'P',
      heldAbsentVar: 'I',
      createdAt: now,
      updatedAt: now,
    };
    await vfsDb.upsertLanguage(defaultLang);
  }

  // 3. SEED ALL 16 FUNDAMENTAL TERMS FOR DEFAULT K4 LANGUAGE
  const existingVocab = await vfsDb.getVocabulary('lang-default-k4');
  if (existingVocab.length < 16) {
    console.log('🌱 [Seed] Populating full 16 K4 terms for Default K4 Language...');
    const seed16Terms = [
      // 4 Primary Poles
      { id: 'vocab-p-core', term: 'Drive / Fire', k4Type: 'P', role: 'SPEC', description: 'Generative intent, purpose, urgency, and active drive.' },
      { id: 'vocab-u-core', term: 'Structure / Air', k4Type: 'U', role: 'SPEC', description: 'Frameworks, architectures, patterns, and structural potential.' },
      { id: 'vocab-i-core', term: 'Flow / Water', k4Type: 'I', role: 'MATERIAL', description: 'Active process, throughput, integration, and relational current.' },
      { id: 'vocab-r-core', term: 'Ground / Earth', k4Type: 'R', role: 'SPEC', description: 'Physical constraints, friction, technical debt, and ground truth.' },

      // 12 Stance Equations
      { id: 'vocab-eq1', term: 'Leverage (P = U² / R)', k4Type: 'P', role: 'SPEC', description: 'Structural multiplication overcoming ground resistance.' },
      { id: 'vocab-eq2', term: 'Momentum (P = I² × R)', k4Type: 'P', role: 'SPEC', description: 'Relational flow grinding through friction to force result.' },
      { id: 'vocab-eq3', term: 'Synthesis (P = U × I)', k4Type: 'P', role: 'SPEC', description: 'Harmonious union of blueprint and flow generating drive.' },
      { id: 'vocab-eq4', term: 'Yield (I = √(P/R))', k4Type: 'I', role: 'MATERIAL', description: 'Root draw extracted from drive against friction.' },
      { id: 'vocab-eq5', term: 'Extraction (I = P / U)', k4Type: 'I', role: 'MATERIAL', description: 'Relational flow derived by dividing drive by structure.' },
      { id: 'vocab-eq6', term: 'Ohmic (I = U / R)', k4Type: 'I', role: 'MATERIAL', description: 'Direct throughput produced by structural potential over resistance.' },
      { id: 'vocab-eq7', term: 'Tension (U = P / I)', k4Type: 'U', role: 'SPEC', description: 'Structural potential suspended between drive and flow.' },
      { id: 'vocab-eq8', term: 'Architecture (U = I × R)', k4Type: 'U', role: 'SPEC', description: 'Grounding structure built by flow meeting resistance.' },
      { id: 'vocab-eq9', term: 'Capacity (U = √(P×R))', k4Type: 'U', role: 'SPEC', description: 'Geometric storage potential balancing drive and ground.' },
      { id: 'vocab-eq10', term: 'Impedance (R = U / I)', k4Type: 'R', role: 'SPEC', description: 'Analysis paralysis: excess structure blocking flow.' },
      { id: 'vocab-eq11', term: 'Accounting (R = U² / P)', k4Type: 'R', role: 'SPEC', description: 'Bureaucratic bloat: squared structure draining drive.' },
      { id: 'vocab-eq12', term: 'Brittleness (R = P / I²)', k4Type: 'R', role: 'SPEC', description: 'Material fracture: raw drive collapsing without flow.' }
    ];

    for (const t of seed16Terms) {
      await vfsDb.upsertVocabulary({
        id: t.id,
        languageId: 'lang-default-k4',
        term: t.term,
        k4Type: t.k4Type as any,
        role: t.role as any,
        description: t.description
      });
    }
  }

  // 4. ENSURE LINK FROM DEFAULT CIRCUIT -> DEFAULT LANGUAGE
  const selections = await vfsDb.getCircuitLangSelections(defaultRoot.id);
  if (!selections.some(s => s.languageId === 'lang-default-k4')) {
    await vfsDb.upsertCircuitLangSelection({
      id: `${defaultRoot.id}:lang-default-k4`,
      circuitId: defaultRoot.id,
      languageId: 'lang-default-k4',
      active: true
    });
  }

  // Auto-seed files ONLY if explicitly enabled in global settings (Default: OFF)
  if (systemSettings.peek().autoLoadSeedData) {
    await runSeedImport(systemSettings.peek().seedDataFileNames);
  }
}

export async function runSeedImport(fileNames: string): Promise<void> {
  console.log(`🌱 [Seed Engine] Executing manual seed import for files: ${fileNames}...`);
  const now = Date.now();

  for (const w of SEED_ONTOLOGY.worlds) {
    const worldNode: CircuitNode = {
      id: w.id,
      priorId: null,
      specialization: 'world',
      specializationData: {
        apiProvider: 'manual',
        apiKey: '',
        apiBaseUrl: '',
        worldDirectives: w.description || ''
      },
      name: w.name,
      description: w.description,
      doc0: '',
      physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
      activeFace: 'P',
      heldAbsentVar: 'I',
      createdAt: now,
      updatedAt: now,
    };
    await vfsDb.upsertCircuit(worldNode);

    for (const lang of (w.languages || [])) {
      const langNode: CircuitNode = {
        id: lang.id,
        priorId: w.id,
        specialization: 'language',
        name: lang.name,
        description: lang.description || '',
        doc0: '',
        physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
        activeFace: 'P',
        heldAbsentVar: 'I',
        createdAt: now,
        updatedAt: now,
      };
      await vfsDb.upsertLanguage(langNode);

      for (const v of (lang.vocabularies || [])) {
        await vfsDb.upsertVocabulary({
          id: `vocab-${lang.id}-${v.k4Type.toLowerCase()}`,
          languageId: lang.id,
          term: v.term,
          k4Type: v.k4Type,
          role: v.role,
          description: v.description || ''
        });
      }

      await vfsDb.upsertCircuitLangSelection({
        id: `${w.id}:${lang.id}`,
        circuitId: w.id,
        languageId: lang.id,
        active: true
      });
    }
  }

  console.log('🌱 [Seed Engine] Import completed successfully.');
}
