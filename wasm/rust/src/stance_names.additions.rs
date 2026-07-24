// wasm/rust/tests/stance_names.rs — APPEND-ONLY
//
// These tests lock in:
//   • The numeric-shorthand parsing path added to parse_stance_from_name
//     ("1", "S1", "Stance 1", "#1", "stance-1")
//   • The harness's own compact geometric notation ("1(P,a:R)", "Stance 1 (P, a:R)")
//   • The Stance::from_facet_id ↔ facet_id round-trip
//
// Append these test functions to the END of the existing tests/stance_names.rs.
// Do NOT replace the existing file. Existing tests still pass unchanged.

// ─── Numeric shorthand & harness geometric notation ────────────

#[test]
fn numeric_shorthand_parses_all_forms() {
    let cases = [
        ("1",              Pole::P, Pole::R),
        ("S1",             Pole::P, Pole::R),
        ("s1",             Pole::P, Pole::R),
        ("#1",             Pole::P, Pole::R),
        ("Stance 1",       Pole::P, Pole::R),
        ("stance-1",       Pole::P, Pole::R),
        ("Stance 12",      Pole::R, Pole::U),
        ("12",             Pole::R, Pole::U),
        ("Stance 6",       Pole::I, Pole::U),
    ];
    for (name, h, a) in cases {
        let s = parse_stance_from_name(name)
            .unwrap_or_else(|e| panic!("'{}' → {}", name, e));
        assert_eq!(s.home(),   h, "{}", name);
        assert_eq!(s.absent(), a, "{}", name);
    }
}

#[test]
fn numeric_shorthand_rejects_out_of_range() {
    assert!(parse_stance_from_name("0").is_err());
    assert!(parse_stance_from_name("13").is_err());
    assert!(parse_stance_from_name("Stance 99").is_err());
}

#[test]
fn harness_verbatim_stance_notation_parses() {
    // The exact strings the Paradox harness defines:
    //   "STANCES: 1(P,a:R) 2(P,a:I) 3(P,a:U) 4(I,a:R) 5(I,a:P) 6(I,a:U)
    //             7(U,a:R) 8(U,a:P) 9(U,a:I) 10(R,a:P) 11(R,a:I) 12(R,a:U)."
    let cases = [
        ("1(P,a:R)",  Pole::P, Pole::R),
        ("5(I,a:P)",  Pole::I, Pole::P),
        ("9(U,a:I)",  Pole::U, Pole::I),
        ("12(R,a:U)", Pole::R, Pole::U),
    ];
    for (name, h, a) in cases {
        let s = parse_stance_from_name(name)
            .unwrap_or_else(|e| panic!("'{}' → {}", name, e));
        assert_eq!(s.home(),   h, "{}", name);
        assert_eq!(s.absent(), a, "{}", name);
    }
}

#[test]
fn llm_paraphrased_stance_notation_parses() {
    // The form the LLM actually emitted in the transcript that shear-halted:
    //   ANCHOR: Stance 1 (P, a:R) | AT: Stance 1 (P, a:R)
    let cases = [
        ("Stance 1 (P, a:R)",  Pole::P, Pole::R),
        ("Stance 4 (I, a:R)",  Pole::I, Pole::R),
        ("Stance 12 (R, a:U)", Pole::R, Pole::U),
    ];
    for (name, h, a) in cases {
        let s = parse_stance_from_name(name)
            .unwrap_or_else(|e| panic!("'{}' → {}", name, e));
        assert_eq!(s.home(),   h, "{}", name);
        assert_eq!(s.absent(), a, "{}", name);
    }
}

#[test]
fn facet_id_and_from_facet_id_roundtrip() {
    for id in 1u8..=12 {
        let s = Stance::from_facet_id(id).unwrap_or_else(|| panic!("id {} → None", id));
        assert_eq!(s.facet_id(), id, "roundtrip for id {}", id);
    }
    assert!(Stance::from_facet_id(0).is_none());
    assert!(Stance::from_facet_id(13).is_none());
}
