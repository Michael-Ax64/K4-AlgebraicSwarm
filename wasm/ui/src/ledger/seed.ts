// wasm/ui/src/ledger/seed.ts
import { vfsDb } from './fs';
import { defaultSeedData } from './seed-data';
import { World, Level, Vocabulary, CircuitState } from './schema'; // Added CircuitState

export async function seedDatabaseIfEmpty(): Promise<void> {
  const existingWorlds = await vfsDb.getWorlds();
  
  if (existingWorlds.length > 0) {
    console.log("[Ledger] VFS already initialized. Skipping seed.");
    return;
  }

  console.log("[Ledger] Cold Start detected. Seeding K4 VFS with default Worlds...");
  const now = Date.now();

  for (const wData of defaultSeedData.worlds) {
    const world: World = {
      id: wData.id,
      name: wData.name,
      description: wData.description,
      apiProvider: 'manual', // Set default to manual so the airlock tests easily
      apiKey: '',
      apiBaseUrl: '',
      createdAt: now,
      updatedAt: now
    };
    await vfsDb.upsertWorld(world);

    for (const lData of wData.levels) {
      const level: Level = {
        id: lData.id,
        worldId: world.id,
        name: lData.name,
        levelIndex: lData.levelIndex,
        omegaClock: lData.omegaClock
      };
      await vfsDb.upsertLevel(level);

      // Seed Vocabularies
      for (const vData of lData.vocabularies) {
        const vocab: Vocabulary = {
          id: crypto.randomUUID(),
          levelId: level.id,
          term: vData.term,
          k4Type: vData.k4Type as any,
          role: vData.role as any,
          description: vData.description
        };
        await vfsDb.upsertVocabulary(vocab);
      }

      // NEW: Seed Circuits
      if (lData.circuits) {
        for (const cData of lData.circuits) {
          const circuit: CircuitState = {
            id: cData.id,
            levelId: level.id,
            name: cData.name,
            activeFace: cData.activeFace as any,
            heldAbsentVar: cData.heldAbsentVar as any,
            resistanceR: cData.resistanceR,
            inductanceL: cData.inductanceL,
            capacitanceC: cData.capacitanceC,
            drivingOmega: cData.drivingOmega,
            currentCycle: cData.currentCycle
          };
          await vfsDb.upsertCircuitState(circuit);
        }
      }
    }
  }
  
  console.log("[Ledger] VFS Seeding Complete.");
}
