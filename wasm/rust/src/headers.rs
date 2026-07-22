// Verifies the ParsedHeader split works — each of the four role-specific
// state headers parses to its own variant, and the previously-dead-lettered
// Bridge headers now succeed.

use k4_manifold::algebra::Pole;
use k4_manifold::parser::{K4Parser, ParsedHeader, HeaderKind};
use k4_manifold::state::{
    BridgePhase, LockState, PhaseDirection, QFactor,
    GatePhase, BindStatus, SubmissionStatus, RouteTarget,
    AnchorKind,
};

// ─── Validator ─────────────────────────────────────────────────

#[test]
fn validator_header_parses() {
    let p = K4Parser::new();
    let input = "[STATE] GATE: A | KA: bound | KB: clean | ROUTE: bridge\n\
                 # ROUTING REQUEST\nnow run the Bridge with payload…";
    let parsed = p.parse(input).expect("should parse");
    assert_eq!(parsed.header.kind(), HeaderKind::Validator);
    let h = match &parsed.header {
        ParsedHeader::Validator(v) => v,
        _ => panic!("expected Validator"),
    };
    assert_eq!(h.gate,  GatePhase::A);
    assert_eq!(h.ka,    BindStatus::Bound);
    assert_eq!(h.kb,    SubmissionStatus::Clean);
    assert_eq!(h.route, RouteTarget::Bridge);
}

#[test]
fn validator_halt_header_parses() {
    let p = K4Parser::new();
    let input = "[STATE] GATE: B | KA: bound | KB: dirty | ROUTE: halt\n\
                 # HALT — VALIDATION INTERCEPT";
    let parsed = p.parse(input).unwrap();
    let h = match &parsed.header {
        ParsedHeader::Validator(v) => v,
        _ => panic!(),
    };
    assert_eq!(h.gate,  GatePhase::B);
    assert_eq!(h.kb,    SubmissionStatus::Dirty);
    assert_eq!(h.route, RouteTarget::Halt);
}

// ─── Bridge (the previously dead-lettered case) ────────────────

#[test]
fn bridge_header_parses_no_longer_dead_lettered() {
    let p = K4Parser::new();
    let input = "[STATE] TURN: 3 | PHASE: 4b | LOCK: approaching | LAST_FACET: 6 | \
                 RHO: 0.72 | THETA: lag | PF: 0.65 | Qf: high\n\
                 The tension I'm reading in what you've laid out…";
    let parsed = p.parse(input).expect("should parse");
    assert_eq!(parsed.header.kind(), HeaderKind::Bridge);
    let h = match &parsed.header {
        ParsedHeader::Bridge(b) => b,
        other => panic!("expected Bridge, got {:?}", other),
    };
    assert_eq!(h.turn, 3);
    assert_eq!(h.phase, BridgePhase::P4b);
    assert_eq!(h.lock,  LockState::Approaching);
    assert_eq!(h.last_facet, Some(6));
    assert_eq!(h.rho, Some(0.72));
    assert_eq!(h.theta, Some(PhaseDirection::Lag));
    assert_eq!(h.pf, Some(0.65));
    assert_eq!(h.qf, Some(QFactor::High));
}

#[test]
fn bridge_header_with_dashes_parses() {
    let p = K4Parser::new();
    let input = "[STATE] TURN: 1 | PHASE: 2 | LOCK: sweeping | LAST_FACET: — | \
                 RHO: — | THETA: — | PF: — | Qf: mod\n\
                 Does this land, or does it slide off?";
    let parsed = p.parse(input).unwrap();
    let h = match &parsed.header {
        ParsedHeader::Bridge(b) => b,
        _ => panic!("expected Bridge"),
    };
    assert_eq!(h.phase, BridgePhase::P2);
    assert_eq!(h.lock,  LockState::Sweeping);
    assert!(h.last_facet.is_none());
    assert!(h.rho.is_none());
    assert!(h.theta.is_none());
    assert!(h.pf.is_none());
    assert_eq!(h.qf, Some(QFactor::Mod));
}

// ─── Controller (regression — still works) ─────────────────────

#[test]
fn controller_header_still_parses_after_refactor() {
    let p = K4Parser::new();
    let input = "[STATE] CYCLE: 1 | SEQ: 0 | STANCE: Synthesis (P = U × I) | PLANE: P-Face | \
                 HELD: R=nil | PATH: P>U>I>R | FACE: P | RAISES: 0/3 | STATUS: run\n\
                 FACE-RUNNER PROMPT";
    let parsed = p.parse(input).unwrap();
    assert_eq!(parsed.header.kind(), HeaderKind::Controller);
    let h = parsed.header.as_controller().unwrap();
    assert_eq!(h.cycle, 1);
    assert_eq!(h.stance.home(), Pole::P);
    assert_eq!(h.plane, Pole::P);
}

// ─── Paradox ───────────────────────────────────────────────────

#[test]
fn paradox_header_parses() {
    let p = K4Parser::new();
    let input = "[STATE] TURN: 2 | MODE: paradox | ANCHOR: full | AT: Leverage (P = U² / R) | \
                 RUNG: 1 | RECOGNIZED: 3\n\
                 Holding your ground the same and asking a different question…";
    let parsed = p.parse(input).expect("should parse");
    assert_eq!(parsed.header.kind(), HeaderKind::Paradox);
    let h = match &parsed.header {
        ParsedHeader::Paradox(p) => p,
        _ => panic!("expected Paradox"),
    };
    assert_eq!(h.turn, 2);
    assert_eq!(h.anchor, AnchorKind::Full);
    assert_eq!(h.rung, 1);
    assert_eq!(h.recognized, 3);
    let at = h.at.as_ref().expect("AT should parse");
    assert_eq!(at.home(),   Pole::P);
    assert_eq!(at.absent(), Pole::I);
}

#[test]
fn paradox_home_only_anchor_parses() {
    let p = K4Parser::new();
    let input = "[STATE] TURN: 5 | MODE: paradox | ANCHOR: home-only | AT: — | RUNG: 0 | RECOGNIZED: 0\n\
                 Standing on P but face still open.";
    let parsed = p.parse(input).unwrap();
    let h = match &parsed.header {
        ParsedHeader::Paradox(p) => p,
        _ => panic!(),
    };
    assert_eq!(h.anchor, AnchorKind::HomeOnly);
    assert!(h.at.is_none());
}

// ─── Cross-vocabulary parsing ──────────────────────────────────

#[test]
fn controller_header_with_bridge_stance_name_still_parses() {
    // A Controller header carrying a stance name from the Bridge's vocabulary
    // (e.g. "Yield" instead of "Resonant") — used to fail with Unknown equation.
    let p = K4Parser::new();
    let input = "[STATE] CYCLE: 1 | SEQ: 0 | STANCE: Yield (I = √(P/R)) | PLANE: I-Face | \
                 HELD: U=nil | PATH: I | FACE: I | RAISES: 0/3 | STATUS: run\n\
                 FACE-RUNNER PROMPT";
    let parsed = p.parse(input).expect("should parse Bridge-vocabulary stance in a Controller header");
    let h = parsed.header.as_controller().unwrap();
    assert_eq!(h.stance.home(),   Pole::I);
    assert_eq!(h.stance.absent(), Pole::U);
}

#[test]
fn controller_header_with_controller_stance_name_parses() {
    let p = K4Parser::new();
    let input = "[STATE] CYCLE: 1 | SEQ: 0 | STANCE: Grounding (U = I × R) | PLANE: P-Face | \
                 HELD: P=nil | PATH: U | FACE: U | RAISES: 0/3 | STATUS: run\n\
                 FACE-RUNNER PROMPT";
    let parsed = p.parse(input).expect("should parse Controller-vocabulary stance");
    let h = parsed.header.as_controller().unwrap();
    assert_eq!(h.stance.home(),   Pole::U);
    assert_eq!(h.stance.absent(), Pole::P);
}
