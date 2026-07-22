// wasm/rust/src/state.rs
use std::collections::HashMap;
use crate::algebra::{Pole, Stance};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeldRole {
    Nil,
    Material,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RunStatus {
    Run,
    RaisedBy(Pole),
    Halted(String),
}

// ─── Controller header (was StateHeader) ───────────────────────

/// The Controller's `[STATE]` carrier — see K4-AlgebraicSwarmController §STATE CARRIER.
/// Format: `[STATE] CYCLE: n | SEQ: s | STANCE: eq | PLANE: X-Face | HELD: X=<nil|MATERIAL> | PATH: chain | FACE: X | RAISES: k/N | STATUS: run|raised-by-X`
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ControllerHeader {
    pub cycle: u32,
    pub seq: u64,
    pub stance: Stance,
    pub plane: Pole,
    pub held_role: HeldRole,
    pub path: Vec<Pole>,
    pub current_face: Option<Pole>,
    pub raises: (u32, u32),
    pub status: RunStatus,
}

// Backwards-compat type alias so existing code that says `StateHeader` still works.
// New code should prefer ControllerHeader.
pub type StateHeader = ControllerHeader;

// ─── Bridge header ────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BridgePhase {
    P0, P1, P2, P3, P4, P4b, P5, P5b, P6,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LockState {
    Sweeping,
    Approaching,
    Locked,
    Broken,
}

/// The Bridge's `[STATE]` carrier — see K4-AlgebraicIntentBridge §STATE CARRIER.
/// Format: `[STATE] TURN: n | PHASE: 0..6 | LOCK: sweeping|approaching|LOCKED|broken | LAST_FACET: n|— | RHO: ±0.00 | THETA: lead|lag|zero | PF: 0.00-1.00 | Qf: high|mod|low`
#[derive(Debug, Clone, PartialEq)]
pub struct BridgeHeader {
    pub turn: u32,
    pub phase: BridgePhase,
    pub lock: LockState,
    pub last_facet: Option<u8>,        // 1..=12, None when — (dash)
    pub rho: Option<f32>,              // coherence score in [-1, +1]
    pub theta: Option<PhaseDirection>, // lead, lag, zero
    pub pf: Option<f32>,               // power factor in [0.0, 1.0]
    pub qf: Option<QFactor>,           // high, mod, low
}

// ─── Validator header ──────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GatePhase { A, B, Pass }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BindStatus { Bound, Drifting, Unset }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubmissionStatus { Clean, Dirty, Unset }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RouteTarget { Bridge, Controller, Paradox, Halt }

/// The Validator's `[STATE]` carrier — see K4-AlgebraicIntakeValidator §STATE CARRIER.
/// Format: `[STATE] GATE: A|B|pass | KA: bound|drifting | KB: clean|dirty | ROUTE: bridge|controller|halt`
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatorHeader {
    pub gate: GatePhase,
    pub ka: BindStatus,
    pub kb: SubmissionStatus,
    pub route: RouteTarget,
}

// ─── Paradox Engine header ─────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnchorKind {
    Full,      // both home and absent locked
    HomeOnly,  // metric locked, face open — 3 stances share that home
    FaceOnly,  // absent locked, metric open — 3 stances share that face
}

/// The Paradox Engine's `[STATE]` carrier — see K4-ParadoxEngine §STATE CARRIER.
/// Format: `[STATE] TURN: n | MODE: paradox | ANCHOR: full|home-only|face-only | AT: <stance|pole> | RUNG: 0.. | RECOGNIZED: n`
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParadoxHeader {
    pub turn: u32,
    pub anchor: AnchorKind,
    pub at: Option<Stance>,   // full-position; None when partial anchor
    pub rung: u32,
    pub recognized: u32,
}

// ─── BWR (existing types) ──────────────────────────────────────

#[derive(Debug, Clone, PartialEq)] 
pub struct BridgeWorkingRecord {
    pub map: MapState,
    pub live: LiveProbe,
    pub braid_context: BraidContext,
}

#[derive(Debug, Clone, PartialEq)] 
pub struct MapState {
    pub anchor: (String, Pole, f32),
    pub axis_scores: HashMap<String, Pole>,
    pub contested: Vec<String>,
    pub qf: QFactor,
    pub corpus_role_provisional: HashMap<String, ElementRole>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QFactor { High, Mod, Low }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ElementRole { Spec, Material, Nil }

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LiveProbe {
    pub at_facet: u8,
    pub articulation: String,
    pub theta_prev: PhaseDirection,
    pub reactance_offered: Option<Reactance>,
    pub p4_retries: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhaseDirection { Lead, Lag, Zero }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reactance { Capacitive, Inductive }

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BraidContext {
    pub last_stance: Option<Stance>,
    pub legal_facets: LegalFacets,
    pub thread_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LegalFacets {
    All,
    Adjacent(Vec<u8>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WriteStamp {
    pub cycle: u32,
    pub seq: u64,
    pub writer: Pole,
    pub stance: Stance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SlotState {
    Unwritten,
    Prior,
    Current,
    Stale,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SurfaceSlot {
    pub content: Option<String>,
    pub stamp: Option<WriteStamp>,
    pub state: SlotState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkingSurface {
    pub slots: HashMap<Pole, SurfaceSlot>,
}

impl WorkingSurface {
    pub fn new() -> Self {
        let mut slots = HashMap::new();
        for pole in [Pole::P, Pole::U, Pole::I, Pole::R] {
            slots.insert(pole, SurfaceSlot {
                content: None,
                stamp: None,
                state: SlotState::Unwritten,
            });
        }
        Self { slots }
    }

    pub fn recompute_staleness(&mut self, header: &StateHeader) {
        let current_cycle = header.cycle;
        let path = &header.path;

        for (i, &x_pole) in path.iter().enumerate() {
            let x_slot = self.slots.get(&x_pole).unwrap();
            if x_slot.stamp.is_none() || x_slot.stamp.unwrap().cycle < current_cycle {
                continue;
            }

            let x_seq = x_slot.stamp.unwrap().seq;
            let mut is_stale = false;

            for &y_pole in path.iter().take(i) {
                if let Some(y_slot) = self.slots.get(&y_pole) {
                    if let Some(y_stamp) = y_slot.stamp {
                        if y_stamp.cycle == current_cycle && y_stamp.seq > x_seq {
                            is_stale = true;
                            break;
                        }
                    }
                }
            }

            if let Some(slot) = self.slots.get_mut(&x_pole) {
                if is_stale {
                    slot.state = SlotState::Stale;
                } else if slot.state == SlotState::Unwritten {
                    slot.state = SlotState::Current;
                }
            }
        }
    }

    pub fn write(&mut self, header: &mut StateHeader, pole: Pole, content: String, stance: Stance) {
        header.seq += 1;
        let stamp = WriteStamp {
            cycle: header.cycle,
            seq: header.seq,
            writer: pole,
            stance,
        };

        if let Some(slot) = self.slots.get_mut(&pole) {
            slot.content = Some(content);
            slot.stamp = Some(stamp);
            slot.state = SlotState::Current;
        }
        self.recompute_staleness(header);
    }

    pub fn format_for_prompt(&self) -> String {
        let mut out = String::new();
        for (pole, slot) in &self.slots {
            let content = slot.content.as_deref().unwrap_or("[UNWRITTEN]");
            let state = format!("{:?}", slot.state);
            out.push_str(&format!("- {}: {} ({})\n", pole, content, state));
        }
        out
    }
}

