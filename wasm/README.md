# K4-Manifold

A browser-hosted runtime that drives one LLM through a bounded four-pole algebra instead of through personas. There is no swarm of agents, no reviewer role, no external orchestrator. There is one LLM instance stepping between four prompt harnesses (Validator, Bridge, Controller, Paradox Engine), and one Rust state machine deciding which harness the next turn is compiled under.

The bet is geometric: replace the "reviewer agent" pattern with a twelve-equation algebra whose coordinates are mutually determining. If Structure outruns Flow, `R = U / I` spikes; the state machine catches that as an out-of-band condition rather than a judgment call. Quality is a property of the run, not a request in the prompt.

## The architecture, in one page

The system splits across a WebAssembly boundary. The split does real work: the Rust side owns algebra, parsing, and the committed ledger. The TypeScript side owns the LLM network calls, the DOM, and IndexedDB. The Rust engine cannot make a network call; it emits a `JsCommand` and waits. The TypeScript host pumps the loop.

**Rust kernel — `rust/src/`.** Four poles (`P`, `U`, `I`, `R` = Fire, Air, Water, Earth) each defined by a two-bit kinematic signature (Active/Reactive × Asserting/Yielding). Twelve stances covering every valid `(home, absent)` pair. A parser that classifies incoming LLM output by which `[STATE]` fields are present — `GATE` → Validator, `MODE: paradox` → Paradox, `PHASE` (no `CYCLE`) → Bridge, `CYCLE` → Controller — and routes each to its own typed header struct. A three-mode state machine (`ColdStart`, `ExpectLlm`, `ExpectUser`). A `VirtualFileSystem` that owns the Working Surface, the Braid tree, and the sandboxes. The four active prompt harnesses are compiled directly into the Wasm binary via `include_str!`, so a blank LLM instance receives the entire twelve-equation lexicon inline every turn.

**TypeScript host — `src/`.** A zero-dependency reactive core (`reactive.ts` — one `Signal<T>` class, microtask-batched, ~90 lines). One universal `CircuitNode` entity with a `specialization` discriminator (`world | project | view | circuit | language | document`) and a `priorId` recursive parent pointer. A `Kinds` registry defining the shape of every exchange the app can make; kinds either dispatch to the engine (four of them: `validator`, `bridge`, `controller`, `paradox`) or dispatch template-side with `{doc0}` / `{documents}` / `{vocabulary}` substitution (five of them: `chat`, `typology`, `domain-classification`, `border-spec`, `exploration`). A `LedgerVFS` that resolves the active circuit's lineage, gathers active vocabularies, resolves per-document A/P/U/I/R inclusion flags, and hands the whole manifest to the engine or to a template. A bridge pump (`bridge.ts::runEngineLoop`) that walks `JsCommand`s until Halt/Success/AwaitUser and persists engine VFS state per circuit switch.

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

## Known-shaped, not-yet-live

Some pieces exist as scaffolding but do not currently exercise their full behavior. Reading the code as if they were complete will mislead.

- **Multi-cycle Controller progression.** `engine.rs::is_cycle_complete` returns `true` unconditionally, and `get_next_face_in_path` always returns the path's first element. Every face-runner work-product currently leads straight to PTR-write; path iteration across a cycle is not wired.
- **Physics → engine wiring.** `CircuitNode.physics = { omega, r, l, c }` is stored per circuit and displayed by the AC Circuit Workbench with real impedance / phase-angle / power-factor math. Those values do not reach the engine's Bridge prompt today. The Workbench is a tuning surface without a hook.
- **Anthropic provider.** `WorldSettings.apiProvider` declares `'anthropic'` as a value, but `llm-client.ts::callBuiltInAPI` only implements the OpenAI-shape POST. Selecting `'anthropic'` routes through the same path with `model: "gpt-4o"` hard-coded.
- **Scope-typed Kinds.** `kinds-schema.ts` types Kinds as `scope: 'world' | 'project'` and the registry declares both a `worldKindsGrid` and a `projectKindsGrid` signal, but the runtime treats every seed kind as `scope: 'world'` and the `projectKindsGrid` is never populated. Composed picker inheritance is not yet realized.
- **`ElementRole` on vocabulary terms.** Every term carries `role: 'SPEC' | 'MATERIAL' | 'NIL'`; the Rust engine's `hydrate_from_manifest` reads only `poles`, not roles. The role field surfaces in UI but has no engine consequence.

The other side of the invariants — polyglot stance parsing, header-shape routing, path-precedence staleness on the Working Surface, Landauer-Tax-only writes via `write_ptr`, Gray-code adjacency via `viable_adjacencies` — are enforced in code today. Those are the pieces the twelve equations actually catch drift on.

