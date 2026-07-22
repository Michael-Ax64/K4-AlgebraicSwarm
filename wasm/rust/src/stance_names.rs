// Verifies parse_stance_from_name accepts all three specification vocabularies
// and that Stance::spec_name emits the correct role-specific label.

use k4_manifold::algebra::{Pole, Stance, SpecRole, parse_stance_from_name};

/// Every stance name from every spec must parse to the same (home, absent) pair.
#[test]
fn all_paradox_engine_names_parse() {
    let paradox_names = [
        ("Synthesis (P = U × I)",    Pole::P, Pole::R),
        ("Leverage (P = U² / R)",    Pole::P, Pole::I),
        ("Momentum (P = I² × R)",    Pole::P, Pole::U),
        ("Extraction (I = P / U)",   Pole::I, Pole::R),
        ("Ohmic (I = U / R)",        Pole::I, Pole::P),
        ("Resonance (I = √(P/R))",   Pole::I, Pole::U),
        ("Tension (U = P / I)",      Pole::U, Pole::R),
        ("Architecture (U = I × R)", Pole::U, Pole::P),
        ("Capacity (U = √(P×R))",    Pole::U, Pole::I),
        ("Impedance (R = U / I)",    Pole::R, Pole::P),
        ("Accounting (R = U² / P)",  Pole::R, Pole::I),
        ("Brittleness (R = P / I²)", Pole::R, Pole::U),
    ];
    for (name, h, a) in paradox_names {
        let s = parse_stance_from_name(name).unwrap_or_else(|e| panic!("{} → {}", name, e));
        assert_eq!(s.home(),   h, "{}", name);
        assert_eq!(s.absent(), a, "{}", name);
    }
}

#[test]
fn all_bridge_names_parse() {
    // From K4-AlgebraicIntentBridge §The 12 Facets
    let bridge_names = [
        ("Drive (P = U × I)",         Pole::P, Pole::R),
        ("Leverage (P = U² / R)",     Pole::P, Pole::I),
        ("Momentum (P = I² × R)",     Pole::P, Pole::U),
        ("Resonance (I = P / U)",     Pole::I, Pole::R),  // Bridge's "Resonance" is (I, R)
        ("Throughput (I = U / R)",    Pole::I, Pole::P),
        ("Yield (I = √(P/R))",        Pole::I, Pole::U),
        ("Tension (U = P / I)",       Pole::U, Pole::R),
        ("Architecture (U = I × R)",  Pole::U, Pole::P),
        ("Capacity (U = √(P×R))",     Pole::U, Pole::I),
        ("Friction (R = U / I)",      Pole::R, Pole::P),  // Bridge's "Friction" is (R, P)
        ("Bloat (R = U² / P)",        Pole::R, Pole::I),
        ("Brittleness (R = P / I²)",  Pole::R, Pole::U),
    ];
    for (name, h, a) in bridge_names {
        let s = parse_stance_from_name(name).unwrap_or_else(|e| panic!("{} → {}", name, e));
        assert_eq!(s.home(),   h, "{}", name);
        assert_eq!(s.absent(), a, "{}", name);
    }
}

#[test]
fn all_controller_names_parse() {
    // From K4-AlgebraicSwarmController §The 12 Stances
    let controller_names = [
        ("Synthesis (P = U × I)",     Pole::P, Pole::R),
        ("Leverage (P = U² / R)",     Pole::P, Pole::I),
        ("Friction (P = I² × R)",     Pole::P, Pole::U),  // Controller's "Friction" is (P, U)
        ("Extraction (I = P / U)",    Pole::I, Pole::R),
        ("Ohmic (I = U / R)",         Pole::I, Pole::P),
        ("Resonant (I = √(P/R))",     Pole::I, Pole::U),
        ("Articulation (U = P / I)",  Pole::U, Pole::R),
        ("Grounding (U = I × R)",     Pole::U, Pole::P),
        ("Geometric (U = √(P×R))",    Pole::U, Pole::I),
        ("Impedance (R = U / I)",     Pole::R, Pole::P),
        ("Accounting (R = U² / P)",   Pole::R, Pole::I),
        ("Density (R = P / I²)",      Pole::R, Pole::U),
    ];
    for (name, h, a) in controller_names {
        let s = parse_stance_from_name(name).unwrap_or_else(|e| panic!("{} → {}", name, e));
        assert_eq!(s.home(),   h, "{}", name);
        assert_eq!(s.absent(), a, "{}", name);
    }
}

/// spec_name emits the right label per role — round-trip through parse_stance_from_name.
#[test]
fn spec_name_roundtrips_for_all_roles() {
    for h in Pole::all() {
        for a in Pole::all() {
            let s = match Stance::try_new(h, a) { Ok(s) => s, Err(_) => continue };
            for role in [SpecRole::Bridge, SpecRole::Controller, SpecRole::Paradox] {
                let name = s.spec_name(role);
                let back = parse_stance_from_name(name).unwrap_or_else(|e|
                    panic!("role {:?} name '{}' failed: {}", role, name, e));
                assert_eq!(back.home(),   h, "{:?} {}", role, name);
                assert_eq!(back.absent(), a, "{:?} {}", role, name);
            }
        }
    }
}

/// The two collision cases: "Friction" and "Resonance" name different stances in
/// different specs. With the equation attached, disambiguation is unambiguous.
#[test]
fn colliding_labels_disambiguate_by_equation() {
    // "Friction" bare (default = Paradox... which doesn't have a Friction — falls to first table hit)
    // With equations attached:
    let bridge_friction = parse_stance_from_name("Friction (R = U / I)").unwrap();
    assert_eq!((bridge_friction.home(), bridge_friction.absent()), (Pole::R, Pole::P));

    let controller_friction = parse_stance_from_name("Friction (P = I² × R)").unwrap();
    assert_eq!((controller_friction.home(), controller_friction.absent()), (Pole::P, Pole::U));

    let bridge_resonance = parse_stance_from_name("Resonance (I = P / U)").unwrap();
    assert_eq!((bridge_resonance.home(), bridge_resonance.absent()), (Pole::I, Pole::R));

    let paradox_resonance = parse_stance_from_name("Resonance (I = √(P/R))").unwrap();
    assert_eq!((paradox_resonance.home(), paradox_resonance.absent()), (Pole::I, Pole::U));
}

/// facet_id is stable per (home, absent), consistent with the spec tables.
#[test]
fn facet_id_matches_spec_tables() {
    let expected = [
        (Pole::P, Pole::R,  1),
        (Pole::P, Pole::I,  2),
        (Pole::P, Pole::U,  3),
        (Pole::I, Pole::R,  4),
        (Pole::I, Pole::P,  5),
        (Pole::I, Pole::U,  6),
        (Pole::U, Pole::R,  7),
        (Pole::U, Pole::P,  8),
        (Pole::U, Pole::I,  9),
        (Pole::R, Pole::P, 10),
        (Pole::R, Pole::I, 11),
        (Pole::R, Pole::U, 12),
    ];
    for (h, a, id) in expected {
        let s = Stance::try_new(h, a).unwrap();
        assert_eq!(s.facet_id(), id, "({:?}, {:?}) should be facet {}", h, a, id);
    }
}
