# The TypeScript Host

`src/` is the environment the Rust kernel yields into. It owns the LLM network calls, the browser storage, the DOM, and everything that has a lifecycle longer than a single turn — but it does not own the algebra. The algebra is Rust's. The host provides the space for it to breathe.

## The workbench frame

Before the component walk: the host is a workbench, not a pipeline. The operator sits in front of a data model with state, history, and relations at whatever depth the work needs, and a set of operations that act on it. That framing is load-bearing for reading the code.

**Substrate.** `ledger/schema.ts` and `ledger/fs.ts` define the universal `CircuitNode` tree, its junction tables, and ten IndexedDB object stores. Everything with a lifecycle longer than a single turn lives here: worlds, projects, views, circuits, languages, documents, kinds, ledger rows, console rows, world-frame state, engine state. The substrate is the persisted reality the operator composes.

**Live projection.** `ledger/grid-state.ts` projects the substrate into signals — `activeCircuit`, `activeCircuitLineage`, `activeWorldNode`, `circuitsGrid`, `languagesGrid`, `documentsGrid`, `vocabGrid`, `ledgerGrid`, `consoleGrid`, and their per-selection variants. When `selectedCircuitId` changes, one `createEffect` refreshes the whole slice atomically at the end of a microtask. The operator's view of reality is always coherent with what's in the store.

**Operations.** Kinds define exchange shapes. Screens present the substrate. `bridge.ts::processSubmission` dispatches operations against it — engine Kinds land the manifest in Rust, template Kinds substitute and call the LLM directly, both record into the ledger and update per-circuit engine state.

**The engine as one operation among many.** When an engine Kind fires, `bridge.ts::runEngineLoop` walks `JsCommand`s until the engine returns to the operator (Halt, Success, or AwaitUser). The engine is a card-routing kernel that reads `[STATE]` header shapes and lands cards into slots. The host doesn't validate what the operator can do to the substrate; it provides the surface, records what happens, and keeps the projection live.

This is the walk through the host as it exists, in the order the pieces engage at boot.

## The reactive core — `reactive.ts`

Ninety lines. One `Signal<T>` class, one `createEffect(fn)` function, no framework. The whole UI runs on this.

Reading `signal.value` inside an active effect subscribes that effect to the signal. Assigning to `signal.value` (with `Object.is` change-detection to filter no-ops) queues every subscriber into a microtask-batched flush. `signal.peek()` reads without subscribing, which is what non-UI code (like `bridge.ts` doing an id lookup) should use.

`createEffect` runs the function once immediately, tracking every signal read during that run. On re-run, it clears its previous subscription set before tracking again — this is the "eager unsubscription" comment in the code. It prevents effects hidden behind toggled UI branches from silently retaining subscriptions to signals they no longer read.

Microtask batching matters because dozens of signals get updated in a single mutation — refreshing all grids after a circuit switch, for instance. Without batching, every subscriber would fire per-signal. With batching, the whole cascade flushes once at the end of the microtask.

## The unified data model — `ledger/schema.ts`

There is one entity: `CircuitNode`. Every hierarchical thing in the app is a `CircuitNode` with a `specialization` discriminator:

```typescript
type CircuitSpecialization =
  | 'circuit'   // ordinary node — a "view" the operator works in
  | 'world'     // top of a tree — holds API config in specializationData
  | 'project'   // organizational grouping
  | 'view'      // legacy naming; treated like 'circuit'
  | 'language'  // owns vocabulary entries
  | 'document'  // holds document content + default pole flags
```

Parent-child structure is a `priorId: string | null` pointer on each node — `null` means root, `'__TRASH__'` means soft-deleted, any other id is the parent. The tree is walked by `resolveCircuitLineage(id)`, which follows priorId up to root and returns the lineage, the immediate node, and the nearest ancestor of type `world` (from which API config is read).

Vocabularies are a separate collection, linked by `languageId` to the Language node they belong to. Every vocab term is `{ term, k4Type, role, description }` where `k4Type` is one of the four poles or a two-pole edge (`P-U`, `I-R`, etc.) and `role` is `SPEC`, `MATERIAL`, or `NIL`.

Two junctions live in their own object stores:

- `CircuitLangSelection` — which Languages a given circuit activates. Composite key `${circuitId}:${languageId}`.
- `CircuitDocOverride` — per-circuit override of a Document's A/P/U/I/R inclusion flags. Null in any column falls through to the document's `defaultA/P/U/I/R`.

The `Kind` type (kinds registry, next section) has its own store. So do `LedgerRow`, `ConsoleRow`, `WorldFrameState`, `SystemSettings`, and `EngineState`. Ten object stores in total, at IndexedDB schema version 7.

`fs.ts::LedgerFS` is the IndexedDB wrapper. Every store lookup goes through `runTx(storeName, mode, op)`. Grouped fetches use `getAllByIndex`. On startup, `init` audits the presence of required stores; if the schema is behind, `openDatabase` triggers `onupgradeneeded` and creates any missing stores. There is no migration path — the current version-7 schema is what gets created on first open.

## The reactive grids — `ledger/grid-state.ts`

The application state lives here as a set of signals:

- `selectedCircuitId` / `activeCircuit` — the current selection.
- `circuitsGrid` / `languagesGrid` / `documentsGrid` — the three "sovereign" collections, each populated by filtering `getAllCircuits()` by specialization. All three read from the same underlying store.
- `activeCircuitLangs` / `activeCircuitDocOverrides` / `vocabGrid` / `ledgerGrid` / `consoleGrid` — everything scoped to the current circuit.
- `activeCircuitLineage` / `activeWorldNode` — cached lineage results.
- `systemSettings` — the singleton settings row, loaded on boot.

A `createEffect` at the top of the file watches `selectedCircuitId`. On any change, it resolves lineage, then fires four parallel fetches for the new circuit's languages, doc overrides, ledger rows, and console rows, and updates the grid signals. Every downstream consumer sees the whole slice atomically at the end of the microtask.

There are also aliases for the pre-migration entity names:

```typescript
export const activeProject = activeCircuit;
export const activeView    = activeCircuit;
export const worldsGrid    = circuitsGrid;
export const viewsGrid     = circuitsGrid;
// ... etc.
```

These exist because the code was originally structured around distinct World / Project / View collections; migration collapsed them into the single CircuitNode tree with a specialization discriminator. Some screens haven't been rewritten yet and still import the old names.

`refreshAllGrids()` reruns the store scans and updates all three sovereign grids. `beginLedgerTurn(...)` writes a new `LedgerRow` (with monotonically increasing `turnNumber` per circuit). `appendConsoleRow(...)` writes a console entry. `updateActiveCircuitDoc0(text)` persists a change to the current draft.

## The Kinds registry — `kinds/`

A `Kind` is the app's definition of one exchange shape. Every LLM call must belong to exactly one Kind, and the Kind decides two things: what the prompt looks like, and what preconditions the picker enforces before allowing the send.

The critical distinction is `dispatch`:

- `dispatch: 'engine'` — compilation is owned by the Rust engine. The key must appear in `dispatchable_kinds()` (currently `["validator", "bridge", "controller", "paradox"]`). The Kind's `template` field is unused; the engine builds the prompt from its embedded harness.
- `dispatch: 'template'` — compilation is TypeScript-side. The Kind carries a `template` string with `{doc0}`, `{documents}`, and `{vocabulary}` placeholders that the host substitutes before calling the LLM directly.

Both paths flow through the same picker, the same manifest resolution, and the same ledger. The engine path adds one call: `engine.step_submission(...)`. The template path skips the engine and calls `callBuiltInAPI` directly.

Each Kind also carries a `requires` object — `{ view?, attachedDocs?, lockedCoordinate?, anchor? }` — that the picker consults against current state. Illegal kinds are greyed out with a hover-hint.

`seed-kinds.ts` ships eleven seed Kinds. The four engine-dispatched ones (`validator`, `bridge`, `controller`, `paradox`) reference the prompt spec files in their `engineMechanicsDoc` field so the operator can see what the engine will do. The seven template-dispatched ones (`chat`, `typology`, `domain-classification`, `border-spec`, `exploration`, `ontology-unfold`, `auto-map-domain`) carry their prompts as strings — plain templates the operator can edit in the Kind's row.

The registry (`kinds-registry.ts`) exposes `systemKindsGrid`, `resolveKind(key)`, `resolveKindAlias(key)`, and `refreshKinds()` (which cold-start-seeds if IndexedDB is empty). The schema types Kinds as `scope: 'world' | 'project'` but the runtime treats every seed Kind as system-scoped; scope-inheritance is declared but not wired.

## The manifest builder — `ledger/vfs-wrapper.ts`

`LedgerVFS.buildResolvedManifest(kindKey, warm)` is where the TypeScript world snapshots itself for the Rust engine (or for a template kind's substitution). Given a selected circuit, it:

1. Resolves the lineage.
2. Walks `resolvedInclusionForActiveView()` — for every document, per-column A/P/U/I/R, override if present else document default. Documents with no columns selected drop out.
3. Walks every ancestor's active language selections, gathers the vocabulary terms into a flat list.
4. Assembles a `ResolvedManifest { doc0, kind, warm, documents, vocabulary, snapshot }` where the snapshot records what got sent for the audit trail (the LedgerRow's `doc0Snapshot`, `attachedDocIds`, `activeLanguageIds`, `lineagePath`, `warm`).

The manifest goes to `engine.step_submission(doc0, JSON.stringify(manifest), kind, warm)`; the engine's `hydrate_from_manifest` populates its VFS's `documentation` (A-column docs) and `distilled/{pole}` (P/U/I/R docs) from it. Vocabulary is joined into a comma-separated string and passed to `engine.set_domain_context` — the Bridge's compiled prompt sees it in a `[DOMAIN MATRIX]` block.

## The bridge pump — `bridge.ts`

`bootAirlock()` runs at startup: `await init()` on the Wasm module, then `create_engine_with_state("{}")`. If Wasm fails to load, a dynamic import of `engine-stub.ts` supplies a fallback that returns Halt on every step — the UI stays coherent while the engine is dark.

`processSubmission(kindKey, warm, doc0Override?)` is the entry point for every send. It:

1. Resolves the Kind.
2. Builds a manifest.
3. Writes an outbound LedgerRow.
4. If the Kind is engine-dispatched: `engine.set_domain_context(...)`, `engine.step_submission(...)`, and hands the resulting command to `runEngineLoop`.
5. If the Kind is template-dispatched: substitutes the template, calls the LLM (or hands to manual paste), writes the response as an inbound LedgerRow.

`runEngineLoop(initialCommand)` walks `JsCommand`s until it hits `AwaitUser`, `Halt`, or `Success`. On `FetchLLM`, it looks up the effective API config from the circuit's world ancestor and either calls it or (for `manual` provider or missing config) sets `manualPrompt` and switches UI state to `awaiting_llm_paste`. The response comes back into the engine via `engine.step(response)`.

Between turns, `persistEngineStateForCircuit(circuitId)` serializes the engine's VFS state (`engine.vfs_state`) into the `engine_state` object store keyed by circuit id. `syncEngineStateForCircuit` reads it back when the operator switches circuits. This is how the Braid tree survives page reloads and circuit switches.

Two extra entry points cover the manual-paste and follow-up cases:

- `submitLlmPaste(text)` — operator pastes an LLM response into the manual textbox. Feeds it back through `engine.step`.
- `processUserReply(text)` — operator replies to an `AwaitUser`. Feeds it through `engine.step`. In the engine's `ExpectUser` mode, this reply is wrapped in the last emitting role's continuation prompt (not parsed as LLM output).

## The screens and shell — `screens/`, `shell/`, `router.ts`

Each screen file registers itself with `screenRegistry` at module load. `main.ts` imports them all statically so registration completes before boot. The registry exposes `availableScreens` as a signal of sorted `ScreenDef`s.

`router.ts::bootSystemOS` mounts the shell (default is `shell/default.ts` — sidebar + top nav + screen container), sets up global `,` / `.` key navigation for history, and mounts the active screen via a `createEffect` on `activeScreen`. Every screen switch calls the previous screen's cleanup function (returned from its `mount(container)` call) before rendering the new one.

The current screen set: `chat`, `arena`, `log`, `ledger`, `manifold`, `settings`, `world`, `project`, `view`, `circuit`, `documents`, `doc0`, `doc-editor`, `languages`, `kinds`, `api-log`, `console`, `arena-state`, `lexicons`, `views`. Some overlap in purpose — the migration from separate World/Project/View entities left behind screens for the old shapes alongside newer generic ones. Not all are equally wired.

## The DOM builder — `dom.ts`

A ~40-line hyperscript-style builder:

```typescript
h('div', { className: 'panel', on: { click: handler } },
  h('span', { textContent: 'Hello' }),
  h('button', { textContent: 'Go' })
)
```

Attributes on the props object become DOM properties (or event listeners under `on`, dataset entries under `dataset`, styles under `style`). Children can be strings, numbers, DOM nodes, or arrays (flattened). This is what every screen uses to build its UI. There is no JSX.

## The AC Circuit Workbench — `ledger/ledger-ui.ts`

A physical-substrate metaphor for the Bridge's phase-lock negotiation. The operator adjusts four sliders — driving frequency ω, resistance R (friction/ground), inductance L (memory/momentum), capacitance C (anticipation/tension) — and the panel computes reactance, impedance, phase angle, power factor, resonant frequency, and Q factor in real time, with threshold diagnostics ("θ ≈ 0 → resonance achieved", "θ > 5° → torsional shear lagging", etc.).

Read this as a tuning surface. The math is real; every formula runs. But the values do not currently reach the Rust engine — `engine.set_domain_context` accepts vocabulary text only, and the engine's Bridge prompt-compilation doesn't consume the CircuitNode's physics fields. Under `CircuitNode.physics: { omega, r, l, c }` every seeded circuit gets the same uniform defaults (`{ 1.0, 10, 10, 0.1 }`). The Workbench is an interface metaphor operating on the same substrate the Bridge harness talks about; wiring the values through to influence the actual sweep is future work.

## The LLM client — `llm-client.ts`

`callBuiltInAPI(world, prompt, jsonMode)` has three paths:

1. If `world.apiKey` is set: POST to `world.apiBaseUrl || "https://api.openai.com/v1/chat/completions"` with `Authorization: Bearer ${world.apiKey}`, `model: "gpt-4o"` hard-coded for the OpenAI provider, `temperature: jsonMode ? 0.1 : 0.3`.
2. Chrome's on-device AI via `window.ai.languageModel.create` — creates a session, prompts, destroys.
3. Neither available: throw. `bridge.ts` catches this and routes into manual paste mode.

The `apiProvider` type on `WorldSettings` declares `'anthropic'` and `'custom'` values that the code does not currently branch on. Selecting Anthropic will still hit the OpenAI-shape endpoint.

## The engine stub — `engine-stub.ts`

Dynamically imported by `bootAirlock` when the Wasm module fails to load. Implements the Wasm interface's method shapes (`step`, `step_submission`, `load_vfs_state`, `set_domain_context`, `vfs_state`, `current_role`, `current_mode`) but returns `JsCommand::Halt` on any step call. The UI can still render everything upstream of the engine — the ledger, the arena visualization, the kinds picker — but nothing simulates. The stub's `step_submission` signature is 2-arg, not 4-arg like the real Wasm; the extra `kind` and `warm` arguments are silently dropped when the stub is active. This is a dev-mode-only concern.

## Boot sequence — `main.ts`

Deliberately linear:

```
1. bootLedger()
   → vfsDb.init()  → openDatabase (create stores on first open)
   → load settings
   → seedDatabaseIfEmpty()  → cold-start with Default K4 Root + Default K4 Language + 16 seed vocab terms
   → refreshAllGrids()
   → refreshKinds()  → cold-start with 11 seed kinds
   → recalculateTrashCounters()

2. bootAirlock()
   → init() the Wasm module (or fall through to engine-stub)
   → create_engine_with_state("{}")
   → primeDispatchableKinds(engine.dispatchable_kinds())
   → set up a createEffect on selectedCircuitId to hydrate engine VFS per circuit switch

3. screenRegistry.beginUpdates() / endUpdates() — commits the sorted list

4. bootSystemOS(appRoot, DefaultShell)
   → shell mounts sidebar + top nav + screen container
   → , / . key navigation
   → createEffect on activeScreen mounts screens
```

After this, the app is live. Every submission goes through `processSubmission` in `bridge.ts`. Every response either lands in the ledger and updates chat, or lands as an engine command that reroutes to another `FetchLLM` or into an `AwaitUser` pause.
