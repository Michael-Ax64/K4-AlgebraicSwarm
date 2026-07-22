// Verifies:
//  1. get_braid_context() now returns the real Gray-code-adjacent facet IDs
//     computed via Stance::viable_adjacencies + Stance::facet_id
//  2. The engine's PromptRole detection reads "Now run K4-*" from routing payloads

use k4_manifold::algebra::{Pole, Stance};
use k4_manifold::vfs::{VirtualFileSystem, ThreadAction};
use k4_manifold::state::{
    ControllerHeader, WorkingSurface, HeldRole, RunStatus,
};

// ─── Braid context ─────────────────────────────────────────────

#[test]
fn cold_project_returns_all_twelve_facets() {
    let vfs = VirtualFileSystem::new();
    let (last, legal) = vfs.get_braid_context();
    assert!(last.is_none());
    assert_eq!(legal, (1u8..=12).collect::<Vec<_>>());
}

#[test]
fn warm_project_returns_gray_code_adjacent_facets() {
    // Commit a Leverage PTR (home P, absent I). Its 4 geometric neighbors per the
    // ParadoxEngine worked example are Capacity, Accounting, Momentum, Synthesis.
    // Their facet IDs are 9, 11, 3, 1 respectively.
    let mut vfs = VirtualFileSystem::new();
    let stance = Stance::try_new(Pole::P, Pole::I).unwrap();  // Leverage
    let header = ControllerHeader {
        cycle: 1, seq: 5, stance,
        plane: Pole::I, held_role: HeldRole::Nil,
        path: vec![Pole::P, Pole::U], current_face: None,
        raises: (0, 3), status: RunStatus::Run,
    };
    vfs.write_ptr(&header, &WorkingSurface::new(), ThreadAction::Continue, None);

    let (last, mut legal) = vfs.get_braid_context();
    assert!(last.is_some(), "warm project should return Some(last_stance)");
    let last = last.unwrap();
    assert_eq!(last.home(),   Pole::P);
    assert_eq!(last.absent(), Pole::I);

    legal.sort();
    // Leverage's four neighbors:
    //   shift-metric (same face I, other actives {U, R}): Capacity (9), Accounting (11)
    //   shift-plane  (same home P, other absents {U, R}): Momentum (3), Synthesis (1)
    let mut expected = vec![1u8, 3, 9, 11];
    expected.sort();
    assert_eq!(legal, expected,
        "Leverage's Gray-code neighbors should be Synthesis(1), Momentum(3), Capacity(9), Accounting(11)");
}

#[test]
fn braid_context_accepts_ptr_written_in_any_vocabulary() {
    // A PTR whose stance string uses the Controller vocabulary should still
    // parse back through the reconciled stance-name table.
    let mut vfs = VirtualFileSystem::new();
    let stance = Stance::try_new(Pole::P, Pole::U).unwrap();  // Controller calls this "Friction"
    let header = ControllerHeader {
        cycle: 1, seq: 5, stance,
        plane: Pole::U, held_role: HeldRole::Nil,
        path: vec![Pole::P], current_face: None,
        raises: (0, 3), status: RunStatus::Run,
    };
    vfs.write_ptr(&header, &WorkingSurface::new(), ThreadAction::Continue, None);

    // The stored PTR uses ParadoxEngine naming (that's what equation_name emits),
    // but let's verify the parse survives.
    let (last, legal) = vfs.get_braid_context();
    assert!(last.is_some());
    assert_eq!(legal.len(), 4, "always exactly 4 Gray-code neighbors");
}

// ─── PromptRole routing ────────────────────────────────────────
//
// Not exposed as public API on K4Engine, but the effect is observable through
// step_command: a routing request that names K4-AlgebraicSwarmController should
// produce a Controller-shaped continuation prompt.

use k4_manifold::engine::{K4Engine, JsCommand};

fn full_controller_llm_response_routing_to_controller() -> &'static str {
    "[STATE] CYCLE: 1 | SEQ: 0 | STANCE: Synthesis (P = U × I) | PLANE: P-Face | \
     HELD: R=nil | PATH: P>U>I>R | FACE: — | RAISES: 0/3 | STATUS: run\n\
     # ROUTING REQUEST\nNow run K4-AlgebraicSwarmController with payload:\n\
     [some swarm init payload here]"
}

fn full_validator_llm_response_routing_to_bridge() -> &'static str {
    "[STATE] GATE: pass | KA: bound | KB: clean | ROUTE: bridge\n\
     # ROUTING REQUEST\nNow run K4-AlgebraicIntentBridge with payload:\n\
     the operator's cleaned material"
}

#[test]
fn routing_request_naming_controller_produces_controller_prompt() {
    let mut e = K4Engine::new();
    e.step_command("intent");  // cold start → FetchLLM
    let cmd = e.step_command(full_controller_llm_response_routing_to_controller());
    match cmd {
        JsCommand::FetchLLM { prompt } => {
            assert!(prompt.contains("K4-AlgebraicSwarmController"),
                "expected Controller prompt, got:\n{}", prompt);
            assert!(prompt.contains("swarm init payload"));
        }
        other => panic!("expected FetchLLM, got {:?}", other),
    }
}

#[test]
fn routing_request_naming_bridge_produces_bridge_prompt() {
    let mut e = K4Engine::new();
    e.step_command("intent");
    let cmd = e.step_command(full_validator_llm_response_routing_to_bridge());
    match cmd {
        JsCommand::FetchLLM { prompt } => {
            assert!(prompt.contains("K4-AlgebraicIntentBridge"),
                "expected Bridge prompt, got:\n{}", prompt);
            assert!(prompt.contains("cleaned material"));
        }
        other => panic!("expected FetchLLM, got {:?}", other),
    }
}

/// A Bridge SWARM INITIALIZATION PAYLOAD hands off to the Controller
/// (implicit routing — payload type determines target).
#[test]
fn bridge_swarm_payload_routes_to_controller() {
    let mut e = K4Engine::new();
    e.step_command("intent");
    let bridge_p6 = "[STATE] TURN: 5 | PHASE: 6 | LOCK: LOCKED | LAST_FACET: 2 | \
                     RHO: 0.85 | THETA: zero | PF: 0.7 | Qf: high\n\
                     # SWARM INITIALIZATION PAYLOAD\n\
                     ## 1. LOCKED COORDINATE\n* Target Stance: Leverage (P = U² / R)\n";
    let cmd = e.step_command(bridge_p6);
    match cmd {
        JsCommand::FetchLLM { prompt } => {
            assert!(prompt.contains("K4-AlgebraicSwarmController"),
                "SWARM PAYLOAD should route to Controller, got:\n{}", prompt);
        }
        other => panic!("expected FetchLLM to Controller, got {:?}", other),
    }
}

/// After a Bridge AwaitUser, the operator's reply should be re-wrapped
/// in a Bridge prompt (P3 response read), not a Validator or Controller one.
#[test]
fn await_user_continuation_uses_emitting_role() {
    let mut e = K4Engine::new();
    e.step_command("intent");
    // Bridge emits a P2 Facet Articulation as plain text
    let bridge_p2 = "[STATE] TURN: 2 | PHASE: 2 | LOCK: sweeping | LAST_FACET: 4 | \
                     RHO: — | THETA: — | PF: — | Qf: mod\n\
                     The tension I'm reading is between the throughput you want \
                     and the ground you have.";
    e.step_command(bridge_p2);  // → AwaitUser, last_role = Bridge

    // Operator replies
    let cmd = e.step_command("yes, exactly — the throughput is thin");
    match cmd {
        JsCommand::FetchLLM { prompt } => {
            assert!(prompt.contains("K4-AlgebraicIntentBridge"),
                "Bridge-emitted AwaitUser should continue back to Bridge, got:\n{}", prompt);
            assert!(prompt.contains("throughput is thin"));
        }
        other => panic!("expected FetchLLM to Bridge, got {:?}", other),
    }
}
