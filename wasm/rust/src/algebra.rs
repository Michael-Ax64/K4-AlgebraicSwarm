// wasm/rust/src/algebra.rs

use std::fmt;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Charge { Active, Reactive }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Modality { Asserting, Yielding }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Pole {
    P, // Fire  (Active + Asserting)
    U, // Air   (Active + Yielding)
    I, // Water (Reactive + Yielding)
    R, // Earth (Reactive + Asserting)
}

impl fmt::Display for Pole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Pole::P => write!(f, "P"),
            Pole::U => write!(f, "U"),
            Pole::I => write!(f, "I"),
            Pole::R => write!(f, "R"),
        }
    }
}

impl Pole {
    pub fn kinematics(&self) -> (Charge, Modality) {
        match self {
            Pole::P => (Charge::Active, Modality::Asserting),
            Pole::U => (Charge::Active, Modality::Yielding),
            Pole::I => (Charge::Reactive, Modality::Yielding),
            Pole::R => (Charge::Reactive, Modality::Asserting),
        }
    }

    pub fn is_diagonal_to(&self, other: &Pole) -> bool {
        let (c1, m1) = self.kinematics();
        let (c2, m2) = other.kinematics();
        c1 != c2 && m1 != m2
    }

    pub fn all() -> [Pole; 4] {
        [Pole::P, Pole::U, Pole::I, Pole::R]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Stance {
    home: Pole,
    absent: Pole,
}

impl Stance {
    pub fn try_new(home: Pole, absent: Pole) -> Result<Self, &'static str> {
        if home == absent {
            return Err("Category Error: Cannot measure with the dropped coordinate.");
        }
        Ok(Self { home, absent })
    }

    pub fn home(&self) -> Pole { self.home }
    pub fn absent(&self) -> Pole { self.absent }

    pub fn active_pair(&self) -> [Pole; 2] {
        let mut pair = Vec::with_capacity(2);
        for p in Pole::all() {
            if p != self.home && p != self.absent {
                pair.push(p);
            }
        }
        [pair[0], pair[1]]
    }

    pub fn viable_adjacencies(&self) -> [Stance; 4] {
        let active = self.active_pair();
        let sm1 = Stance::try_new(active[0], self.absent).unwrap();
        let sm2 = Stance::try_new(active[1], self.absent).unwrap();
        let sp1 = Stance::try_new(self.home, active[0]).unwrap();
        let sp2 = Stance::try_new(self.home, active[1]).unwrap();
        [sm1, sm2, sp1, sp2]
    }

    /// Default display name — Paradox vocabulary.
    /// Use `spec_name(role)` when you need a role-specific label.
    pub fn equation_name(&self) -> &'static str {
        self.spec_name(SpecRole::Paradox)
    }

    /// Canonical facet numbering. Matches the FACETS/STANCES enumeration in the
    /// four prompt harnesses. Ordering runs face-by-face (P, I, U, R), and
    /// within a face by equation kind: squared-numerator over ground first,
    /// then squared-numerator-over-product, then simple product/ratio.
    ///
    ///   1: Leverage      (P = U² / R)   home P, absent I
    ///   2: Momentum      (P = I² × R)   home P, absent U
    ///   3: Synthesis     (P = U × I)    home P, absent R      — Bridge calls this "Drive"
    ///   4: Resonance     (I = √(P/R))   home I, absent U      — Bridge "Yield", Controller "Resonant"
    ///   5: Extraction    (I = P / U)    home I, absent R      — Bridge calls this "Resonance"
    ///   6: Ohmic         (I = U / R)    home I, absent P      — Bridge calls this "Throughput"
    ///   7: Tension       (U = P / I)    home U, absent R      — Controller calls this "Articulation"
    ///   8: Architecture  (U = I × R)    home U, absent P      — Controller calls this "Grounding"
    ///   9: Capacity      (U = √(P×R))   home U, absent I      — Controller calls this "Geometric"
    ///  10: Impedance     (R = U / I)    home R, absent P      — Bridge calls this "Friction"
    ///  11: Accounting    (R = U² / P)   home R, absent I      — Bridge calls this "Bloat"
    ///  12: Brittleness   (R = P / I²)   home R, absent U      — Controller calls this "Density"
    pub fn facet_id(&self) -> u8 {
        match (self.home, self.absent) {
            (Pole::P, Pole::I) =>  1,
            (Pole::P, Pole::U) =>  2,
            (Pole::P, Pole::R) =>  3,
            (Pole::I, Pole::U) =>  4,
            (Pole::I, Pole::R) =>  5,
            (Pole::I, Pole::P) =>  6,
            (Pole::U, Pole::R) =>  7,
            (Pole::U, Pole::P) =>  8,
            (Pole::U, Pole::I) =>  9,
            (Pole::R, Pole::P) => 10,
            (Pole::R, Pole::I) => 11,
            (Pole::R, Pole::U) => 12,
            _ => unreachable!("Invalid stance geometry"),
        }
    }

    /// Inverse of `facet_id`. Accepts 1..=12, returns None otherwise.
    /// Single source of truth for numeric ↔ (home, absent) mapping.
    pub fn from_facet_id(id: u8) -> Option<Stance> {
        let (h, a) = match id {
             1 => (Pole::P, Pole::I),
             2 => (Pole::P, Pole::U),
             3 => (Pole::P, Pole::R),
             4 => (Pole::I, Pole::U),
             5 => (Pole::I, Pole::R),
             6 => (Pole::I, Pole::P),
             7 => (Pole::U, Pole::R),
             8 => (Pole::U, Pole::P),
             9 => (Pole::U, Pole::I),
            10 => (Pole::R, Pole::P),
            11 => (Pole::R, Pole::I),
            12 => (Pole::R, Pole::U),
             _ => return None,
        };
        Stance::try_new(h, a).ok()
    }

    /// Role-specific display name. Same (home, absent) pair, different vocabulary
    /// per instrument. Match-arm order follows canonical facet_id numbering for
    /// human readability; Rust doesn't require it for correctness.
    pub fn spec_name(&self, role: SpecRole) -> &'static str {
        let (h, a) = (self.home, self.absent);
        match role {
            SpecRole::Validator | SpecRole::Paradox => match (h, a) {
                (Pole::P, Pole::I) => "Leverage (P = U² / R)",
                (Pole::P, Pole::U) => "Momentum (P = I² × R)",
                (Pole::P, Pole::R) => "Synthesis (P = U × I)",
                (Pole::I, Pole::U) => "Resonance (I = √(P/R))",
                (Pole::I, Pole::R) => "Extraction (I = P / U)",
                (Pole::I, Pole::P) => "Ohmic (I = U / R)",
                (Pole::U, Pole::R) => "Tension (U = P / I)",
                (Pole::U, Pole::P) => "Architecture (U = I × R)",
                (Pole::U, Pole::I) => "Capacity (U = √(P×R))",
                (Pole::R, Pole::P) => "Impedance (R = U / I)",
                (Pole::R, Pole::I) => "Accounting (R = U² / P)",
                (Pole::R, Pole::U) => "Brittleness (R = P / I²)",
                _ => unreachable!("Invalid stance geometry"),
            },
            SpecRole::Bridge => match (h, a) {
                (Pole::P, Pole::I) => "Leverage (P = U² / R)",
                (Pole::P, Pole::U) => "Momentum (P = I² × R)",
                (Pole::P, Pole::R) => "Drive (P = U × I)",
                (Pole::I, Pole::U) => "Yield (I = √(P/R))",
                (Pole::I, Pole::R) => "Resonance (I = P / U)",
                (Pole::I, Pole::P) => "Throughput (I = U / R)",
                (Pole::U, Pole::R) => "Tension (U = P / I)",
                (Pole::U, Pole::P) => "Architecture (U = I × R)",
                (Pole::U, Pole::I) => "Capacity (U = √(P×R))",
                (Pole::R, Pole::P) => "Friction (R = U / I)",
                (Pole::R, Pole::I) => "Bloat (R = U² / P)",
                (Pole::R, Pole::U) => "Brittleness (R = P / I²)",
                _ => unreachable!("Invalid stance geometry"),
            },
            SpecRole::Controller => match (h, a) {
                (Pole::P, Pole::I) => "Leverage (P = U² / R)",
                (Pole::P, Pole::U) => "Friction (P = I² × R)",
                (Pole::P, Pole::R) => "Synthesis (P = U × I)",
                (Pole::I, Pole::U) => "Resonant (I = √(P/R))",
                (Pole::I, Pole::R) => "Extraction (I = P / U)",
                (Pole::I, Pole::P) => "Ohmic (I = U / R)",
                (Pole::U, Pole::R) => "Articulation (U = P / I)",
                (Pole::U, Pole::P) => "Grounding (U = I × R)",
                (Pole::U, Pole::I) => "Geometric (U = √(P×R))",
                (Pole::R, Pole::P) => "Impedance (R = U / I)",
                (Pole::R, Pole::I) => "Accounting (R = U² / P)",
                (Pole::R, Pole::U) => "Density (R = P / I²)",
                _ => unreachable!("Invalid stance geometry"),
            },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SpecRole {
    Validator,
    Bridge,
    Controller,
    Paradox,
}

impl SpecRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            SpecRole::Validator  => "Validator",
            SpecRole::Bridge     => "Bridge",
            SpecRole::Controller => "Controller",
            SpecRole::Paradox    => "Paradox",
        }
    }
}

/// Polyglot stance parser. Accepts:
///   • Numeric shorthand: "1", "S1", "s1", "#1", "Stance 1", "stance-1".
///   • Full label + equation: "Leverage (P = U² / R)". The equation suffix
///     disambiguates the label collisions between vocabularies
///     (Bridge's "Friction" (R,P) vs Controller's "Friction" (P,U); Bridge's
///     "Resonance" (I,R) vs Paradox's "Resonance" (I,U)).
///   • Bare label: "Leverage". Falls back to first-hit resolution.
///   • Geometric notation: "Stance 1 (P, a:R)" or "1(P,a:R)".
pub fn parse_stance_from_name(eq_name: &str) -> Result<Stance, &'static str> {
    let eq = eq_name.trim();

    // (0) Numeric shorthand.
    {
        let mut head = eq;
        for prefix in ["Stance", "stance", "STANCE"] {
            if let Some(rest) = head.strip_prefix(prefix) { head = rest; break; }
        }
        head = head.trim_start_matches(|c: char| c == 'S' || c == 's' || c == '#');
        head = head.trim_start_matches(|c: char| c == '-' || c == '_' || c.is_whitespace());

        let first_token: &str = head
            .split(|c: char| c == '(' || c.is_whitespace())
            .next()
            .unwrap_or("");
        if !first_token.is_empty() {
            if let Ok(id) = first_token.parse::<u8>() {
                if let Some(stance) = Stance::from_facet_id(id) {
                    return Ok(stance);
                }
            }
        }
    }

    // (1) Alias table. Full-string match first (disambiguates collisions),
    //     then bare-label fallback.
    // Format: (bare label, full label + equation, home, absent).
    const ALIASES: &[(&str, &str, Pole, Pole)] = &[

        // (P, I) — Leverage across all three vocabularies. Facet 1.
        ("Leverage",    "Leverage (P = U² / R)",     Pole::P, Pole::I),

        // (P, U) — Momentum (Paradox/Bridge) | Friction (Controller). Facet 2.
        ("Momentum",    "Momentum (P = I² × R)",     Pole::P, Pole::U),
        ("Friction",    "Friction (P = I² × R)",     Pole::P, Pole::U),  // Controller's Friction

        // (P, R) — Synthesis (Paradox/Controller) | Drive (Bridge). Facet 3.
        ("Synthesis",   "Synthesis (P = U × I)",     Pole::P, Pole::R),
        ("Drive",       "Drive (P = U × I)",         Pole::P, Pole::R),

        // (I, U) — Resonance (Paradox) | Yield (Bridge) | Resonant (Controller). Facet 4.
        ("Resonance",   "Resonance (I = √(P/R))",    Pole::I, Pole::U),  // Paradox's Resonance
        ("Yield",       "Yield (I = √(P/R))",        Pole::I, Pole::U),
        ("Resonant",    "Resonant (I = √(P/R))",     Pole::I, Pole::U),

        // (I, R) — Extraction (Paradox/Controller) | Resonance (Bridge). Facet 5.
        ("Extraction",  "Extraction (I = P / U)",    Pole::I, Pole::R),
        ("Resonance",   "Resonance (I = P / U)",     Pole::I, Pole::R),  // Bridge's Resonance

        // (I, P) — Ohmic (Paradox/Controller) | Throughput (Bridge). Facet 6.
        ("Ohmic",       "Ohmic (I = U / R)",         Pole::I, Pole::P),
        ("Throughput",  "Throughput (I = U / R)",    Pole::I, Pole::P),

        // (U, R) — Tension (Paradox/Bridge) | Articulation (Controller). Facet 7.
        ("Tension",     "Tension (U = P / I)",       Pole::U, Pole::R),
        ("Articulation","Articulation (U = P / I)",  Pole::U, Pole::R),

        // (U, P) — Architecture (Paradox/Bridge) | Grounding (Controller). Facet 8.
        ("Architecture","Architecture (U = I × R)",  Pole::U, Pole::P),
        ("Grounding",   "Grounding (U = I × R)",     Pole::U, Pole::P),

        // (U, I) — Capacity (Paradox/Bridge) | Geometric (Controller). Facet 9.
        ("Capacity",    "Capacity (U = √(P×R))",     Pole::U, Pole::I),
        ("Geometric",   "Geometric (U = √(P×R))",    Pole::U, Pole::I),

        // (R, P) — Impedance (Paradox/Controller) | Friction (Bridge). Facet 10.
        ("Impedance",   "Impedance (R = U / I)",     Pole::R, Pole::P),
        ("Friction",    "Friction (R = U / I)",      Pole::R, Pole::P),  // Bridge's Friction

        // (R, I) — Accounting (Paradox/Controller) | Bloat (Bridge). Facet 11.
        ("Accounting",  "Accounting (R = U² / P)",   Pole::R, Pole::I),
        ("Bloat",       "Bloat (R = U² / P)",        Pole::R, Pole::I),

        // (R, U) — Brittleness (Paradox/Bridge) | Density (Controller). Facet 12.
        ("Brittleness", "Brittleness (R = P / I²)",  Pole::R, Pole::U),
        ("Density",     "Density (R = P / I²)",      Pole::R, Pole::U),
    ];

    for (_, full, home, absent) in ALIASES {
        if eq == *full { return Stance::try_new(*home, *absent); }
    }
    for (label, _, home, absent) in ALIASES {
        if eq == *label { return Stance::try_new(*home, *absent); }
    }

    // (2) Geometric fallback: "Stance N (P, a:R)" / "N(I,a:P)".
    if let Some(start) = eq.find('(') {
        let inner = &eq[start + 1..];
        if let Some(end) = inner.find(')') {
            let coords = &inner[..end];
            let parts: Vec<&str> = coords.split(',').collect();
            if parts.len() == 2 {
                let h_str = parts[0].trim();
                let a_part = parts[1].trim();
                let a_str = a_part.strip_prefix("a:").unwrap_or(a_part).trim();

                let parse_pole = |s: &str| -> Option<Pole> {
                    match s {
                        "P" => Some(Pole::P),
                        "U" => Some(Pole::U),
                        "I" => Some(Pole::I),
                        "R" => Some(Pole::R),
                        _ => None,
                    }
                };

                if let (Some(h), Some(a)) = (parse_pole(h_str), parse_pole(a_str)) {
                    if let Ok(stance) = Stance::try_new(h, a) {
                        return Ok(stance);
                    }
                }
            }
        }
    }

    Err("Unknown equation")
}
