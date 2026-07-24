// wasm/src/ledger/seed.ts

import { vfsDb } from './fs';
import { defaultSeedData } from './seed-data';

export async function seedDatabaseIfEmpty(): Promise<void> {
  const existingWorlds = await vfsDb.getWorlds();

  if (existingWorlds.length > 10) {
    console.log('[Ledger] VFS already initialized. Skipping seed.');
    return;
  }

  console.log('[Ledger] Cold Start detected. Seeding K4 VFS with default Worlds...');
  const now = Date.now();

  for (const wData of defaultSeedData.worlds) {
    await vfsDb.upsertWorld({
      id: wData.id,
      name: wData.name,
      description: wData.description,
      apiProvider: 'manual', 
      apiKey: '',
      apiBaseUrl: '',
      persistCorpus: true,
      createdAt: now,
      updatedAt: now,
    });

    for (const lData of wData.languages) {
      await vfsDb.upsertLanguage({
        id: lData.id,
        worldId: wData.id,
        name: lData.name,
        description: ''
      });

      for (const vData of lData.vocabularies) {
        await vfsDb.upsertVocabulary({
          id: crypto.randomUUID(),
          languageId: lData.id,
          term: vData.term,
          k4Type: vData.k4Type as any,
          role: vData.role as any,
          description: vData.description,
        });
      }
    }

    if (wData.views) {
      for (const vData of wData.views) {
        await vfsDb.upsertView({
          id: vData.id,
          worldId: wData.id,
          languageId: vData.languageId,
          name: vData.name,
          description: vData.description,
          innateOmega: vData.innateOmega,
          innateR: vData.innateR,
          innateL: vData.innateL,
          innateC: vData.innateC
        });
      }
    }

    if (wData.circuits) {
      for (const cData of wData.circuits) {
        await vfsDb.upsertCircuit({
          id: cData.id,
          viewId: cData.viewId,
          name: cData.name,
          activeFace: cData.activeFace as any,
          heldAbsentVar: cData.heldAbsentVar as any,
          omega: cData.omega,
          r: cData.r,
          l: cData.l,
          c: cData.c,
          diagnosticVocab: cData.diagnosticVocab || [],
          rewardQuestion: cData.rewardQuestion || ''
        });
      }
    }
  }

  console.log('[Ledger] VFS Seeding Complete.');
}
