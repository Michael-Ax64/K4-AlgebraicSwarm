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

    /// Canonical stance name (ParadoxEngine vocabulary — matches Rust's history).
    /// See `spec_name(role)` for role-specific naming.
    pub fn equation_name(&self) -> &'static str {
        self.spec_name(SpecRole::Paradox)
    }

    /// The 1..=12 facet identifier — consistent across all three spec tables.
    pub fn facet_id(&self) -> u8 {
        match (self.home, self.absent) {
            (Pole::P, Pole::R) => 1,
            (Pole::P, Pole::I) => 2,
            (Pole::P, Pole::U) => 3,
            (Pole::I, Pole::R) => 4,
            (Pole::I, Pole::P) => 5,
            (Pole::I, Pole::U) => 6,
            (Pole::U, Pole::R) => 7,
            (Pole::U, Pole::P) => 8,
            (Pole::U, Pole::I) => 9,
            (Pole::R, Pole::P) => 10,
            (Pole::R, Pole::I) => 11,
            (Pole::R, Pole::U) => 12,
            _ => unreachable!("Invalid stance geometry"),
        }
    }

    /// Name of this stance in the vocabulary of the specified role.
    /// The three specs disagree on 4-5 of the 12 stance labels; this method
    /// lets a role-specific prompt emit the vocabulary that role's LLM was
    /// primed on.
    pub fn spec_name(&self, role: SpecRole) -> &'static str {
        let (h, a) = (self.home, self.absent);
        match role {
            // The Validator doesn't emit stance names in its own vocabulary — it
            // relays them. Use Paradox as the canonical relay form.
            SpecRole::Validator | SpecRole::Paradox => match (h, a) {
                (Pole::P, Pole::R) => "Synthesis (P = U × I)",
                (Pole::P, Pole::I) => "Leverage (P = U² / R)",
                (Pole::P, Pole::U) => "Momentum (P = I² × R)",
                (Pole::I, Pole::R) => "Extraction (I = P / U)",
                (Pole::I, Pole::P) => "Ohmic (I = U / R)",
                (Pole::I, Pole::U) => "Resonance (I = √(P/R))",
                (Pole::U, Pole::R) => "Tension (U = P / I)",
                (Pole::U, Pole::P) => "Architecture (U = I × R)",
                (Pole::U, Pole::I) => "Capacity (U = √(P×R))",
                (Pole::R, Pole::P) => "Impedance (R = U / I)",
                (Pole::R, Pole::I) => "Accounting (R = U² / P)",
                (Pole::R, Pole::U) => "Brittleness (R = P / I²)",
                _ => unreachable!("Invalid stance geometry"),
            },
            SpecRole::Bridge => match (h, a) {
                (Pole::P, Pole::R) => "Drive (P = U × I)",
                (Pole::P, Pole::I) => "Leverage (P = U² / R)",
                (Pole::P, Pole::U) => "Momentum (P = I² × R)",
                (Pole::I, Pole::R) => "Resonance (I = P / U)",
                (Pole::I, Pole::P) => "Throughput (I = U / R)",
                (Pole::I, Pole::U) => "Yield (I = √(P/R))",
                (Pole::U, Pole::R) => "Tension (U = P / I)",
                (Pole::U, Pole::P) => "Architecture (U = I × R)",
                (Pole::U, Pole::I) => "Capacity (U = √(P×R))",
                (Pole::R, Pole::P) => "Friction (R = U / I)",
                (Pole::R, Pole::I) => "Bloat (R = U² / P)",
                (Pole::R, Pole::U) => "Brittleness (R = P / I²)",
                _ => unreachable!("Invalid stance geometry"),
            },
            SpecRole::Controller => match (h, a) {
                (Pole::P, Pole::R) => "Synthesis (P = U × I)",
                (Pole::P, Pole::I) => "Leverage (P = U² / R)",
                (Pole::P, Pole::U) => "Friction (P = I² × R)",
                (Pole::I, Pole::R) => "Extraction (I = P / U)",
                (Pole::I, Pole::P) => "Ohmic (I = U / R)",
                (Pole::I, Pole::U) => "Resonant (I = √(P/R))",
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

/// The four prompt roles in the K4 stack. Each stands at a different station
/// in the process and names the same twelve geometric positions in its own
/// vocabulary.
///
/// **The three name tables are not disagreement.** A stance is defined by its
/// `(home, absent)` pair — that is the invariant, established by the algebra.
/// What each role calls the stance at that position varies with what the role
/// *does* while standing there:
///
/// * The **Bridge** names positions by the phase-form of tension they identify —
///   `Drive`, `Yield`, `Friction (R = U / I)` — because the Bridge is
///   diagnosing tension.
/// * The **Controller** names positions by the mechanical process it drives —
///   `Friction (P = I² × R)`, `Grounding`, `Density` — because the Controller
///   is executing a coordinate.
/// * The **ParadoxEngine** names positions by the paradox they hold open —
///   `Synthesis`, `Resonance (I = √(P/R))`, `Brittleness` — because the
///   Engine is enumerating adjacencies.
/// * The **Validator** does not name stances in its own vocabulary; it relays
///   whatever the Bridge or Controller emits.
///
/// Same twelve points on the volume, three role-flavored views of what you're
/// *doing* when you stand there. `spec_name(role)` gives the label for the
/// requested view; `parse_stance_from_name` reads any of them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SpecRole {
    Validator,   // shares Paradox vocabulary in practice — Validator doesn't emit stance names
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

/// Accept a stance name in **any of the three specification vocabularies**.
/// Same input-process-output pattern as the header parser:
///
/// 1. **Input**: a stance name in whatever vocabulary — Bridge (`Yield`),
///    Controller (`Resonant`), or ParadoxEngine (`Resonance`) style.
/// 2. **Process**: match the (label, equation-suffix) alias against the
///    invariant `(home, absent)` pair. The equation suffix resolves the two
///    label collisions unambiguously.
/// 3. **Output**: a `Stance` — same twelve positions the algebra defines,
///    regardless of which role's vocabulary named it.
///
/// The runtime hosts all four roles, so the parser has to hear all three
/// vocabularies. Which vocabulary the *runtime* emits when it names a stance
/// back to an LLM is chosen by `Stance::spec_name(role)`.
///
/// Match on the whole string OR on the leading label alone — so
/// `parse_stance_from_name("Yield")`, `parse_stance_from_name("Yield (I = √(P/R))")`,
/// and `parse_stance_from_name("Resonance (I = √(P/R))")` all resolve to the
/// same `(I, U)` position. Two labels collide across specs:
///
/// * **`Friction`** — Bridge means (R, P), Controller means (P, U). With the
///   equation suffix attached, disambiguation is unambiguous.
/// * **`Resonance`** — Bridge means (I, R), ParadoxEngine means (I, U). Same
///   disambiguation.
///
/// Bare labels resolve to the first table hit — currently the ParadoxEngine
/// reading. If a run only emits full labels-with-equation this never matters.
pub fn parse_stance_from_name(eq_name: &str) -> Result<Stance, &'static str> {
    let eq = eq_name.trim();

    // (label-only, full-with-equation, home, absent)
    // Every alias for the same (home, absent) is listed together.
    const ALIASES: &[(&str, &str, Pole, Pole)] = &[
        // (P, R)  — Synthesis (Paradox/Controller) | Drive (Bridge)
        ("Synthesis", "Synthesis (P = U × I)", Pole::P, Pole::R),
        ("Drive",     "Drive (P = U × I)",     Pole::P, Pole::R),
        // (P, I)  — Leverage (all three)
        ("Leverage",  "Leverage (P = U² / R)", Pole::P, Pole::I),
        // (P, U)  — Momentum (Paradox/Bridge) | Friction (Controller)
        ("Momentum",  "Momentum (P = I² × R)", Pole::P, Pole::U),
        ("Friction",  "Friction (P = I² × R)", Pole::P, Pole::U),  // Controller's Friction
        // (I, R)  — Extraction (Paradox/Controller) | Resonance (Bridge)
        ("Extraction","Extraction (I = P / U)",Pole::I, Pole::R),
        ("Resonance", "Resonance (I = P / U)", Pole::I, Pole::R),  // Bridge's Resonance
        // (I, P)  — Ohmic (Paradox/Controller) | Throughput (Bridge)
        ("Ohmic",     "Ohmic (I = U / R)",     Pole::I, Pole::P),
        ("Throughput","Throughput (I = U / R)",Pole::I, Pole::P),
        // (I, U)  — Resonance (Paradox) | Yield (Bridge) | Resonant (Controller)
        ("Resonance", "Resonance (I = √(P/R))",Pole::I, Pole::U),  // Paradox's Resonance
        ("Yield",     "Yield (I = √(P/R))",    Pole::I, Pole::U),
        ("Resonant",  "Resonant (I = √(P/R))", Pole::I, Pole::U),
        // (U, R)  — Tension (Paradox/Bridge) | Articulation (Controller)
        ("Tension",   "Tension (U = P / I)",   Pole::U, Pole::R),
        ("Articulation","Articulation (U = P / I)", Pole::U, Pole::R),
        // (U, P)  — Architecture (Paradox/Bridge) | Grounding (Controller)
        ("Architecture","Architecture (U = I × R)", Pole::U, Pole::P),
        ("Grounding", "Grounding (U = I × R)", Pole::U, Pole::P),
        // (U, I)  — Capacity (Paradox/Bridge) | Geometric (Controller)
        ("Capacity",  "Capacity (U = √(P×R))", Pole::U, Pole::I),
        ("Geometric", "Geometric (U = √(P×R))",Pole::U, Pole::I),
        // (R, P)  — Impedance (Paradox/Controller) | Friction (Bridge)
        ("Impedance", "Impedance (R = U / I)", Pole::R, Pole::P),
        ("Friction",  "Friction (R = U / I)",  Pole::R, Pole::P),  // Bridge's Friction — clashes!
        // (R, I)  — Accounting (Paradox/Controller) | Bloat (Bridge)
        ("Accounting","Accounting (R = U² / P)",Pole::R, Pole::I),
        ("Bloat",     "Bloat (R = U² / P)",    Pole::R, Pole::I),
        // (R, U)  — Brittleness (Paradox/Bridge) | Density (Controller)
        ("Brittleness","Brittleness (R = P / I²)", Pole::R, Pole::U),
        ("Density",   "Density (R = P / I²)",  Pole::R, Pole::U),
    ];

    // Full-string match first (safer — the equation-part disambiguates the
    // "Friction" and "Resonance" collisions).
    for (_, full, home, absent) in ALIASES {
        if eq == *full {
            return Stance::try_new(*home, *absent);
        }
    }
    // Fall back to label-only match. The two collisions ("Friction" and
    // "Resonance") are disambiguated in practice by carrying the equation,
    // but a bare label still needs a defined resolution. We resolve to the
    // first table hit — which is the Paradox meaning for both.
    for (label, _, home, absent) in ALIASES {
        if eq == *label {
            return Stance::try_new(*home, *absent);
        }
    }
    Err("Unknown equation")
}
