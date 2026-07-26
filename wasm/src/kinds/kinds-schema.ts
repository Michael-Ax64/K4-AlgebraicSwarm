// wasm/src/kinds/kinds-schema.ts
//
// ============================================================================
// KINDS — THE APP'S REGISTRY OF EXCHANGE SHAPES
// ============================================================================
//
// A `Kind` is a first-class thing the system can send toward and receive from.
// Every LLM exchange in the app belongs to exactly one Kind. The picker in
// Chat, the response parser, and the Ledger's row-typing all consult this
// registry.
//
// There is NO user-vs-engine tier. All Kinds are app-defined. The distinction
// that DOES matter is `dispatch`:
//
//   - `dispatch: 'engine'`   → compilation is owned by the Rust engine. The
//                              key must appear in engine.dispatchable_kinds().
//                              The `template` field is unused.
//   - `dispatch: 'template'` → compilation is owned TS-side. The `template`
//                              field is the prompt template.
//
// Both are Kinds. Both flow through the same picker, same Ledger, same
// receive parsing. The dispatch backend is one property the operator can
// see on the Kind's definition row, not a hidden implementation detail.
//
// ─── SCOPING ────────────────────────────────────────────────────────────────
//
// Kinds live at World or Project scope (`scope: 'world' | 'project'`, mirror
// of Language/Document scoping). Views inherit the union up the tier;
// composed picker rendering follows the header-divider rule.
//
// ─── OPERATOR-CONCERN VS PICKER SURFACE ────────────────────────────────────
//
// The Kind row exposes EVERYTHING about how the Kind works — the operator
// needs to understand the mechanics to work the substrate. But the picker
// at send-time is compact: alias, hint, legality only. Two surfaces on one
// object, at different verbosity.
//
// ─── SURGICAL-OP RULES ──────────────────────────────────────────────────────
//
// * The `key` is machine-stable and immutable after creation. Renaming
//   requires deleting and re-adding under a new key; existing Ledger rows
//   keep the old key (lookup returns undefined → alias falls back to key).
// * `alias` and `hint` are display-only. Editing them affects only the UI.
// * `dispatch: 'engine'` requires `key` to be in engine.dispatchable_kinds().
//   TS-side validation on upsert rejects mismatches with a Console warn.
// * The 'system' pseudo-kind used by LedgerRow.kind is NOT stored here.
//   It's the one reserved value that never resolves against this registry.
// * Do NOT add a `KIND:` header field for response routing. Response
//   classification uses the existing four instrument-header patterns (parser.rs)
//   plus the fallback PlainText — no new header vocabulary needed.
// * A row's alias is looked up at render time; never copied onto the row.
//
// ============================================================================

export type KindScope = 'world' | 'project';

export type KindDispatch = 'engine' | 'template';

/**
 * Which classes of prerequisite this Kind needs before it is legal.
 * The picker consults these against current engine state and current View
 * state, and greys out illegal Kinds with a hover-hint explaining what's
 * missing.
 *
 * All flags default to false when absent.
 */
export interface KindRequires {
  /** Requires a View to be active. Most Kinds want this. */
  view?: boolean;
  /** Requires at least one Document ticked for the active View. */
  attachedDocs?: 'none' | 'at-least-one' | 'exactly-one';
  /** Requires a locked coordinate in the engine (Bridge lock emitted). */
  lockedCoordinate?: boolean;
  /** Requires a Paradox anchor (usually a committed PTR). */
  anchor?: boolean;
}

/**
 * A Kind — the app's definition of one shape of exchange.
 *
 * `template` and `engineMechanicsDoc` are optional and mutually somewhat
 * exclusive: template-dispatched Kinds carry a template (the prompt),
 * engine-dispatched Kinds carry a mechanics description (short prose or a
 * reference to the K4 prompt spec file that defines the engine's dispatch).
 * Either can be empty; they're the operator's read-in when working with
 * the Kind.
 */
export interface Kind {
  id: string;

  scope: KindScope;
  scopeId: string;   // worldId or projectId

  key: string;       // machine identifier — immutable, unique within registry
  alias: string;     // operator-facing label
  hint: string;      // one-line "what this is for"
  family: string;    // grouping in the picker (e.g. 'instrument', 'analysis', 'chat')

  dispatch: KindDispatch;
  template?: string;              // when dispatch='template'
  engineMechanicsDoc?: string;    // when dispatch='engine' — short description or spec-file reference

  requires: KindRequires;

  createdAt: number;
  updatedAt: number;
}
