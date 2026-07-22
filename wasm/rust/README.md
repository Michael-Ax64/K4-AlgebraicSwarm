# The Rust Wasm Kernel: Algebraic Engine and OS Kernel
### A Deep Dive into the `rust/` Architecture

If the TypeScript frontend is the thermodynamic environment and relational flow, the Rust WebAssembly kernel is the **rigid geometry**. It is the OS Kernel, the Ledger, and the Landauer Tax enforcer. 

The Rust backend does not compute *meaning*; it computes *topology*. It possesses no domain knowledge, no semantic understanding, and no network access. It is a purely synchronous state machine that ingests text, classifies it against a 12-equation matrix, enforces structural boundaries, and yields control back to the TypeScript host.

Here is the in-depth architectural study of the `rust/` directory.

---

## 1. The Algebraic Substrate (`algebra.rs`)
The foundation of the kernel is the **Algebra of Four-Fold Distinction**. The Rust engine does not use fuzzy semantic embeddings; it uses strict, discrete geometric coordinates.

### The 4 Poles and Kinematics
Every operation is grounded in the four poles, defined not by what they *do*, but by their two-bit kinematic signature:
*   **P (Fire)**: Active + Asserting
*   **U (Air)**: Active + Yielding
*   **I (Water)**: Reactive + Yielding
*   **R (Earth)**: Reactive + Asserting

### The Polyglot Stance Parser
One of the most important pieces of engineering in the backend is `parse_stance_from_name`. 
The four K4 instruments (Validator, Bridge, Controller, Paradox) use **different vocabularies** to name the exact same 12 geometric stances. For example:

*   The **Bridge** calls `(R, P)` "Friction".
*   The **Controller** calls `(P, U)` "Friction".
*   The **Paradox Engine** calls `(I, U)` "Resonance", while the **Bridge** calls `(I, R)` "Resonance".

If the parser relied on label matching, the runtime would collapse into ambiguity. Instead, `parse_stance_from_name` enforces a **Polyglot Resolution**:
1.  It first attempts a full-string match including the equation suffix (e.g., `"Friction (P = I² × R)"`). The equation suffix mathematically disambiguates the collision.
2.  If only a bare label is provided, it falls back to a deterministic first-hit resolution.
This allows the single Rust binary to seamlessly host all four LLM roles, hearing any of the three spec vocabularies and mapping them to the invariant `(home, absent)` geometric pair.

---

## 2. The Message-Boundary Airlock (`parser.rs`)
The parser is the Markov Blanket applied at the *message boundary*. Just as the Validator gates the operator, the parser gates the LLM's output. 

### Classify-then-Dispatch
The LLM output is not a monolithic string; it is a carrier of state from a specific "station" in the process. The parser reads the `[STATE]` header and classifies it by station-marker keys:
*   Contains `GATE` $\rightarrow$ **Validator** (Carries gate status, binding, routing).
*   Contains `MODE=paradox` $\rightarrow$ **Paradox Engine** (Carries anchor state, rung depth).
*   Contains `PHASE` (but no `CYCLE`) $\rightarrow$ **Bridge** (Carries phase-lock coordinates, coherence $\rho$, phase $\theta$).
*   Contains `CYCLE` $\rightarrow$ **Controller** (Carries monotonic `SEQ`, stance, path, raise caps).

**The header shapes do not disagree; they route.** A Bridge header cannot say `CYCLE` because the Bridge is pre-cycle; a Controller header cannot say `RHO` because coherence is upstream work. The parser enforces this strict typing.

### Terminal Artifacts
Once the header is admitted, the parser classifies the body into a `TerminalArtifact`. This is how the LLM signals its intent to the state machine:
*   `Halt`: The run is dead (e.g., `VALIDATION INTERCEPT`, `IRRECOVERABLE SHEAR`).
*   `Raise`: A face detected upstream staleness and is interrupting the Controller.
*   `RoutingRequest`: The Validator is passing clean text to the Bridge.
*   `FaceRunnerPrompt`: The Controller is dispatching work to a specific pole.
*   `HeldParadoxes`: The Paradox Engine is pausing to wait for operator recognition.
*   `PlainText`: The Bridge is asking the operator a question (triggers `AwaitUser`).

---

## 3. The State Machine & Inversion of Control (`engine.rs`)
The `K4Engine` struct is the heart of the Wasm binary. It operates on a strict Inversion of Control (IoC) pattern. It cannot call the LLM; it can only emit a `JsCommand` to the TypeScript host.

### The Step Modes
The engine tracks its exact expectation via `StepMode`:
1.  **`ColdStart`**: The operator just submitted text. The engine wraps it in the Validator prompt and emits `JsCommand::FetchLLM`.
2.  **`ExpectLlm`**: The engine is waiting for the LLM to return structured output. It passes the text to the `K4Parser`.
3.  **`ExpectUser`**: The LLM emitted a `PlainText` or `HeldParadoxes` artifact. The engine pauses and emits `JsCommand::AwaitUser`.

### Fixing the "Second-Turn Shear"
Early iterations suffered from a fatal shear: when the engine was in `ExpectUser` and the operator replied, the engine fed the operator's plain text back into the `K4Parser`, which immediately halted because it lacked a `[STATE]` header. 
The backend solved this in `step_command`: if `mode == ExpectUser`, the engine **bypasses the parser entirely**. It takes the user's raw reply, wraps it in the continuation prompt of the `last_role` (e.g., the Bridge), and emits `FetchLLM`. The operator's text is treated as payload, not as LLM output.

### The Cold-Start Rule
The framework demands that a blank LLM instance must be able to execute the entire algebraic harness without prior context. 
The Rust backend enforces this physically via the `include_str!` macro:
```rust
const PROMPT_VALIDATOR: &str = include_str!("../../../prompts/K4-AlgebraicIntakeValidator.md");
const PROMPT_BRIDGE: &str = include_str!("../../../prompts/K4-AlgebraicIntentBridge.md");
// ...
```
The master prompt specifications are compiled *directly into the Wasm binary*. 
When the engine compiles a prompt for the TS host to send to the LLM, it injects the entire 12-equation lexicon inline. There are no external dependencies; the geometry is baked into the silicon.

### The Dimensional Fork (Push vs. Hold)
When the Controller dispatches a `FaceRunnerPrompt`, the engine checks the `HeldRole`:
*   If `Nil` (Push): The prompt instructs the LLM to operate on the 2D K3 Face. The AbsentVar is off-plane.
*   If `Material` (Hold): The prompt instructs the LLM to enter the 3D K4 Volume. 
The engine intercepts the LLM's output and routes it exclusively to a quarantined **Sandbox** (`vfs.write_to_sandbox`), protecting the main Working Surface from uncollapsed exploratory data.

---

## 4. The Ledger & The Landauer Tax (`vfs.rs` & `state.rs`)
The backend owns the Working Surface and the Braid Tree. It enforces the thermodynamic cost of erasure.

### The Working Surface & Path-Precedence Staleness
The surface consists of 4 slots (P, U, I, R). Every face reads all 4. 
To prevent silent trajectory loss, the backend enforces strict staleness rules via `recompute_staleness`:
*   Every write carries a `WriteStamp` with a global, monotonic `SEQ`.
*   If Face $X$ reads Face $Y$'s output, but $Y$ subsequently re-runs and overwrites its slot with a *newer* `SEQ`, $X$ is instantly marked `SlotState::Stale`.
*   A stale slot forces a `RAISE`. The algebra catches the drift automatically; no reviewer agent is needed.

### The Braid Tree and Gray-Code Adjacencies
The `VirtualFileSystem` maintains the `BraidTree`, an append-only history of `PhaseTransitionRecords` (PTRs). 
When the Bridge needs to sweep for a resonance lock, it cannot just pick any of the 12 facets.
It must respect the Braid's continuity. The backend provides `vfs.get_braid_context()`, which:
1.  Reads the `last_stance` from the latest PTR.
2.  Calls `stance.viable_adjacencies()`.
3.  Returns the exact **4 Gray-code-adjacent facet IDs** (the stances reachable by a single-bit geometric pivot).
The engine injects these legal facets into the Bridge's prompt (`[BRAID-CONTEXT]`). 
If the Bridge attempts to lock a diagonal facet, the Controller's C7 Braid-verify will reject it as `IRRECOVERABLE SHEAR`. The geometry forbids the leap.

### The Landauer Tax Enforcer
The `vfs.write_ptr()` method is the only function that writes to the Braid tree. 
It collapses the Working Surface into a committed `PhaseTransitionRecord`. 
This is the Landauer Tax: the moment the system decides, it must pay the thermodynamic cost of erasing the unchosen paths by writing the committed state to the ledger. 
The PTR carries the full `surface_snapshot` (including `SlotState`), ensuring that if the session is killed and resumed, the exact topological state is restored.

---

## 5. The Test Suite as Structural Proofs
The Rust test suite (`smoke.rs`, `stance_names.rs`, `headers.rs`, `step_mode.rs`, `routing.rs`) is not just checking for regressions; it is proving the topological invariants of the system.

*   **`stance_names.rs`**: Proves the Polyglot Parser works. It feeds the exact same `(home, absent)` pair through the Bridge, Controller, and Paradox vocabularies and asserts they all resolve to the identical geometric coordinate.
*   **`step_mode.rs`**: Proves the "Second-Turn Shear" is dead. It simulates a cold start, an LLM `AwaitUser` response, and an operator plain-text reply, asserting that the engine correctly recompiles the reply into a `FetchLLM` command rather than halting on a missing `[STATE]` header.
*   **`routing.rs`**: Proves the Braid context math. It commits a "Leverage" PTR `(P, I)` and asserts that `get_braid_context()` returns exactly facets `1, 3, 9, 11` (Synthesis, Momentum, Capacity, Accounting)—the exact 4 geometric neighbors.
*   **`headers.rs`**: Proves the Airlock. It feeds malformed, cross-vocabulary, and dead-lettered headers into the parser, asserting that the classify-then-dispatch logic perfectly segregates the four stations without bleeding state.

---

## Summary

The `rust/` directory is an example of constraint-based design. 
1.  **It is Stateless and Bounded:** It holds no semantic context, only geometric state.
2.  **It is Strictly Typed:** The parser enforces that the Bridge cannot speak in Controller terms, and the Validator cannot speak in Bridge terms.
3.  **It is Thermodynamically Honest:** It enforces the Landauer Tax via the VFS, ensuring that uncollapsed potential (Hold) is quarantined in sandboxes, while committed reality (Push) pays the cost to write to the Braid.
4.  **It Yields gracefully:** Through the `JsCommand` IoC boundary, it allows the TypeScript host to handle the messy reality of network I/O, DOM rendering, and database persistence, while the Rust kernel remains a pure, uncorrupted algebraic engine.

The Rust kernel does not try to make the LLM smart.
It makes it structurally impossible for the LLM to be geometrically stupid.
