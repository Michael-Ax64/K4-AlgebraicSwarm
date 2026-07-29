# K4-Manifold

**A workbench for compiling reality through a four-pole algebra.** The operator sits in front of a data model with state, history, and relations at whatever depth the work needs — Circuits, Views, Documents, Vocabularies, Ledger rows, Braid threads, sandboxes — and a set of operations that act on it. LLM turns are one kind of operation among many. The Braid is not a pipeline the machine walks by validating inputs; it is the structure that becomes visible when the operator works the bench.

There is no external orchestrator, no reviewer role, no polling `main()`. The runtime is Inversion of Control at every level: the operator composes reality, cards land as headers when they land, state updates, and the twelve-equation algebra is the geometry the whole thing is worked *in*. Quality is a property of what accumulates in the ledger and the Braid tree, not a check applied at any door.

## The workbench, in one page

The **data model** is the substrate. A universal `CircuitNode` entity with a `specialization` discriminator carries every hierarchical thing — worlds, projects, views, circuits, languages, documents — under a single `priorId` recursive parent pointer, so lineage is walkable in one direction. Vocabularies attach to Language nodes. Documents carry A/P/U/I/R default flags that circuits can override. Ledger rows record every exchange with full snapshot metadata (doc0, attached docs, active languages, lineage path, warm-vs-cold). Console rows record every diagnostic. World-frame state and per-circuit engine state persist across reloads. Ten IndexedDB object stores, schema version 7, all reactively projected to the UI through microtask-batched signals.

The **operations** are the ways the operator acts on that substrate. Kinds define exchange shapes — some dispatch to the Rust engine (Validator, Bridge, Controller, Paradox), some dispatch TypeScript-side with template substitution (Chat, Typology, Domain-Classification, Border-Spec, Exploration, Ontology-Unfold, Auto-Map-Domain). Screens present views onto the substrate — the Arena visualizes the twelve stances geometrically, the Ledger presents the audit trail, the AC Circuit Workbench presents live impedance / phase-angle / power-factor math over the circuit's physics fields, the Chat presents the current exchange surface. The operator can move between screens at any time; the underlying reality doesn't care which one is mounted.

The **engine** is a card-routing kernel. When an LLM turn arrives, `parser.rs::parse_and_validate_header` reads the `[STATE]` header shape and lands the card into its slot: `GATE` present → Validator; `MODE: paradox` → Paradox; `PHASE` without `CYCLE` → Bridge; `CYCLE` → Controller. Below the header, a `TerminalArtifact` — plain text, routing request, face-runner prompt, held paradoxes, raise, swarm payload, PTR — is what the card *does* once landed. The parser has no domain logic; classification is routing. A header that underspecifies its slot is not rejected — it is what it is, and the state it produces is what the workbench then holds.

The **Braid tree** in `vfs.rs` is the append-only spine of committed reality. `write_ptr` is the only writer, and the `PhaseTransitionRecord` it emits is the artifact that paid the Landauer Tax — stance, home variable, operating plane, path traversed, held pole, held role, surface snapshot, health. Every uncommitted piece has a different destination: the Working Surface for staged writes, sandboxes keyed by `Run_<cycle>` for quarantined Hold-runs, `documentation` for shared corpus, `distilled/{pole}` for face-specific material. `ThreadAction::Continue` extends a thread; `ThreadAction::Sever` parks the current thread and initializes a new one. Threads persist. Parked threads are still there. The whole tree is what the operator reads reality *from*.

## The architecture, in one page

The system splits across a WebAssembly boundary. The split does real work: the Rust side owns algebra, parsing, and the committed ledger. The TypeScript side owns the LLM network calls, the DOM, and IndexedDB. The Rust engine cannot make a network call; it emits a `JsCommand` and waits. The TypeScript host pumps the loop.

**Rust kernel — `rust/src/`.** Four poles (`P`, `U`, `I`, `R` = Fire, Air, Water, Earth) each defined by a two-bit kinematic signature (Active/Reactive × Asserting/Yielding). Twelve stances covering every valid `(home, absent)` pair. A parser that classifies incoming LLM output by which `[STATE]` fields are present — `GATE` → Validator, `MODE: paradox` → Paradox, `PHASE` (no `CYCLE`) → Bridge, `CYCLE` → Controller — and routes each to its own typed header struct. A three-mode state machine (`ColdStart`, `ExpectLlm`, `ExpectUser`). A `VirtualFileSystem` that owns the Working Surface, the Braid tree, and the sandboxes. The four active prompt harnesses are compiled directly into the Wasm binary via `include_str!`, so a blank LLM instance receives the entire twelve-equation lexicon inline every turn.

**TypeScript host — `src/`.** A zero-dependency reactive core (`reactive.ts` — one `Signal<T>` class, microtask-batched, ~90 lines). One universal `CircuitNode` entity with a `specialization` discriminator (`world | project | view | circuit | language | document`) and a `priorId` recursive parent pointer. A `Kinds` registry defining the shape of every exchange the app can make; kinds either dispatch to the engine (four of them: `validator`, `bridge`, `controller`, `paradox`) or dispatch template-side with `{doc0}` / `{documents}` / `{vocabulary}` substitution (seven of them: `chat`, `typology`, `domain-classification`, `border-spec`, `exploration`, `ontology-unfold`, `auto-map-domain`). A `LedgerVFS` that resolves the active circuit's lineage, gathers active vocabularies, resolves per-document A/P/U/I/R inclusion flags, and hands the whole manifest to the engine or to a template. A bridge pump (`bridge.ts::runEngineLoop`) that walks `JsCommand`s until Halt/Success/AwaitUser and persists engine VFS state per circuit switch.

**Prompts — `prompts/`.** Four sans-K4 harnesses (`AlgebraicIntakeValidator.md`, `AlgebraicIntentBridge.md`, `AlgebraicSwarmController.md`, `AlgebraicParadoxEngine.md`). These are the canonical distillations and are the ones the Wasm binary embeds. If you see files with a `K4-` prefix, they're archived earlier drafts and not in use.

For the depth passes: [K4-Backend.md](./K4-Backend.md) walks the Rust kernel — algebra, parser, state machine, VFS, Braid. [K4-Frontend.md](./K4-Frontend.md) walks the TypeScript host — the reactive core, the CircuitNode model, the Kinds registry, the manifest builder, the bridge pump, and the AC Circuit Workbench.

## The twelve stances

Canonical numbering — matches `rust/src/algebra.rs::Stance::facet_id`, `src/arena/registry.ts::STANCES_GEOMETRY`, and the FACETS/STANCES lines in every prompt.

| # | Equation      | Home | Absent | Paradox     | Bridge     | Controller   |
|---|---------------|------|--------|-------------|------------|--------------|
|  1 | `P = U² / R`  | P    | I      | Leverage    | Leverage   | Leverage     |
|  2 | `P = I² × R`  | P    | U      | Momentum    | Momentum   | Friction     |
|  3 | `P = U × I`   | P    | R      | Synthesis   | Drive      | Synthesis    |
|  4 | `I = √(P/R)`  | I    | U      | Resonance   | Yield      | Resonant     |
|  5 | `I = P / U`   | I    | R      | Extraction  | Resonance  | Extraction   |
|  6 | `I = U / R`   | I    | P      | Ohmic       | Throughput | Ohmic        |
|  7 | `U = P / I`   | U    | R      | Tension     | Tension    | Articulation |
|  8 | `U = I × R`   | U    | P      | Architecture| Architecture| Grounding   |
|  9 | `U = √(P×R)`  | U    | I      | Capacity    | Capacity   | Geometric    |
| 10 | `R = U / I`   | R    | P      | Impedance   | Friction   | Impedance    |
| 11 | `R = U² / P`  | R    | I      | Accounting  | Bloat      | Accounting   |
| 12 | `R = P / I²`  | R    | U      | Brittleness | Brittleness| Density      |

Rows 2 through 12 carry the collisions the polyglot parser is built for: "Friction" means (P,U) to the Controller and (R,P) to the Bridge; "Resonance" means (I,U) to Paradox and (I,R) to the Bridge. The parser (`parse_stance_from_name` in `algebra.rs`) resolves by equation suffix; each role can speak its own vocabulary and every message resolves to the same `(home, absent)` pair.

## The circuit, in flight

A turn goes:

1. Operator submits text through the picker under some `Kind`. The picker forwards to `bridge.ts::processSubmission`.
2. `LedgerVFS.buildResolvedManifest` walks the lineage, gathers the active vocabularies, resolves each document's A/P/U/I/R inclusion (per-circuit overrides falling back to the document's own defaults), and builds a snapshot for the audit trail.
3. If the kind's `dispatch` is `template`, the TS host substitutes the manifest into the template and calls the LLM directly. Response is written to the ledger.
4. If the kind's `dispatch` is `engine`, the manifest goes to Rust via `engine.step_submission(doc0, manifest_json, kind, warm)`. The engine hydrates its VFS from the manifest, compiles the Validator prompt (cold) or the last role's continuation prompt (warm), and yields `JsCommand::FetchLLM`.
5. `bridge.ts::runEngineLoop` picks up the command, calls the configured LLM API (OpenAI-shape, on-device via `window.ai`, or hands to manual copy/paste), and feeds the response back with `engine.step(response)`.
6. Rust parses. `[STATE]` header shape classifies the response into one of four variants. The `TerminalArtifact` — plain text, routing request, face-runner prompt, held paradoxes, raise, swarm payload, PTR — decides what happens next. Plain text and held paradoxes yield `AwaitUser` (the operator's next reply is not parsed as LLM output — it's wrapped in the last role's continuation prompt and fires another `FetchLLM`). Routing requests, face-runner prompts, and swarm payloads recompile and fire `FetchLLM`. A committed PTR writes to the Braid and resets to `ColdStart`.
7. Between turns, the engine's VFS state (Braid tree, sandboxes, distilled/abstracted stores) is serialized to IndexedDB per circuit. Selecting a different circuit swaps engine state.

## Build and run

Prerequisites: Rust, `wasm-pack`, Node 18+.

```bash
# 1. Build the Wasm kernel
cd rust
wasm-pack build --target web

# 2. Run the UI host (from the repo root)
cd ..
npm install
npm run dev
```

The dev server serves from the repo root; there is no separate `ui/` or `ts/` directory. Vite is configured to serve `rust/pkg/` (the Wasm build output) alongside the source tree. Open the dev URL and configure an LLM provider in Settings, or leave it on Manual to copy/paste prompts and responses.

The IndexedDB store (`K4Manifold_Unified_VFS`, currently at schema version 7) cold-starts with a Default K4 Root circuit and a Default K4 Language holding sixteen seed terms — the four poles plus twelve stance-equation labels. Any richer domain seed lives behind the `autoLoadSeedData` setting, which is off by default.

## Files

```
.
├── rust/                          # The Wasm kernel
│   ├── src/
│   │   ├── algebra.rs             # Poles, Stances, kinematics, polyglot parser
│   │   ├── state.rs               # Working Surface, all four header variants, BWR types
│   │   ├── parser.rs              # Classify-then-dispatch airlock
│   │   ├── engine.rs              # State machine, prompt compilation, JsCommand yield
│   │   ├── vfs.rs                 # Braid tree, PTR writer, sandboxes
│   │   └── lib.rs                 # wasm-bindgen entry
│   └── Cargo.toml
│
├── src/                           # The TypeScript host
│   ├── main.ts                    # Boot sequence
│   ├── bridge.ts                  # runEngineLoop pump, kind dispatch
│   ├── reactive.ts                # Signal, createEffect
│   ├── engine-stub.ts             # Fallback when Wasm can't load
│   ├── router.ts                  # Screen mount / history nav
│   ├── llm-client.ts              # OpenAI-shape + window.ai
│   ├── state.ts                   # UI signals
│   ├── dom.ts                     # Hyperscript-style h()
│   ├── arena/                     # Twelve-stance visualization
│   │   ├── registry.ts            # Single-source stance table
│   │   ├── layout.ts              # Grid layouts (seasonal, unit-circle)
│   │   ├── quarter.ts             # One face + its 3 stances
│   │   └── whole.ts               # All four faces
│   ├── kinds/
│   │   ├── kinds-schema.ts        # AppKind type
│   │   ├── kinds-registry.ts      # Signals, upsert, dispatch validation
│   │   └── seed-kinds.ts          # Nine shipping kinds
│   ├── ledger/
│   │   ├── schema.ts              # CircuitNode, Vocabulary, LedgerRow, ...
│   │   ├── fs.ts                  # IndexedDB wrapper
│   │   ├── grid-state.ts          # Reactive grids, lineage resolution
│   │   ├── vfs-wrapper.ts         # LedgerVFS.buildResolvedManifest
│   │   ├── seed.ts / seed-data.ts # Cold-start seed
│   │   ├── world-frame-state.ts   # Per-World UI scratch persistence
│   │   └── ledger-ui.ts           # AC Circuit Workbench
│   ├── screens/                   # Each registers itself with screenRegistry
│   └── shell/                     # Chrome + sidebar
│
├── prompts/                       # The four canonical harnesses
│   ├── AlgebraicIntakeValidator.md
│   ├── AlgebraicIntentBridge.md
│   ├── AlgebraicSwarmController.md
│   └── AlgebraicParadoxEngine.md
│
├── index.html
├── styles.css
├── vite.config.ts
├── README.md                      # (this file)
├── K4-Backend.md
└── K4-Frontend.md
```

## Operations not yet on the bench

The workbench holds substrate and operations. Some operations the substrate can express are not yet installed. This is not the same as "incomplete" — the substrate carries these things whether or not the operations are on the bench, and the operator can already see them in what accumulates. Adding the operations extends what the bench can *do* with what it already *holds*.

- **Multi-face Controller traversal.** `engine.rs::is_cycle_complete` returns `true` unconditionally; `get_next_face_in_path` always returns the path's first element. The substrate carries `path_traversed` on every PTR and the arena knows all twelve stances, so a thread's traversal is fully visible in the ledger. The operation of walking a controller through more than one face before committing is not on the bench yet.
- **Physics → engine wiring.** `CircuitNode.physics = { omega, r, l, c }` is stored per circuit and rendered by the AC Circuit Workbench with real impedance / phase-angle / power-factor math. Those values do not currently reach the engine's Bridge prompt. The operator can tune ω, R, L, C and read what it *means* in the AC frame; the operation of feeding that frame into the Bridge's sweep is not yet installed.
- **Anthropic provider.** `WorldSettings.apiProvider` declares `'anthropic'` as a value; `llm-client.ts::callBuiltInAPI` only implements the OpenAI-shape POST. Selecting `'anthropic'` routes through the same path with `model: "gpt-4o"` hard-coded. The setting exists on the bench; the branch behind it does not.
- **Scope-typed Kinds.** `kinds-schema.ts` types Kinds as `scope: 'world' | 'project'` and the registry declares both a `worldKindsGrid` and a `projectKindsGrid`. The runtime treats every seed Kind as `scope: 'world'`; the `projectKindsGrid` is not populated. Composed-picker inheritance is a shape the schema anticipates and the operator can already see; the population operation is not yet on the bench.
- **`ElementRole` on vocabulary terms.** Every term carries `role: 'SPEC' | 'MATERIAL' | 'NIL'`; the Rust engine's `hydrate_from_manifest` reads only `poles`, not roles. Roles surface throughout the UI as reality the operator can attend to; the operation that lets the engine attend to them is not yet installed.

The invariants that *are* on the bench — polyglot stance parsing, header-shape routing to slots, path-precedence staleness on the Working Surface, Landauer-Tax-only writes via `write_ptr`, Gray-code adjacency computed by `viable_adjacencies` and injected into the Bridge's `[BRAID-CONTEXT]` block, thread-level `Continue` / `Sever` — carry the geometry the whole workbench is worked *in*.
