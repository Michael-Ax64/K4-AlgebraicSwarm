# The Rust Kernel

`rust/` compiles to a WebAssembly module the TypeScript host loads at boot. Everything the engine does is synchronous, in-process, and text-in / text-out. It cannot open a socket, touch the DOM, or hold a running LLM connection. It runs one step and yields a `JsCommand`.

This is a walk through what's actually in the crate, in the order it makes sense to read.

## The algebra — `algebra.rs`

Four `Pole` variants, each defined by a two-bit kinematic signature:

```rust
Pole::P => (Charge::Active,   Modality::Asserting),   // Fire
Pole::U => (Charge::Active,   Modality::Yielding),    // Air
Pole::I => (Charge::Reactive, Modality::Yielding),    // Water
Pole::R => (Charge::Reactive, Modality::Asserting),   // Earth
```

`Pole::is_diagonal_to` returns true only when both bits differ — so `P` is diagonal to `I`, `U` is diagonal to `R`. This is what the algebra uses to distinguish "single-bit Gray-code move" from "diagonal leap." The engine forbids the leap geometrically.

A `Stance` is a `(home, absent)` pair — two of the four poles. `try_new` rejects `home == absent` at construction. `active_pair()` returns the two poles that are neither home nor absent (the two the stance is measured across). `viable_adjacencies()` returns exactly four stances — the single-bit pivots off the current one: two shift-metric (hold the absent, replace the home with each of the actives) and two shift-plane (hold the home, replace the absent with each of the actives). Never both flipped. Never five. Never three.

`facet_id` and `from_facet_id` implement the canonical numbering documented in `README.md` — Leverage at 1, going face-by-face (P, I, U, R) and within a face by equation kind. This numbering is authoritative and must stay in sync with `src/arena/registry.ts::STANCES_GEOMETRY` and with the prompt harnesses' FACETS/STANCES lines.

`spec_name(role)` gives the display name each of the four instrument roles uses for a given stance. The three tables disagree in five places:

| `(home, absent)` | Paradox     | Bridge     | Controller   |
|------------------|-------------|------------|--------------|
| `(P, R)`         | Synthesis   | **Drive**  | Synthesis    |
| `(P, U)`         | Momentum    | Momentum   | **Friction** |
| `(I, R)`         | Extraction  | **Resonance** | Extraction |
| `(I, P)`         | Ohmic       | **Throughput** | Ohmic    |
| `(I, U)`         | Resonance   | **Yield**  | **Resonant** |
| `(R, P)`         | Impedance   | **Friction** | Impedance  |
| `(R, I)`         | Accounting  | **Bloat**  | Accounting   |
| `(R, U)`         | Brittleness | Brittleness| **Density**  |

The polyglot parser reconciles this. `parse_stance_from_name` accepts every label from every role, plus numeric shorthand (`"1"`, `"S1"`, `"Stance 12"`) and a geometric fallback for the harness's own compact notation (`"1(P,a:R)"`, `"Stance 1 (P, a:R)"`). The equation suffix carried with a label disambiguates collisions — `"Friction (R = U / I)"` resolves to `(R, P)`, `"Friction (P = I² × R)"` to `(P, U)`. Bare `"Friction"` falls to first-hit. This is why every role can speak in its own idiom and the runtime resolves to the same coordinate pair.

`equation_name()` returns the Paradox-vocabulary name as the default — so when the engine writes a stance into a PTR or a prompt header without needing a role-specific voice, it comes out in one voice.

## The parser — `parser.rs`

The parser is the card-landing surface. Its docstring says it plainly: *"The header shapes don't disagree; they route."* An `[STATE] ...` line coming from the LLM is not free text; it's a card, and its header names which slot it belongs in. The parser reads the header shape and lands the card. There is no gatekeeping — a card that arrives is a card the workbench holds. The parser's job is *routing to slot*, not validating admissibility.

`parse_and_validate_header` lands by field presence:

```
GATE present                          → Validator slot
MODE = paradox                        → Paradox slot
PHASE present, CYCLE absent           → Bridge slot
CYCLE present                         → Controller slot
otherwise                             → MalformedHeader (still a landing;
                                        the engine reports and continues)
```

Each slot has its own reader (`parse_validator_header`, `parse_bridge_header`, `parse_controller_header`, `parse_paradox_header`), which returns a typed struct — `GatePhase`, `BindStatus`, `SubmissionStatus`, `RouteTarget` for the Validator; `BridgePhase`, `LockState`, `PhaseDirection`, `QFactor` for the Bridge; and so on. The Bridge slot cannot carry `CYCLE` because the Bridge is pre-cycle; the Controller slot cannot carry `RHO` because coherence is upstream work. The type system enforces the field vocabulary each slot accepts. A card whose header is underspecified for its slot lands anyway — as a shape the workbench then holds. Whether that shape is enough for the next operation to fire is a question the operator answers by working the bench, not one the parser answers by rejecting.

Below the header, `classify_artifact` reads the body and yields a `TerminalArtifact`:

- `Halt(reason)` — the run is done. The engine will either return `JsCommand::Halt` immediately or, on `VALIDATION INTERCEPT`, echo the last known `[STATE]` and `[BWR]` blocks back into the reason so the operator can see what got shot down.
- `Raise { target, reason }` — a face detected upstream staleness and is interrupting the Controller. Only meaningful under a `Controller` header; the engine halts if it arrives under any other.
- `RoutingRequest(payload)` — the current role is explicitly handing off. The engine's `detect_routing_target` scans the payload for `"K4-AlgebraicIntakeValidator"` / `"K4-AlgebraicIntentBridge"` / `"K4-AlgebraicSwarmController"` / `"K4-ParadoxEngine"` and compiles the named role's prompt around the payload. If nothing names a target, `default_next_role(header_kind)` supplies a fallback (Validator → Bridge, Bridge → Controller, Controller stays, Paradox → Bridge).
- `SwarmPayload(payload)` — the Bridge locked and is passing a full Swarm Initialization Payload downstream. Always routes to the Controller.
- `FaceRunnerPrompt(content)` — the Controller is dispatching work to a specific pole. `handle_face_work` executes it: if `held_role == Material`, the output goes to `sandboxes/Run_<cycle>/`; otherwise it goes to the Working Surface via `surface.write`.
- `PhaseTransitionRecord(payload)` — the Controller is committing a cycle. `vfs.write_ptr` is called, state resets to `ColdStart`, and the engine yields `Success`.
- `PossibilityMap(content)` — the Paradox Engine exited. Emits `Success` and resets.
- `HeldParadoxes(text)` — the Paradox Engine is pausing with an interactive question. Same effect as `PlainText`: yield `AwaitUser`, mark mode `ExpectUser`.
- `PlainText(text)` — the current role is speaking to the operator directly (Bridge asking a question, Paradox describing a paradox). Yield `AwaitUser`.

The parser has no domain logic. It classifies. What the engine does with the classified artifact is the state machine's problem.

## The state machine — `engine.rs`

`K4Engine` holds:

- `mode: StepMode` — one of `ColdStart`, `ExpectLlm`, `ExpectUser`. Tracks what the *next* input is expected to be.
- `last_role: PromptRole` — which of the four instruments last emitted. Determines which continuation prompt gets built when the operator replies to an `AwaitUser`.
- `current_state: Option<ControllerHeader>` — the Controller cycle's live state, kept because face-runners inherit it.
- `last_bwr: Option<String>` — the Bridge's most recent BWR block, used to echo into a `VALIDATION INTERCEPT` halt so the operator can see what was locked when the Validator shot it down.
- `last_bridge_state: Option<String>` — same, for the last Bridge `[STATE]` line.
- `domain_context: String` — vocabulary text injected by the TS host before each turn.
- `vfs: VirtualFileSystem`, `surface: WorkingSurface`, `parser: K4Parser` — engine's persistent internals.

The `step_command` core is short and worth reading in full:

```
if input contains "[STATE]"
    mode → ExpectLlm
    parse; on error emit Halt("Structural Shear: ...")
    dispatch on the parsed artifact
else match mode:
    ColdStart   → mode = ExpectLlm; wrap in Validator prompt, emit FetchLLM
    ExpectUser  → mode = ExpectLlm; wrap in last_role's prompt, emit FetchLLM
    ExpectLlm   → parse (structured LLM output path); Halt on parse failure
```

The `ExpectUser` branch is the piece that fixed the historical "second-turn shear." Under an earlier `is_cold_start` bool, an operator reply after a Bridge question was fed to the parser and immediately halted on missing `[STATE]`. The fix: after an `AwaitUser` the next operator reply is not LLM output — it's payload for the last emitting role. The engine wraps it in that role's continuation prompt and asks the TS host for a fresh `FetchLLM`.

The four `TerminalArtifact` handlers map cleanly to `JsCommand`:

- `PlainText` / `HeldParadoxes` → `AwaitUser`. Records `last_role` from the header kind, sets mode `ExpectUser`.
- `RoutingRequest` / `SwarmPayload` / `FaceRunnerPrompt` → `FetchLLM` with a fresh compiled prompt. Mode stays `ExpectLlm`.
- `Raise` → `FetchLLM` with a face-runner prompt rebuilt around the raised target and an annotation of the raise reason. Increments the raise counter; halts if the cap is exceeded.
- `Halt` / `PhaseTransitionRecord` / `PossibilityMap` → terminate. PTR triggers a `vfs.write_ptr` and resets mode to `ColdStart`.

Prompt compilation is bundled inline. The four instrument prompts are pulled into the binary at build time:

```rust
const PROMPT_VALIDATOR:  &str = include_str!("../../prompts/AlgebraicIntakeValidator.md");
const PROMPT_BRIDGE:     &str = include_str!("../../prompts/AlgebraicIntentBridge.md");
const PROMPT_CONTROLLER: &str = include_str!("../../prompts/AlgebraicSwarmController.md");
const PROMPT_PARADOX:    &str = include_str!("../../prompts/AlgebraicParadoxEngine.md");
```

This is the Cold-Start Rule: a blank LLM instance receives the entire algebraic harness inline every turn. There is no context memory to prime, no fine-tuned checkpoint. Each turn is stateless from the LLM's perspective; state lives in the engine.

`compile_bridge_prompt` is the one that reads the VFS to inject Braid context — the last committed stance's name and the four Gray-code-adjacent facet IDs — as `[BRAID-CONTEXT: last-stance <name> | legal-facets [2, 3, 9, 11]]`. Under the current numbering, Leverage's neighbors are Momentum (2), Synthesis (3), Capacity (9), and Accounting (11). The Bridge is geometrically forbidden from proposing a diagonal leap.

`compile_face_runner_prompt` writes the dimensional fork into the prompt itself:

- `held_role == Nil`: *"You are operating on the {plane}-Face (2D K3 plane). AbsentVar is nil. Do not treat it as a target."*
- `held_role == Material`: *"You are operating in the K4 volume. AbsentVar is the axis you map. Write to Sandbox Run_{cycle}."*

Same face, same equations, different geometry. The engine writes this in — the LLM doesn't choose which mode to run.

## The VFS — `vfs.rs`

The `VirtualFileSystem` owns everything committed and everything quarantined:

- `documentation: HashMap<String, String>` — shared corpus. Docs the operator marked with `A` (all faces) land here.
- `distilled: HashMap<Pole, HashMap<String, String>>` — face-specific docs, one map per pole.
- `abstracted: HashMap<Pole, HashMap<String, String>>` — boundary specs per pole (minutiae withheld).
- `sandboxes: HashMap<String, HashMap<String, String>>` — quarantined Hold-run outputs keyed by `Run_<cycle>`.
- `braid: BraidTree` — the committed history.

`hydrate_from_manifest` takes the manifest the TypeScript host built from the current circuit's active documents and populates `documentation` / `distilled` from the per-document pole flags. This runs once per cold `step_submission`.

`write_ptr` is the only function that writes to the Braid tree. This is the Landauer Tax chokepoint — the moment the system decides, it pays the cost of erasure by committing:

```rust
PhaseTransitionRecord {
    thread_id, thread_action,
    cycle, final_seq,
    stance:      header.stance.equation_name(),   // Paradox vocab
    home_variable: header.stance.home(),
    operating_plane: header.plane,
    path_traversed:  header.path.clone(),
    held_pole:  header.stance.absent(),
    held_role:  format!("{:?}", header.held_role).to_lowercase(),
    surface_snapshot,                             // full slot state
    health:     "clear" | "raises: k" | "HALTED: ...",
}
```

Every uncommitted piece has a different destination. The Bridge's BWR lives in `last_bwr` — engine-side scratch — and never touches disk. Hold-run face outputs go to `sandboxes/` via `write_to_sandbox`. Push-run face outputs go to the Working Surface. The Working Surface's committed state at cycle-close is the surface_snapshot inside the PTR. Nothing else reaches the Braid.

`get_braid_context` reads the latest PTR's stance, parses it back through `parse_stance_from_name` (the polyglot resolution runs *both* directions — the stance may have been written in any role's vocabulary), computes `viable_adjacencies`, and returns the four `facet_id`s. Cold state — no active thread, or no latest PTR — returns all twelve. Warm state returns exactly four.

## The Working Surface — `state.rs`

Four slots, one per pole. Each slot holds `Option<String>` content, an `Option<WriteStamp>`, and a `SlotState` — `Unwritten`, `Prior`, `Current`, or `Stale`. Every write carries a `WriteStamp { cycle, seq, writer, stance }` — a monotonically-increasing `seq` inside a cycle is what makes staleness detectable.

`recompute_staleness` walks the current cycle's path. For each pole X at position i, if any earlier pole Y on the path (`i > 0`) has a `y_stamp.seq > x_seq` within the same cycle, X flips to `Stale`. A face reading a stale slot is expected to emit `[RAISE]`. The Controller handles the raise by either patching upstream (increment raises counter, re-dispatch) or halting if the raise cap is exceeded.

This is what "the algebra catches the drift" means concretely. There is no reviewer agent. If Face U wrote at seq 5 and Face P then wrote at seq 8, then Face I (which was scheduled between them and had already read U's slot as Current) will see U flip to Stale when P completes. Face I's next read will trigger a raise. The path-precedence rule doesn't need to be understood by the LLM; it's applied to the slots directly.

## The IoC boundary — `JsCommand`

The Rust engine cannot make a network call. Every yield is a `JsCommand`:

```rust
enum JsCommand {
    FetchLLM  { prompt: String },
    AwaitUser { text:   String },
    Halt      { reason: String },
    Success   { message: String },
}
```

The TS host's `runEngineLoop` in `bridge.ts` handles each variant: for `FetchLLM`, it calls the configured LLM API and hands the response back with `engine.step(response)`; for `AwaitUser`, it updates UI state and waits; for `Halt` and `Success`, it stops the loop. This is what keeps the Rust kernel a pure synchronous state machine — every place it would otherwise need to reach out becomes a return-and-wait.

## The Wasm entry — `lib.rs`

Deliberately tiny. Two exports:

```rust
create_engine_with_state(saved_vfs_json: &str) -> K4Engine
dispatchable_kinds() -> JsValue    // → ["validator", "bridge", "controller", "paradox"]
```

The `K4Engine` struct itself is `#[wasm_bindgen]`-annotated, so its public methods (`step`, `step_submission`, `load_vfs_state`, `set_domain_context`, `reset_run`, `reset_all`, plus the `vfs_state` / `current_role` / `current_mode` getters) are all callable from the TS host.

## What the code doesn't do yet

Two pieces are shaped but not complete.

**Multi-cycle Controller progression.** `is_cycle_complete` currently returns `true` unconditionally, and `get_next_face_in_path` returns `state.path.first().copied().unwrap_or(Pole::P)` — always the first face. This means every face-runner work-product leads directly to a PTR write and cycle end. Path iteration (dispatching each pole in the PATH in turn, advancing through cycles until termination) is not wired. The Controller pipeline the prompt harness describes (C1 through C9) is fully specified on the LLM side; the Rust side executes only C1–C7 in one shot.

**Cycle-boundary Sever.** `handle_face_work` always writes with `ThreadAction::Continue`. The `Sever` variant exists in `vfs.rs::ThreadAction` and is honored inside `write_ptr` (it parks the current thread and starts a new one), but no code path currently emits it from face completion. Braid severance requires an explicit call site that isn't there.

Everything else — the card-landing router, the polyglot stance resolution, the Gray-code adjacency computation, the path-precedence staleness, the PTR-only write chokepoint, the dimensional fork on `held_role`, the Validator's `VALIDATION INTERCEPT` echo of `[STATE]` and `[BWR]` — is the geometry the workbench is worked in, live in the code you're running.
