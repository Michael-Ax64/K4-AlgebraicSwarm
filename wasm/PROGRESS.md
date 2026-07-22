# Progress — audit recommendations 1-4 applied

**Verdict up front.** All four top-of-list recommendations from `AUDIT.md`
implemented and covered by tests. **40/40 tests pass** (11 + 2 + 5 previously,
plus 22 new). Zero compiler warnings under `#![warn(unused, dead_code,
unused_imports, unused_variables, unused_mut)]`. Zero API changes visible to
the UI — the `vfs_state` JSON shape is unchanged.

## What each step delivered

### Step 1 — Stance name reconciliation

**File changed:** `src/algebra.rs`.

Added:
- `SpecRole` enum (`Validator | Bridge | Controller | Paradox`) tagging which
  vocabulary a stance name belongs to
- `Stance::facet_id() -> u8` returning the 1..=12 canonical facet number
  (consistent across all three spec tables)
- `Stance::spec_name(role) -> &'static str` emitting the role-specific label
  (`Yield` for Bridge's I/U vs `Resonant` for Controller's, etc.)
- `Stance::equation_name()` retained, now delegates to `spec_name(Paradox)`
  — the historical canonical form. All existing callers keep working.

`parse_stance_from_name` extended to accept **all three vocabularies** —
whichever role emits a stance name, it parses. Two collision cases resolved:

- **"Friction"** — Bridge means `(R, P)` (impedance-shaped), Controller means
  `(P, U)` (momentum-shaped). With the equation suffix attached, both
  disambiguate cleanly.
- **"Resonance"** — Bridge means `(I, R)`, ParadoxEngine means `(I, U)`. Same
  disambiguation.

Tests: `tests/stance_names.rs`, 6 tests including a full 12×3 roundtrip.

### Step 2 — `StateHeader` split into per-role variants

**Files changed:** `src/state.rs`, `src/parser.rs`, `src/engine.rs`, `src/vfs.rs`.

Previously: one `StateHeader` struct with all Controller fields required.
Bridge-classified headers dead-lettered on `Missing CYCLE`.

Now: four typed headers plus a discriminating enum:

```rust
pub enum ParsedHeader {
    Validator(ValidatorHeader),   // GATE | KA | KB | ROUTE
    Bridge(BridgeHeader),         // TURN | PHASE | LOCK | LAST_FACET | RHO | THETA | PF | Qf
    Controller(ControllerHeader), // CYCLE | SEQ | STANCE | PLANE | HELD | PATH | FACE | RAISES | STATUS
    Paradox(ParadoxHeader),       // TURN | MODE | ANCHOR | AT | RUNG | RECOGNIZED
}
```

`ControllerHeader` is the old `StateHeader` renamed; a type alias
(`pub type StateHeader = ControllerHeader`) keeps existing consumers working.

Parser split into `parse_validator_header`, `parse_bridge_header`,
`parse_controller_header`, `parse_paradox_header`. Classification-then-dispatch:
`GATE` → Validator, `MODE=paradox` → Paradox, `PHASE`-without-`CYCLE` → Bridge,
`CYCLE` → Controller. No key present → structured error.

Engine's `evaluate_artifact` now matches on variant. Controller-shaped artifacts
(FACE-RUNNER PROMPT, [RAISE], PTR) demand a Controller header via
`ParsedHeader::as_controller()` and emit a `Halt` if the artifact-header
combination is nonsensical (RAISE from a Bridge header, for instance).

Tests: `tests/headers.rs`, 9 tests. Includes the regression that Bridge headers
now parse instead of dead-lettering, and the cross-vocabulary case where a
Controller header carries a Bridge-style stance name.

### Step 3 — Wire `viable_adjacencies` into `get_braid_context`

**File changed:** `src/vfs.rs`.

Was a placeholder returning `vec![1, 2, 3, 4]`. Now:

1. Reads the active thread's latest PTR
2. Parses the stance name (accepts any of the three vocabularies via Step 1)
3. Calls `stance.viable_adjacencies()` — the geometric-pivot law, unchanged
4. Maps each of the 4 neighbors to its facet ID via `facet_id()`

Returns `(Some(last_stance), [id1, id2, id3, id4])`. Cold projects (no thread,
no PTR, or unparseable stance) return `(None, 1..=12)`.

Tests: `tests/routing.rs::{cold_project_returns_all_twelve_facets,
warm_project_returns_gray_code_adjacent_facets,
braid_context_accepts_ptr_written_in_any_vocabulary}`. The middle test uses the
ParadoxEngine spec's worked Leverage example — expects neighbors Synthesis (1),
Momentum (3), Capacity (9), Accounting (11), and gets exactly those.

### Step 4 — `PromptRole` enum threading through prompt compilation

**File changed:** `src/engine.rs`.

Added:
- `PromptRole` enum
- `detect_routing_target(payload) -> Option<PromptRole>` — scans a routing
  payload for `K4-AlgebraicIntakeValidator | K4-AlgebraicIntentBridge |
  K4-AlgebraicSwarmController | K4-ParadoxEngine`
- `default_next_role(header_kind) -> PromptRole` — the fallback when the
  payload doesn't name a target (Validator→Bridge, Bridge→Controller, etc.)
- Four per-role prompt templates: `compile_validator_prompt`,
  `compile_bridge_prompt`, `compile_controller_prompt`, `compile_paradox_prompt`
- `compile_role_prompt(role, payload)` unifying dispatch
- `K4Engine.last_role` — tracks which role last handed the operator over, so
  the ExpectUser continuation goes back to the correct one

`RoutingRequest` handling now detects the target role from the payload and
compiles the right template. `SwarmPayload` implicitly routes to Controller
(Bridge P6 → Controller C1 handoff). `PlainText` (a Bridge P2 articulation, a
Paradox held paradox, etc.) sets `last_role = header_kind` so the subsequent
operator reply re-enters the same instrument.

Tests: `tests/routing.rs::{routing_request_naming_controller_produces_controller_prompt,
routing_request_naming_bridge_produces_bridge_prompt,
bridge_swarm_payload_routes_to_controller, await_user_continuation_uses_emitting_role}`.

Prompt templates themselves are still short (~10 lines each) — they name the
role, state the mandate, list the required emission format, and carry the
payload. Cross-cutting issue C3 in the audit (undersized prompts vs the
cold-start rule) is **partially addressed**: templates now match specs on
role identification and required artifact envelope, but they still assume the
LLM has the full spec document available in a separate context load. That
is documented in the templates themselves.

## Cross-cutting issues status

From the audit's cross-cutting list:

- **C1 (three vocabularies)** — resolved at the parser layer via Step 1.
  The specs still disagree; the parser tolerates all three. If you want the
  cleaner path (pick canonical, update two spec docs), the machinery makes it
  a one-line change: swap `equation_name` to `spec_name(Controller)` and the
  runtime emits Controller vocabulary.
- **C2 (header shape drift)** — resolved via Step 2.
- **C3 (undersized prompts)** — partially resolved via Step 4. Templates now
  identify their role and required emission shape; they don't yet inline the
  full harness (poles + 12 equations + ring criteria + slot-state rule + RAISE
  schema). Item 5 in the audit's deferred list.

## What's still deferred (unchanged from AUDIT.md)

Items 5–8 in the audit's prioritized list:

- **5.** Grain Ledger modeling (`ElementRole` still unused)
- **6.** `PhaseTransitionRecord::surface_snapshot` extension to carry
  `SlotState` per pole
- **7.** Face-runner prompt fork on `HeldRole` (Push K3 vs Hold K4 sandbox)
- **8.** Merged-submission ingest (Validator's D0 + D1..N architectural claim)

Plus the specs' own phase machinery still to build on top: Bridge P0–P6/P4b/P5b,
Paradox E0–E3/P-ROOM/E-EXIT, Controller C7 Braid verification with real Sever
semantics, Controller C9 deliverable assembly.

## File tree in this bundle

```
.
├── PROGRESS.md                       ← this file
├── AUDIT.md                          ← original audit, unchanged
├── src/
│   ├── algebra.rs                    ← Step 1
│   ├── state.rs                      ← Step 2 (new header structs)
│   ├── parser.rs                     ← Step 2 (ParsedHeader dispatch)
│   ├── engine.rs                     ← Steps 2 + 4 (variant handling + PromptRole)
│   └── vfs.rs                        ← Step 3
└── tests/
    ├── smoke.rs                      ← existing (updated to unwrap ParsedHeader::Controller)
    ├── interaction.rs                ← existing
    ├── step_mode.rs                  ← existing (assertions updated for new prompt shape)
    ├── stance_names.rs               ← Step 1 tests (6)
    ├── headers.rs                    ← Step 2 tests (9)
    └── routing.rs                    ← Steps 3+4 tests (7)
```

## Verification

```bash
cd k4-manifold
cargo test    # 40 passed; 0 failed
cargo build   # 0 warnings under -W unused
```
