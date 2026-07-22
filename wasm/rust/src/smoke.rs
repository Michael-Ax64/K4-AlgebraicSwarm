use k4_manifold::algebra::{Pole, Stance, parse_stance_from_name};
use k4_manifold::parser::K4Parser;
use k4_manifold::state::{WorkingSurface, StateHeader, HeldRole, RunStatus, SlotState};
use k4_manifold::vfs::{VirtualFileSystem, ThreadAction};

#[test]
fn poles_kinematics_and_diagonals() {
    // P and I are diagonal (opposite on both axes)
    assert!(Pole::P.is_diagonal_to(&Pole::I));
    assert!(Pole::U.is_diagonal_to(&Pole::R));
    // P and U share Active charge -> not diagonal
    assert!(!Pole::P.is_diagonal_to(&Pole::U));
    // P and R share Asserting modality -> not diagonal
    assert!(!Pole::P.is_diagonal_to(&Pole::R));
}

#[test]
fn stance_rejects_same_home_and_absent() {
    assert!(Stance::try_new(Pole::P, Pole::P).is_err());
}

#[test]
fn every_stance_has_a_named_equation_and_roundtrips() {
    for h in Pole::all() {
        for a in Pole::all() {
            if let Ok(s) = Stance::try_new(h, a) {
                let name = s.equation_name();
                let back = parse_stance_from_name(name).unwrap();
                assert_eq!(back.home(), h);
                assert_eq!(back.absent(), a);
            }
        }
    }
}

#[test]
fn stance_viable_adjacencies_are_all_valid() {
    let s = Stance::try_new(Pole::P, Pole::R).unwrap();
    let adj = s.viable_adjacencies();
    assert_eq!(adj.len(), 4);
    // All 4 must be well-formed stances distinct from original
    for a in adj {
        assert_ne!(a.home(), a.absent());
    }
}

#[test]
fn parser_rejects_missing_state_header() {
    let p = K4Parser::new();
    let err = p.parse("random text with no state header").unwrap_err();
    let msg = format!("{:?}", err);
    assert!(msg.contains("Missing [STATE]"), "got {}", msg);
}

#[test]
fn parser_accepts_minimal_face_runner_output() {
    use k4_manifold::parser::ParsedHeader;
    let p = K4Parser::new();
    let input = "[STATE] CYCLE: 1 | SEQ: 0 | STANCE: Synthesis (P = U × I) | PLANE: P-Face | HELD: R=nil | PATH: P>U>I>R | FACE: P | RAISES: 0/3 | STATUS: run\n[COMPUTATION]\nreads surface\n[/COMPUTATION]\nFACE-RUNNER PROMPT payload\n";
    let parsed = p.parse(input).expect("should parse");
    let h = match &parsed.header {
        ParsedHeader::Controller(c) => c,
        other => panic!("expected Controller header, got {:?}", other),
    };
    assert_eq!(h.cycle, 1);
    assert_eq!(h.stance.home(), Pole::P);
    assert_eq!(h.stance.absent(), Pole::R);
    assert_eq!(h.plane, Pole::P);
    assert_eq!(h.path, vec![Pole::P, Pole::U, Pole::I, Pole::R]);
    assert_eq!(h.raises, (0, 3));
    assert!(matches!(h.status, RunStatus::Run));
    assert_eq!(h.held_role, HeldRole::Nil);
}

#[test]
fn parser_detects_raise_artifact() {
    let p = K4Parser::new();
    let input = "[STATE] CYCLE: 2 | SEQ: 5 | STANCE: Ohmic (I = U / R) | PLANE: I-Face | HELD: P=nil | PATH: U>I | FACE: I | RAISES: 1/3 | STATUS: run\n[RAISE] target: U | reason: upstream stale voltage";
    let parsed = p.parse(input).unwrap();
    use k4_manifold::parser::TerminalArtifact;
    match parsed.artifact {
        TerminalArtifact::Raise { target, reason } => {
            assert_eq!(target, Pole::U);
            assert!(reason.contains("upstream stale"));
        }
        other => panic!("expected Raise, got {:?}", other),
    }
}

#[test]
fn working_surface_write_marks_current_and_bumps_seq() {
    let mut surface = WorkingSurface::new();
    let mut header = StateHeader {
        cycle: 1,
        seq: 0,
        stance: Stance::try_new(Pole::P, Pole::R).unwrap(),
        plane: Pole::P,
        held_role: HeldRole::Nil,
        path: vec![Pole::U, Pole::I, Pole::P],
        current_face: Some(Pole::U),
        raises: (0, 3),
        status: RunStatus::Run,
    };
    let s = header.stance;
    surface.write(&mut header, Pole::U, "u_content".into(), s);
    assert_eq!(header.seq, 1);
    let slot = &surface.slots[&Pole::U];
    assert_eq!(slot.state, SlotState::Current);
    assert_eq!(slot.content.as_deref(), Some("u_content"));
}

#[test]
fn working_surface_marks_earlier_writer_stale_when_later_writer_supersedes() {
    // Path is U -> I -> P. Write U first (seq 1), then I (seq 2), then U again (seq 3).
    // Now I should be stale relative to U (since U's seq > I's seq and U is earlier in path).
    let mut surface = WorkingSurface::new();
    let stance = Stance::try_new(Pole::P, Pole::R).unwrap();
    let mut header = StateHeader {
        cycle: 1, seq: 0, stance, plane: Pole::P, held_role: HeldRole::Nil,
        path: vec![Pole::U, Pole::I, Pole::P],
        current_face: Some(Pole::U), raises: (0, 3), status: RunStatus::Run,
    };
    surface.write(&mut header, Pole::U, "u1".into(), stance);
    surface.write(&mut header, Pole::I, "i1".into(), stance);
    surface.write(&mut header, Pole::U, "u2".into(), stance); // supersedes
    // After u2 is written (seq=3), I (seq=2) has an earlier writer with a NEWER stamp -> I should be stale.
    let i_state = surface.slots[&Pole::I].state;
    assert_eq!(i_state, SlotState::Stale, "I should go stale when its upstream is overwritten");
}

#[test]
fn vfs_write_ptr_creates_thread_and_records_health() {
    let mut vfs = VirtualFileSystem::new();
    let surface = WorkingSurface::new();
    let stance = Stance::try_new(Pole::P, Pole::R).unwrap();
    let header = StateHeader {
        cycle: 7, seq: 42, stance, plane: Pole::P, held_role: HeldRole::Nil,
        path: vec![Pole::P, Pole::U, Pole::I, Pole::R],
        current_face: None, raises: (0, 3), status: RunStatus::Run,
    };
    vfs.write_ptr(&header, &surface, ThreadAction::Continue, None);
    let tid = vfs.braid.active_thread_id.clone().unwrap();
    let thread = &vfs.braid.threads[&tid];
    assert_eq!(thread.history.len(), 1);
    let ptr = thread.history.last().unwrap();
    assert_eq!(ptr.cycle, 7);
    assert_eq!(ptr.final_seq, 42);
    assert_eq!(ptr.home_variable, Pole::P);
    assert_eq!(ptr.held_pole, Pole::R);
    assert_eq!(ptr.health, "clear");
}

#[test]
fn vfs_roundtrips_through_json() {
    let mut vfs = VirtualFileSystem::new();
    let surface = WorkingSurface::new();
    let stance = Stance::try_new(Pole::I, Pole::U).unwrap();
    let header = StateHeader {
        cycle: 3, seq: 9, stance, plane: Pole::I, held_role: HeldRole::Material,
        path: vec![Pole::P, Pole::I], current_face: None,
        raises: (1, 3), status: RunStatus::Run,
    };
    vfs.write_ptr(&header, &surface, ThreadAction::Continue, None);
    let json = vfs.serialize_for_js();
    assert!(json.contains("Resonance"), "serialized JSON should mention the stance name");
    let round = VirtualFileSystem::deserialize_from_js(&json);
    let tid = round.braid.active_thread_id.clone().unwrap();
    assert_eq!(round.braid.threads[&tid].history[0].cycle, 3);
    assert_eq!(round.braid.threads[&tid].history[0].health, "raises: 1");
}
