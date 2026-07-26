// test/kinds.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

let fs:       typeof import('../../ledger/fs');
let ledger:   typeof import('../../ledger/grid-state');
let kindsReg: typeof import('../kinds-registry');
let seedKinds:typeof import('../seed-kinds');

async function freshImports() {
  // @ts-expect-error test-only global replacement
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  fs        = await import('../../ledger/fs');
  ledger    = await import('../../ledger/grid-state');
  kindsReg  = await import('../kinds-registry');
  seedKinds = await import('../seed-kinds');
  await fs.vfsDb.init();
}

beforeEach(freshImports);


// ─── Test 1: Seed produces the initial Kind set at World scope ────────────
describe('Kinds: initial seed', () => {
  it('cold-start seeder attaches every INITIAL_KINDS entry to every seeded World', async () => {
    await ledger.bootLedger();
    // bootLedger runs seedDatabaseIfEmpty which calls the demo seed with
    // multiple Worlds; each gets the full INITIAL_KINDS set at World scope.

    const worlds = await fs.vfsDb.getWorlds();
    expect(worlds.length).toBeGreaterThan(0);

    // For every World, we should see INITIAL_KINDS.length rows at scope='world'.
    for (const w of worlds) {
      const kinds = await fs.vfsDb.getKinds('world', w.id);
      expect(kinds.length).toBe(seedKinds.INITIAL_KINDS.length);

      // Every key is present.
      const seededKeys = kinds.map(k => k.key).sort();
      const expectedKeys = seedKinds.INITIAL_KINDS.map(k => k.key).sort();
      expect(seededKeys).toEqual(expectedKeys);

      // Engine-dispatched Kinds have empty template + engineMechanicsDoc filled.
      const engineDispatched = kinds.filter(k => k.dispatch === 'engine');
      expect(engineDispatched.length).toBe(4);   // validator, bridge, controller, paradox
      for (const k of engineDispatched) {
        expect(k.engineMechanicsDoc).toBeTruthy();
      }

      // Template-dispatched Kinds have templates filled.
      const templateDispatched = kinds.filter(k => k.dispatch === 'template');
      expect(templateDispatched.length).toBe(5);
      for (const k of templateDispatched) {
        expect(k.template).toBeTruthy();
      }
    }
  });
});

// ─── Test 2: Composition order (Project first, then World) ────────────────
describe('Kinds: composed picker', () => {
  it('composedKinds returns Project section before World section, empty sections omitted', async () => {
    await ledger.bootLedger();

    // Add a Project-scope Kind manually.
    const worlds = await fs.vfsDb.getWorlds();
    const projects = await fs.vfsDb.getProjects(worlds[0].id);
    expect(projects.length).toBeGreaterThan(0);

    const now = Date.now();
    await fs.vfsDb.upsertKind({
      id: 'project-scope-kind-001',
      scope: 'project',
      scopeId: projects[0].id,
      key: 'project-local-analysis',
      alias: 'Project Local Analysis',
      hint: 'Only visible from this Project.',
      family: 'analysis',
      dispatch: 'template',
      template: 'analyze {doc0}',
      requires: { view: true },
      createdAt: now,
      updatedAt: now,
    });

    // Cascade through by picking the World then Project explicitly.
    ledger.selectedWorldId.value = worlds[0].id;
    await new Promise(r => setTimeout(r, 30));
    ledger.selectedProjectId.value = projects[0].id;
    await new Promise(r => setTimeout(r, 30));

    const composed = kindsReg.composedKinds(
      projects[0].name,
      worlds[0].name,
    );

    // Two sections: Project (nearer) first, then World.
    expect(composed).toHaveLength(2);
    expect(composed[0].scope).toBe('project');
    expect(composed[0].scopeName).toBe(projects[0].name);
    expect(composed[0].items.map(i => i.key)).toContain('project-local-analysis');

    expect(composed[1].scope).toBe('world');
    expect(composed[1].scopeName).toBe(worlds[0].name);
    expect(composed[1].items.length).toBeGreaterThan(0);
  });

  it('omits empty scopes from composedKinds', async () => {
    await ledger.bootLedger();
    // With no Project-scope Kinds, only the World section should appear.
    const worlds = await fs.vfsDb.getWorlds();
    const projects = await fs.vfsDb.getProjects(worlds[0].id);

    ledger.selectedWorldId.value = worlds[0].id;
    await new Promise(r => setTimeout(r, 30));
    ledger.selectedProjectId.value = projects[0].id;
    await new Promise(r => setTimeout(r, 30));

    const composed = kindsReg.composedKinds(projects[0].name, worlds[0].name);
    // Only World; Project has no local Kinds.
    expect(composed).toHaveLength(1);
    expect(composed[0].scope).toBe('world');
  });
});

// ─── Test 3: Alias lookup / resolveKindAlias ──────────────────────────────
describe('Kinds: alias resolution', () => {
  it('resolveKindAlias returns alias for known key, key itself as fallback', async () => {
    await ledger.bootLedger();
    const worlds = await fs.vfsDb.getWorlds();
    const projects = await fs.vfsDb.getProjects(worlds[0].id);

    ledger.selectedWorldId.value = worlds[0].id;
    await new Promise(r => setTimeout(r, 30));
    ledger.selectedProjectId.value = projects[0].id;
    await new Promise(r => setTimeout(r, 30));

    // Known key from the initial seed.
    expect(kindsReg.resolveKindAlias('validator')).toBe('Validator');
    expect(kindsReg.resolveKindAlias('chat')).toBe('Chat');

    // Unknown key falls back to key itself.
    expect(kindsReg.resolveKindAlias('never-heard-of-this')).toBe('never-heard-of-this');

    // 'system' pseudo-kind returns 'system'.
    expect(kindsReg.resolveKindAlias('system')).toBe('system');
  });
});

// ─── Test 4: Engine-dispatch validation ───────────────────────────────────
describe('Kinds: dispatch=engine validation', () => {
  it('rejects engine-dispatched Kind whose key is not in dispatchable set', async () => {
    await ledger.bootLedger();
    const worlds = await fs.vfsDb.getWorlds();

    // Prime dispatchable with a set that does NOT include 'unauthorized'.
    kindsReg.primeDispatchableKinds(['validator', 'bridge', 'controller', 'paradox']);

    const now = Date.now();
    const bad = {
      id: 'bad-engine-kind',
      scope: 'world' as const,
      scopeId: worlds[0].id,
      key: 'unauthorized-engine-kind',
      alias: 'Bad',
      hint: '',
      family: 'instrument',
      dispatch: 'engine' as const,
      requires: {},
      createdAt: now,
      updatedAt: now,
    };
    const success = await kindsReg.upsertKindValidated(bad);
    expect(success).toBe(false);

    // Verify Console got a warn row.
    const consoleRows = await fs.vfsDb.getAllConsoleRows();
    const kindsWarns = consoleRows.filter(r => r.category === 'kinds');
    expect(kindsWarns.length).toBeGreaterThan(0);
    expect(kindsWarns[0].severity).toBe('warn');
    expect(kindsWarns[0].message).toContain('unauthorized-engine-kind');
  });

  it('accepts engine-dispatched Kind whose key IS in dispatchable set', async () => {
    await ledger.bootLedger();
    const worlds = await fs.vfsDb.getWorlds();

    // Wipe existing 'validator' Kind so we can re-upsert cleanly.
    const existing = (await fs.vfsDb.getKinds('world', worlds[0].id))
      .find(k => k.key === 'validator');
    if (existing) await fs.vfsDb.deleteKind(existing.id);

    kindsReg.primeDispatchableKinds(['validator', 'bridge', 'controller', 'paradox']);

    const now = Date.now();
    const good = {
      id: 'good-engine-kind',
      scope: 'world' as const,
      scopeId: worlds[0].id,
      key: 'validator',
      alias: 'Validator (edited)',
      hint: 'updated',
      family: 'instrument',
      dispatch: 'engine' as const,
      requires: {},
      createdAt: now,
      updatedAt: now,
    };
    const success = await kindsReg.upsertKindValidated(good);
    expect(success).toBe(true);

    const rows = await fs.vfsDb.getKinds('world', worlds[0].id);
    expect(rows.find(k => k.id === 'good-engine-kind')).toBeDefined();
  });

  it('accepts template-dispatched Kind regardless of dispatchable set state', async () => {
    await ledger.bootLedger();
    const worlds = await fs.vfsDb.getWorlds();

    // Do NOT prime — dispatchable set stays empty.
    // Template-dispatched Kinds should still upsert freely.

    const now = Date.now();
    const good = {
      id: 'template-kind-freeform',
      scope: 'world' as const,
      scopeId: worlds[0].id,
      key: 'my-custom-freeform-kind',
      alias: 'Freeform',
      hint: 'anything goes',
      family: 'analysis',
      dispatch: 'template' as const,
      template: 'do the thing with {doc0}',
      requires: {},
      createdAt: now,
      updatedAt: now,
    };
    const success = await kindsReg.upsertKindValidated(good);
    expect(success).toBe(true);
  });
});

// ─── Test 5: Alias edits propagate via lookup (no row rewrites) ───────────
describe('Kinds: alias edit propagation', () => {
  it('editing a Kind alias affects rendered display; existing Ledger rows show new alias via lookup', async () => {
    await ledger.bootLedger();
    const worlds = await fs.vfsDb.getWorlds();
    const projects = await fs.vfsDb.getProjects(worlds[0].id);
    const views = await fs.vfsDb.getViews(projects[0].id);

    ledger.selectedWorldId.value = worlds[0].id;
    await new Promise(r => setTimeout(r, 30));
    ledger.selectedProjectId.value = projects[0].id;
    await new Promise(r => setTimeout(r, 30));
    ledger.selectedViewId.value = views[0].id;
    await new Promise(r => setTimeout(r, 30));

    // Write a Ledger row using the chat Kind key.
    await ledger.beginLedgerTurn({
      kind: 'chat',
      header: '',
      body: 'hello',
      snapshot: {
        doc0Snapshot: 'hello',
        attachedDocIds: [],
        activeLanguageIds: [],
        warm: false,
      },
    });

    // Before rename: alias is 'Chat'.
    expect(kindsReg.resolveKindAlias('chat')).toBe('Chat');

    // Rename the Kind's alias.
    const worldKinds = await fs.vfsDb.getKinds('world', worlds[0].id);
    const chatKind = worldKinds.find(k => k.key === 'chat');
    expect(chatKind).toBeDefined();
    chatKind!.alias = 'General Conversation';
    chatKind!.updatedAt = Date.now();
    await fs.vfsDb.upsertKind(chatKind!);
    await kindsReg.refreshWorldKinds(worlds[0].id);

    // After rename: same key, same Ledger row, new alias via lookup.
    expect(kindsReg.resolveKindAlias('chat')).toBe('General Conversation');

    // The Ledger row itself still has kind='chat' — no row rewrite.
    const rows = await fs.vfsDb.getLedgerRows(views[0].id);
    expect(rows[0].kind).toBe('chat');
  });
});
