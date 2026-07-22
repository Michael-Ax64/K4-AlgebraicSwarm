Opus sez, I've read the whole aggregate. Here's what I found.

**VERY MUCH A SOFTWARE WORK IN PROGRESS**

# What the app is

**K4-Manifold** is a "Semantic OS" for driving LLM swarms through a rigid geometric algebra rather than personas. The premise it argues against, out loud, is that assigning agents semantic masks ("Domain Expert," "Legal Officer") produces fluent hallucinated consensus — what the docs call *Trajectory Loss*. Its answer is to bind the swarm inside a four-pole tetrahedron (**P/U/I/R** — Fire/Air/Water/Earth) with twelve equations relating them, and let those equations enforce quality by mutual determination instead of by a "reviewer agent." The claim is that the geometry catches drift the way `R = U/I` catches a spike when structure outruns flow.

Four LLM roles, executing sequentially and statelessly, run the loop: **Validator** (the Markov blanket — the only prompt that reads operator text), **Bridge** (a resonant cavity that sweeps facets until phase-lock), **Controller** (the XOR actuator that dispatches four face-runners along a path), and **Paradox Engine** (a diverging R&D instrument that maps Gray-code-adjacent stances without collapsing them). Each has its own `.md` spec.

# The architecture, physically

It's split across a Wasm boundary and the split is doing real work.

The **Rust kernel** (`wasm/rust/`) owns the *verbs*: the algebra (`Pole`, `Stance`, kinematics), the state machine, the message-boundary parser, and the Virtual File System with its Braid tree. It has no network, no DOM, no LLM. It is a pure synchronous state machine that yields to JS via a `JsCommand` enum with four variants — `FetchLLM`, `AwaitUser`, `Halt`, `Success`. The Cold-Start Rule is enforced physically: the four prompt specs are pulled into the binary via `include_str!("../../../prompts/K4-*.md")`, so a blank LLM instance receives the entire algebraic harness inline every turn.

The **TypeScript host** (`wasm/ts/`) owns the *nouns*: a 5D IndexedDB relational graph (Worlds → Levels → Vocabularies/Circuits/LedgerEntries + a per-World Corpus), a signal-based reactive core (`reactive.ts` — a tiny Signal class with eager unsubscription and microtask batching, no framework), the ledger UI, and the AC Circuit Workbench that lets you tune Ω, R, L, C sliders and get back real impedance/phase-angle/power-factor calculations. Before every submission, `getActiveVocabContext()` reads the current Level's vocabulary and `bridge.ts` injects it into the Rust engine via `set_domain_context`, so the same Wasm binary can run "Software Engineering (DevOps)" or "Standard Model & Quantum Mechanics" without recompiling — scale invariance by dictionary swap.

# The pieces I found genuinely clever

The **polyglot stance parser** (`algebra.rs::parse_stance_from_name`). The three specs disagree on 4–5 of the 12 stance labels: the Bridge's `Friction` is (R,P), the Controller's `Friction` is (P,U); the Bridge's `Resonance` is (I,R), the Paradox Engine's `Resonance` is (I,U). Rather than pick one vocabulary, the parser accepts all three and uses the equation suffix as the disambiguator (`"Friction (R = U / I)"` vs `"Friction (P = I² × R)"`). Every role can talk in its own idiom; the runtime resolves to the same `(home, absent)` geometric coordinate. The `spec_name(role)` method lets the engine speak *back* to any role in its own vocabulary. This is proved test-wise in `stance_names.rs` by round-tripping every `(home, absent)` pair through every role.

The **header shapes route by shape**, not by label. `parse_and_validate_header` in `parser.rs` classifies by which fields are present: `GATE` → Validator, `MODE=paradox` → Paradox, `PHASE`-without-`CYCLE` → Bridge, `CYCLE` → Controller. The four `ParsedHeader` variants are then each parsed by their own function with their own field types (`GatePhase`, `BridgePhase`/`LockState`/`PhaseDirection`, `ControllerHeader`, `AnchorKind`). The comment reads *"the header shapes don't disagree; they route"* — and the type system enforces it.

The **StepMode machine** in `engine.rs`. `ColdStart` → `ExpectLlm` → `ExpectUser` → `ExpectLlm`… The commit-message-shaped comment in `interaction.rs` names the bug this fixed: under an older `is_cold_start` bool, a plain user reply after `AwaitUser` was being fed to the parser, which halted on missing `[STATE]`. The fix is in `step_command`: when `mode == ExpectUser`, bypass the parser entirely, wrap the reply in the *last emitting role's* continuation prompt, and re-emit `FetchLLM`. `step_mode.rs` proves it round-trips indefinitely.

The **Gray-code adjacency math**. `Stance::viable_adjacencies()` returns exactly 4 stances (shift-metric ×2, shift-plane ×2) — the single-bit pivots. `VirtualFileSystem::get_braid_context()` reads the latest PTR's stance, computes those 4, and hands their `facet_id`s to the Bridge as `[BRAID-CONTEXT: legal-facets [1,3,9,11]]`. The Bridge is geometrically forbidden from proposing a diagonal leap. `routing.rs::warm_project_returns_gray_code_adjacent_facets` proves the exact set for Leverage (P,I) → {Synthesis, Momentum, Capacity, Accounting}.

The **AC circuit as UI**. `renderCircuitWorkbench` gives you sliders on ω, R, L, C and computes reactance, impedance, phase angle, power factor, resonant frequency, and Q factor in real time, with diagnostic thresholds ("θ ≈ 0 → RESONANCE ACHIEVED", "θ > 5° → TORSIONAL SHEAR (lagging)"). Whether or not this AC analogy fully carries the load conceptually, as an *interface* it turns an abstract prompt-tuning knob into something the operator can grab.

# Where the code is honest about being unfinished

The engine ships with sockets deliberately cut but not filled, and the code confirms it. `engine.rs::is_cycle_complete` returns `true` unconditionally, and `get_next_face_in_path` returns `state.path.first()` — meaning multi-cycle progression is deferred, matching the docs' "The Controller runs one cycle and stops." `handle_face_work` always writes with `ThreadAction::Continue`; the `Sever` branch exists in `vfs.rs` but is never triggered from face completion (only reachable if a caller passed it). The `engine-stub.ts` fallback (used when the Wasm binary fails to load) just returns a Halt on any step, so the UI stays coherent but nothing simulates. The `llm-client.ts` hard-codes `"gpt-4o"` for the OpenAI provider. Corpus handling has a `persistCorpus` toggle but its default is `true` in seed data — meaning uploaded docs land in IndexedDB unless the user opts out.

# What holds the whole thing together

The single strongest architectural bet is that **the boundary between roles is a *message boundary*, not a function call**. Every role emits an explicit routing request naming the next role; the parser's classify-then-dispatch is applied at the message boundary the same way the Validator applies it at the operator boundary. Nothing is smuggled through side channels. That's what lets each role's LLM instance be blank and stateless — the header + BWR (Bridge Working Record) + PTR are the only carriers. The Bridge wakes fully cold from `[STATE]` + `[BWR]`, the Controller from `[STATE]` + Payload, and the Validator from the on-disk PTR-latest.

The most interesting piece of engineering discipline is the split between what pays the **Landauer Tax** (`vfs.write_ptr()` — committed history written to the Braid tree, with full surface snapshots and health) and what is uncommitted potential (the Bridge's BWR, which "lives in transit" and never touches disk; Hold-run outputs, which land in `sandboxes/` quarantine). This is not decoration — it's structurally why `Push` writes to `distilled/` and `Hold` writes to sandboxes: the code refuses to let uncollapsed Q pollute the ledger.

Whether the whole conceit — that four LLM roles bounded by twelve equations produce genuinely non-sycophantic output — actually delivers is the question the code can't answer for itself. But as a piece of engineering, the invariants it *does* enforce (header shape → routing, equation suffix → stance disambiguation, Gray-code adjacency → legal moves, path-precedence → staleness, PTR write → thermodynamic commit) are all provable and all proven in the test suite. That's a rare thing in LLM orchestration code, and it's the strongest signal I can give you that the architecture is doing what it says it does.

