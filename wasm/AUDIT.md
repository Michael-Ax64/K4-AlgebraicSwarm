# Audit — Rust/TS implementation vs. the four K4 prompt specs

**Scope.** Comparison of the current `k4-manifold` Rust crate and its TypeScript UI against the four prompt specifications: Validator, Bridge, Controller, Paradox Engine.

**Method.** Read every "REQUIRED" or "MANDATORY" clause in each spec, map to code, mark as ✅ present, ⚠ partial, or ❌ absent. Cross-cutting issues that don't fit one spec get their own section.

**Verdict up front.** The Controller is roughly 40% built and the algebra is faithfully implemented. Everything else — the Validator, the Bridge's phase machinery, the ParadoxEngine's phase machinery, and the wiring between the four instruments — is either stubbed or absent. There are also three real cross-cutting issues that will bite before any single spec gets closer to done. The system is closer to a testbed for the algebra than to a running K4 stack.

---

## The StepMode patch (applied)

`engine.rs` — `is_cold_start: bool` replaced with `mode: StepMode` (`ColdStart | ExpectLlm | ExpectUser`). `evaluate_artifact` now sets `mode = ExpectUser` on `PlainText`. `step` now dispatches on mode: `ColdStart`/`ExpectUser` compile a prompt; `ExpectLlm` runs the parser.

Testability: extracted `step_command(input: &str) -> JsCommand` from the wasm-bindgen `step`, and added `pub fn mode() -> StepMode` so tests can inspect transitions.

Verified by `tests/step_mode.rs` — 5 new tests, all pass. The critical one is `user_reply_after_await_user_is_recompiled_not_parsed`, which exercises the exact scenario `tests/interaction.rs` proved used to HALT. It no longer HALTs.

Total: **18/18 tests pass** (11 smoke + 2 interaction + 5 step_mode).

---

## Verdict per spec

### 1. Controller — the most-built layer (roughly 40%)

The Rust `StateHeader` matches the Controller's `[STATE]` carrier exactly (`CYCLE | SEQ | STANCE | PLANE | HELD | PATH | FACE | RAISES | STATUS`). The parser handles it. This part is real.

**What's in:**
- ✅ 12 stances + Pole kinematics, algebra layer solid
- ✅ Global monotonic `SEQ` counter, bumped in `WorkingSurface::write`
- ✅ Four slot states (`Unwritten | Prior | Current | Stale`) exactly matching the C5 table
- ✅ The staleness rule: **`STALE(X) ⟺ X.cycle = CYCLE ∧ ∃Y : Y ≺ X on PATH ∧ Y.seq > X.seq`** — implemented in `recompute_staleness`, tested to fire correctly when an upstream write supersedes a downstream one
- ✅ `[RAISE]` artifact recognized with target + reason
- ✅ C6 raise cap enforced (`raises.0 >= raises.1 → HALT — IRRECOVERABLE SHEAR`)
- ✅ `FaceRunnerPrompt` and `PhaseTransitionRecord` artifacts recognized
- ✅ VFS structure (Documentation, Distilled per pole, Abstracted per pole, Sandboxes, Braid tree) mirrors the spec's `/Project/` layout
- ✅ PTR written on cycle end via `write_ptr`; JSON-roundtrips cleanly

**What's stubbed:**
- ⚠ Thread IDs are `thread-{cycle}` — every cycle spawns a new thread, so `Sever` semantics are degenerate. Needs a real ID scheme.
- ⚠ `is_cycle_complete` returns `true` unconditionally — no C8 termination check.
- ⚠ `get_next_face_in_path` returns `path.first()` — no path traversal state.
- ⚠ `format_for_prompt` doesn't include the 3 equations, pole charge, input/output pointers, or `[RAISE]` schema that C3 enumerates as compile-time requirements. A face receiving this would cold-start blind.

**What's absent:**
- ❌ **C1 Payload Ingest.** The spec expects a structured `# SWARM INITIALIZATION PAYLOAD` document with §1 Locked Coordinate, §2 Operating Plane, §4 Braid Continuity, §7 Grain Ledger. The `TerminalArtifact::SwarmPayload` variant carries the raw string; nothing parses it into fields.
- ❌ **Grain Ledger.** `ElementRole { Spec, Material, Nil }` exists in `state.rs` but is never used. The whole "use/mention distinction" the spec calls "load-bearing" is a dead struct.
- ❌ **Push vs Hold differential compile (C3).** Push = 2D K3 face-run; Hold = 3D K4 volume-run to a sandbox path. `HeldRole` is captured but doesn't fork the prompt template.
- ❌ **C2 file-access resolution ladder** — VFS has the Distilled/Abstracted/Documentation buckets, but the face compile never reads from them.
- ❌ **Face WORK ⊕ RAISE enforcement.** Spec says "exactly two possible terminal artifacts; never both." Parser accepts both simultaneously; no check.
- ❌ **Plane check at write** — spec: "no face may write content that computes the held pole into the Surface when that pole is `nil`." Not enforced.
- ❌ **C7 Braid verification** — the last two AbsentVars → next active pair rule is uncomputed.
- ❌ **C9 collapse & return** — no `R.assembles(deliverable)` step. The engine treats a `PhaseTransitionRecord` artifact as `Success` and stops.
- ❌ **Promotion** (Surface slot → `Project{P,U,I,R}`) — no code.

**Estimate: ~40% of the Controller spec's mechanics.** The primitives are right; the orchestration around them is missing.

---

### 2. Paradox Engine — algebra correct, orchestration absent (~15%)

**What's in:**
- ✅ **`Stance::viable_adjacencies()` implements the exact geometric law.** The spec is emphatic that adjacency is a geometric pivot (SHIFT METRIC on the same face, SHIFT PLANE with the same home) computed by (face, metric) lookup, **not** by bit-flipping the pole label — and it warns that label arithmetic manufactures a false asymmetry. The Rust does it by constructing new `Stance(home, absent)` pairs. Correct. The Leverage worked example in the spec (neighbors: Capacity, Accounting, Momentum, Synthesis) roundtrips cleanly.
- ✅ Parser recognizes Paradox header via `MODE: paradox` key
- ✅ `TerminalArtifact::PossibilityMap` recognized

**What's absent:**
- ❌ **E0–E3, P-ROOM, E-EXIT phase state machine** — no phases, no anchor ingest, no Held Paradox artifact type distinct from PlainText, no Recognition Read, no P-ROOM recursion, no Possibility Map assembly.
- ❌ **Partial-anchor enumeration.** The spec has three anchor modes: full stance (4 neighbors — implemented), home-only (3 stances sharing that home), face-only (3 stances sharing that face). Only the full-stance case exists. The 3-stance-per-face and 3-stance-per-home enumerations aren't computed anywhere.
- ❌ **`RUNG` and `RECOGNIZED` counters** — no state carriage.
- ❌ The domain-vocabulary substitution the spec insists on (`Never name the equation. Never name the stance. Name the tension.`) — LLM work, but there's no prompt template supporting it.

**Estimate: ~15%.** The geometric core is done and correct; every phase and orchestration piece is not.

---

### 3. Bridge — mostly absent (~5%)

This is where the gap is largest.

**What's in:**
- ✅ 12 stances present in algebra
- ✅ Parser recognizes Bridge header via `PHASE` key

**What's absent:**
- ❌ **Header shape mismatch.** The Bridge's state carrier is `TURN | PHASE | LOCK | LAST_FACET | RHO | THETA | PF | Qf`. The Rust `StateHeader` requires `CYCLE | SEQ | STANCE | PLANE | HELD` and fails parse without them. `classify_header` correctly identifies a Bridge header — and then `parse_and_validate_header` throws `MalformedHeader("Missing CYCLE")` regardless. So Bridge classification is dead-lettered.
- ❌ **BWR (Bridge Working Record) parsing/carriage.** `BridgeWorkingRecord` struct exists in `state.rs` (with `MapState`, `LiveProbe`, `BraidContext`) but is not read, written, parsed, or carried through anywhere. It's unused.
- ❌ **No P0–P6 phase machinery.** No `P0 — VOID INTAKE` halt, no `P1` anchor/axis/Qf calibration, no `P2` facet probe, no `P3` response read, no `P4` phase correction, no `P4b` phase verification, no `P5` triune, no `P5b` diagonal confrontation, no `P6` payload emit.
- ❌ **No coherence math** (12-substitution scoring, within-class σ/τ swap tests, R1–R4 ring criteria).
- ❌ **No phase machinery** (θ, PF, Qf tracking; capacitive/inductive complement selection).
- ❌ **No Bridge-specific artifacts.** `FacetArticulation`, `ComplementaryReactance`, `TriunePresentation`, `DiagonalConfrontation` all fall through to `PlainText → AwaitUser`. The engine has no way to distinguish "the Bridge is asking a facet-probe question" from "the Bridge is offering complementary reactance" from "the Bridge is presenting the triune choice."
- ❌ **No SwarmPayload → Controller routing.** Parser recognizes the artifact; engine writes a PTR and emits Success. Should hand off to a Controller prompt compile.

**Estimate: ~5%.** The stances exist. Nothing else does.

---

### 4. Validator — mostly absent (~3%)

**What's in:**
- ✅ `compile_validator_prompt` emits *something* on cold start
- ✅ Parser recognizes Validator header via `GATE` key
- ✅ `TerminalArtifact::RoutingRequest` recognized

**What's absent:**
- ❌ **The prompt itself is a 4-line stub.** No [FOUNDATIONAL LEXICON], no Gate A manifest, no Gate B four-checks list. A cold LLM instance receiving `compile_validator_prompt`'s output could not perform the gate — none of the material the spec calls "carried inline" is inline.
- ❌ **Single-string input forecloses the merged-submission architecture.** The Validator's central architectural claim — "there is one submission, not two" (Document 0 = prompt, Documents 1–N = corpus, all in one geometric frame so cross-document misrouting Check B.3 can fire) — is the reason the spec exists in its current form after amputation. `engine.step(input: &str)` accepts one string. Corpus files are not addressable at the input boundary.
- ❌ **Braid read before routing.** `vfs.get_braid_context()` returns a hardcoded placeholder `(None, vec![1,2,3,4])`. The Validator's routing block is supposed to compute Gray-code-adjacent `legal-facets` from `last-stance` using `Stance::viable_adjacencies()` — the machinery exists but isn't called.
- ❌ **State carry-through on dirty bounce.** Spec: on `HALT — VALIDATION INTERCEPT`, the Bridge's `[STATE]` + `[BWR]` are reflected untouched so the buffer survives the operator's fixes. No code path preserves and re-emits Bridge state.
- ❌ **Routing differential.** Validator can route to Bridge OR Controller (if a Payload is in flight). Engine treats every `RoutingRequest` the same via `compile_next_prompt`.

**Estimate: ~3%.**

---

## Cross-cutting issues

These affect all four instruments and will bite before any single one gets closer to done.

### C1 — Three specs, three stance-name tables

The 12 stances have **three different naming schemes** across the specs:

| home,absent | ParadoxEngine | Bridge (facet name) | Controller (stance name) | Rust `algebra.rs` |
|---|---|---|---|---|
| P, R | Synthesis     | Drive        | Synthesis    | **Synthesis** ✓ |
| P, I | Leverage      | Leverage     | Leverage     | **Leverage** ✓ |
| P, U | Momentum      | Momentum     | Friction     | **Momentum** |
| I, R | Extraction    | Resonance    | Extraction   | **Extraction** |
| I, P | Ohmic         | Throughput   | Ohmic        | **Ohmic** |
| I, U | Resonance     | Yield        | Resonant     | **Resonance** |
| U, R | Tension       | Tension      | Articulation | **Tension** |
| U, P | Architecture  | Architecture | Grounding    | **Architecture** |
| U, I | Capacity      | Capacity     | Geometric    | **Capacity** |
| R, P | Impedance     | Friction     | Impedance    | **Impedance** |
| R, I | Accounting    | Bloat        | Accounting   | **Accounting** |
| R, U | Brittleness   | Brittleness  | Density      | **Brittleness** |

**The Rust matches ParadoxEngine exactly.** It agrees with Bridge on 8/12 and with Controller on 8/12 (different eight). Any Bridge emitting `STANCE: Yield (I = √(P/R))` will hit `parse_stance_from_name`, get `"Unknown equation"`, and shear. Same for a Controller emitting `STANCE: Friction (P = I² × R)`.

The equations and (home, absent) pairs are consistent across all three specs. Only the labels disagree. **This has to be reconciled at the spec level, not patched in the parser** — otherwise the parser silently normalizes what is actually a live disagreement about vocabulary in three docs the LLM is being asked to bind to.

Two possible resolutions:
- Pick one canonical vocabulary and update the other two spec docs to match. (Cleanest.)
- Keep three vocabularies and teach `parse_stance_from_name` all three sets. (Faster, hides the disagreement.)

### C2 — Header shape drift between Bridge and Controller

The Bridge's `[STATE]` carrier and the Controller's `[STATE]` carrier share the name `[STATE]` but no fields:

| Field | Bridge | Controller |
|---|---|---|
| Turn/cycle counter | `TURN: n` | `CYCLE: n` + `SEQ: s` |
| Position | `PHASE: 0–6` | `STANCE: <eq>` + `PLANE: <pole>-Face` + `PATH: <chain>` |
| Lock | `LOCK: sweeping\|LOCKED\|...` | (implicit in status/held) |
| Scoring | `RHO`, `THETA`, `PF`, `Qf` | (none — the Controller doesn't score) |
| Raises | (none) | `RAISES: k/N` |
| Face | (none) | `FACE: <pole>` |

`K4Parser::classify_header` correctly distinguishes them by which keys are present, but `parse_and_validate_header` then insists on the Controller's required set unconditionally. Any Bridge header will `MalformedHeader("Missing CYCLE")`.

Two ways to fix:
- Two header structs (`BridgeStateHeader`, `ControllerStateHeader`) and a `ParsedTurn` enum that varies by header type
- One header struct with all fields optional, and typed accessors that assert presence based on classification

### C3 — Prompt compilation is stub-sized against the specs

The specs (especially the Bridge harness and Controller C3) are emphatic about the **cold-start rule**: any prompt handed to a fresh LLM instance must be executable from that prompt alone. That means the prompt has to *carry* the harness inline: the poles, the equations, the axes, the ring criteria, the slot-state rule, the RAISE schema, the current surface, the path, etc.

The current `compile_*` functions:

- `compile_validator_prompt` — 4 lines. No lexicon, no gates, no manifest.
- `compile_face_runner_prompt` — has the [STATE] header and the surface, but no pole charge, no 3 equations, no input pointers, no output pointer, no `[RAISE]` schema (it's referenced but not defined), no `SLOT-STATE` rule, no plane-lock language.
- `compile_next_prompt` — a generic transit wrapper. Would need to fork into `compile_bridge_prompt` and `compile_controller_prompt` because the Bridge and Controller headers and mandates are completely different.

The prompts are approximately as long as they'd need to be if the LLM already had the spec in its context. If this is the intent — always pre-load the K4 docs — that should be documented; if not, the prompts need to grow substantially.

---

## Prioritized recommendations

Ranked by leverage (how much a small change enables), not by size.

**1. Reconcile the stance names across specs (~1 hour, high impact).**
Three docs, three vocabularies, one Rust convention. Decide which naming wins, update the other two docs to match. Until this is settled, an LLM playing any of the three roles will emit stance names the parser doesn't recognize.

**2. Split `StateHeader` into `BridgeHeader` and `ControllerHeader` (~2 hours, unblocks the Bridge).**
Right now the parser can't accept a Bridge header at all — deadwood classification. Once Bridge headers parse, the whole Bridge phase machinery can start being built.

**3. Wire `Stance::viable_adjacencies()` into `vfs.get_braid_context()` (~30 min, closes the "cold vs warm project" distinction).**
The algebra is done. Just call it: read the latest PTR's stance from the active thread, compute the 4 adjacencies, return them as legal-facet IDs. The Validator's braid-read (spec `[BRAID READ]` block) then becomes real.

**4. Introduce a `PromptRole` enum threading through prompt compilation (~2 hours).**
`Validator | Bridge | Controller | Paradox`. `compile_next_prompt(payload, state, role)` picks the right template. This is the foundation for making the four-instrument handoff (Validator → Bridge → Controller → back) real rather than the current single-template flow.

**5. Model the Grain Ledger properly (~4 hours).**
`ElementRole { Spec, Material, Nil }` is defined but unused. Parsing §7 of a `SwarmPayload` and storing element roles is the precondition for the C5 precedence rule (`SPEC` contradiction → RAISE; `MATERIAL` contradiction is the deliverable), which is what makes corpus-prep runs safe.

**6. Extend `PhaseTransitionRecord::surface_snapshot` to carry `SlotState` (~30 min).**
Currently stores only content strings. Storing `{content, state}` means the UI's Braid History panel can show real staleness on committed history, and the C7 Braid-verify (last two AbsentVars → next active pair) has the data it needs.

**7. Fork the face-runner prompt on `HeldRole` (~2 hours, closes Push/Hold gap).**
Push and Hold are already declared to be dimensionally different (K3 face-run vs K4 volume-run per C3). Two prompt templates instead of one, keyed on `HeldRole`, with the Hold path writing to `Sandboxes/Run_{id}/` instead of the Surface.

**8. Merge-submission ingest (~4 hours, closes the Validator's central architectural claim).**
`engine.step(input: &str)` becomes `engine.step_submission(document_0: &str, corpus: &[(String, String)])`. The single-string interface is the reason cross-document misrouting (B.3) can't currently fire. This is a real API break, but it's the whole reason the Validator was reduced to one gate.

**Deferred until later:**
- The Bridge's full phase machinery (P0–P6, P4b, P5b) — needs items 1, 2, 4 first
- The ParadoxEngine's E0–E3/P-ROOM state machine — needs items 1 and 4
- C7 Braid verification with real Sever semantics — needs items 3 and 6
- C9 deliverable assembly — needs item 5

---

## Where we stand, in one sentence

The algebra is right, the Controller's surface + PTR primitives are right, the Paradox Engine's geometric adjacency law is right — and everything above that layer (phase machinery, gate logic, differential prompt compilation, the four-instrument handoff) is either stubbed, unused, or absent, with three real cross-cutting issues (stance-name divergence, header-shape divergence, undersized prompts) that will surface before any single spec gets much further.
