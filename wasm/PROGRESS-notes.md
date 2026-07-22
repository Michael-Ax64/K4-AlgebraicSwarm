# Progress — reframed comments + TS bindings for role tracking

## What changed

### Rust — comments only (no code changes)

Reframed the "cross-cutting issues C1/C2" narrative from the audit. What
I'd called *drift* and *disagreement* is actually **routing**: each K4
instrument stands at a different station in the process, so each carries a
different-shaped state carrier. The parser's classify-then-dispatch is the
Markov-blanket airlock applied at the message boundary — same input →
process → output shape, one level down from where the Validator applies it.

Comments added at:
- **`src/parser.rs` module doc** — full explanation of the four-station
  routing topology and why each header shape carries what it carries.
  Explicit statement that this parser is the message-boundary airlock,
  parallel to the Validator's operator-boundary one.
- **`ParsedHeader` enum doc** — names the enum as the four-variant
  admission record; explains why the shapes cannot be unified.
- **`parse_and_validate_header` fn doc** — states the input → process →
  output traversal explicitly, and calls out the parallel to the Validator's
  blanket work.
- **`SpecRole` enum doc (algebra.rs)** — explains that the three name
  tables are three role-flavored views of the same twelve geometric
  positions. Each role names positions by what it *does* while standing
  there (Bridge = phase-form of tension, Controller = mechanical process,
  ParadoxEngine = paradox held open).
- **`parse_stance_from_name` fn doc (algebra.rs)** — same input → process
  → output framing as the header parser. The runtime hosts all four roles,
  so the parser has to hear all three vocabularies.

Zero code changes for the comment pass. Tests still 40/40 pass.

### Rust — one small surface addition

Added two `#[wasm_bindgen(getter)]` methods on `K4Engine`:
- `current_role: string` → `"Validator" | "Bridge" | "Controller" | "Paradox"`
- `current_mode: string` → `"cold" | "expect_llm" | "expect_user"`

These expose the engine's own tracking of *which instrument is in the
loop* and *what the engine expects next*. The information already existed
internally (`last_role`, `mode`); it just wasn't wasm-visible.

`vfs_state` unchanged. `step` unchanged. Existing UI code stays compatible.

### TypeScript — role/mode surfaced into the UI

**`node_modules/k4-manifold/index.d.ts`** — stub updated with the two new
getters and `CurrentRole` / `CurrentMode` type aliases.

**`src/state.ts`** — two new signals:
```ts
export const currentRole = new Signal<CurrentRole>('Validator');
export const currentMode = new Signal<CurrentMode>('cold');
```

These are not the same as `uiState`. `uiState` is the UI's own view
(idle/processing/awaiting_user/halted). `currentRole` is which of the four
K4 instruments the engine is currently in dialogue with.

**`src/bridge.ts`** — `syncEngineState()` now reads both getters off the
engine on every step. Zero JSON round-trip; direct field access.

**`src/ui.ts`** — one new effect and one enriched effect:
- A **role badge** in the topbar showing "bridge · thinking" or
  "controller · awaiting reply" or "cold". Data attributes drive the
  background color per role (Validator = slate, Bridge = teal, Controller =
  green, Paradox = amber-brown).
- The **input placeholder** is now role-aware. Instead of the hard-coded
  "Respond to the Bridge's articulation…", it picks:
  * Validator: "Reply to the Validator…"
  * Bridge: "Reply to the Bridge's articulation…"
  * Controller: "Reply to the Controller…"
  * Paradox: "Which of these is bearing weight?"

**`index.html`** — added `#role-badge` slot in a new `.topbar` wrapper.
The old `#status-strip` moved inside the topbar next to the badge.

**`styles.css`** — new topbar layout, role-colored badge, no changes to
the existing status-strip styling.

## Verification

```bash
cd k4-manifold && cargo test    # 40 passed
cd ui && tsc --noEmit           # 0 errors under --strict
```

## What this closes and doesn't close

**Closed:** the UI can now show which instrument owns the current turn.
The operator watches a Bridge P2 articulation land with a teal badge that
says "bridge · awaiting reply"; a Controller cycle runs with a green
badge that says "controller · thinking." The mental model that the Rust
already had is now visible.

**Not closed:** the four items still deferred from AUDIT.md ranking —
Grain Ledger, per-slot state in PTRs, Push/Hold prompt fork, merged-
submission ingest. The role signal is a viewing-glass; those items are
still real work.

## File tree in this bundle

```
.
├── PROGRESS-notes.md              ← this file
├── src/                           ← Rust — all comment additions + 2 getters
│   ├── algebra.rs
│   ├── parser.rs
│   └── engine.rs
└── ui/                            ← TS — role/mode wiring
    ├── index.html
    ├── styles.css
    ├── node_modules/k4-manifold/index.d.ts
    └── src/
        ├── state.ts
        ├── bridge.ts
        └── ui.ts
```
