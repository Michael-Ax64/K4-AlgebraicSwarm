// wasm/rust/src/parser.rs

//! # Parser — the message-boundary airlock
//!
//! The four K4 specs describe four instruments that take turns operating on a
//! shared circuit: the Validator gates, the Bridge sweeps and locks, the
//! Controller drives face-logic, the Paradox Engine diverges. Each instrument
//! stands at a different **station** in the process, and each instrument's
//! `[STATE]` carrier has a different shape because each carries information
//! appropriate to *its* station:
//!
//! * Validator — a Markov blanket. Carries only what a gate needs: which check
//!   is running (`GATE`), whether the blanket's own binding is intact (`KA`),
//!   whether the submission passed (`KB`), and where to route next (`ROUTE`).
//! * Bridge — an interior that converges toward phase-lock. Carries the
//!   phase-machine coordinates: which phase is live (`PHASE`), lock status
//!   (`LOCK`), the tested facet, coherence (`RHO`), phase (`THETA`), power
//!   factor (`PF`), operator's quality factor (`Qf`).
//! * Controller — a driver executing a locked coordinate through cycles.
//!   Carries the cycle machinery: cycle counter (`CYCLE`), monotonic `SEQ`,
//!   the committed stance, the operating plane, the traversal path, the
//!   raise cap.
//! * Paradox Engine — a diverging instrument that holds structure open.
//!   Carries the anchor state: what position is being enumerated from (`AT`),
//!   how deep the self-similar walk has gone (`RUNG`), how many adjacencies
//!   the operator has rung (`RECOGNIZED`).
//!
//! **The header shapes don't disagree; they route.** The header *is* the
//! routing tag — it names which station emitted the message. This parser's
//! job is the message-boundary equivalent of what the Validator does at the
//! operator-boundary: **input → classify → typed output**. Every message
//! coming into the runtime is recognized by which instrument sent it, and
//! unpacked into the shape appropriate for that station. Classify-then-dispatch
//! is the airlock behavior. `ParsedHeader` is the four-variant admission
//! record.
//!
//! This module has no domain logic. It only recognizes and admits. What the
//! engine does with the admitted message is downstream — the same way the
//! Validator does no interpretation, only gating.

use regex::Regex;
use std::collections::HashMap;
use crate::algebra::{Pole, Stance, parse_stance_from_name};
use crate::state::{
    ControllerHeader, BridgeHeader, ValidatorHeader, ParadoxHeader,
    HeldRole, RunStatus, BridgePhase, LockState, PhaseDirection, QFactor,
    GatePhase, BindStatus, SubmissionStatus, RouteTarget, AnchorKind,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TerminalArtifact {
    Halt(String),
    Raise { target: Pole, reason: String },
    RoutingRequest(String),
    SwarmPayload(String),
    FaceRunnerPrompt(String),
    PhaseTransitionRecord(String),
    PossibilityMap(String),
    HeldParadoxes(String), // Enables the interactive pause for the Paradox Engine
    PlainText(String),
}

/// A parsed `[STATE]` header, tagged by which K4 instrument emitted it.
///
/// **This is the admission record from the parser's airlock.** The four
/// variants are the four stations in the process — Validator, Bridge,
/// Controller, Paradox — and each variant's payload is the shape appropriate
/// to that station (see the module-level comment for what each carries and why).
///
/// The header shapes are not accidental drift across the specs. They are the
/// routing topology showing through in the type system: the state carrier at
/// each station is exactly the information needed to resume at that station.
/// A Bridge header cannot say `CYCLE` because the Bridge is pre-cycle; a
/// Controller header cannot say `RHO` because coherence scoring is upstream
/// Bridge work. Classifying-then-dispatching is what admits each shape into
/// its own typed slot.
#[derive(Debug, Clone, PartialEq)]
pub enum ParsedHeader {
    Validator(ValidatorHeader),
    Bridge(BridgeHeader),
    Controller(ControllerHeader),
    Paradox(ParadoxHeader),
}

impl ParsedHeader {
    pub fn kind(&self) -> HeaderKind {
        match self {
            ParsedHeader::Validator(_)  => HeaderKind::Validator,
            ParsedHeader::Bridge(_)     => HeaderKind::Bridge,
            ParsedHeader::Controller(_) => HeaderKind::Controller,
            ParsedHeader::Paradox(_)    => HeaderKind::Paradox,
        }
    }

    /// Convenience for the many code paths that only make sense for a Controller.
    pub fn as_controller(&self) -> Option<&ControllerHeader> {
        if let ParsedHeader::Controller(h) = self { Some(h) } else { None }
    }

    pub fn as_controller_mut(&mut self) -> Option<&mut ControllerHeader> {
        if let ParsedHeader::Controller(h) = self { Some(h) } else { None }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeaderKind {
    Validator,
    Bridge,
    Controller,
    Paradox,
}

#[derive(Debug, Clone)]
pub struct ParsedTurn {
    pub header: ParsedHeader,
    pub bwr: Option<String>,
    pub computation: Option<String>,
    pub artifact: TerminalArtifact,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseError {
    StructuralShear(String),
    MalformedHeader(String),
    InvalidPole(String),
    InvalidStance(&'static str),
}

pub struct K4Parser {
    fence_regex: Regex,
}

impl K4Parser {
    pub fn new() -> Self {
        Self {
            fence_regex: Regex::new(r"(?s)```(?:\w+)?\s*|\s*```").unwrap(),
        }
    }

    pub fn parse(&self, raw_llm_output: &str) -> Result<ParsedTurn, ParseError> {
        let text = self.fence_regex.replace_all(raw_llm_output, "").trim().to_string();

        let state_idx = text.find("[STATE]").ok_or(ParseError::StructuralShear("Missing [STATE] header".into()))?;
        let comp_start = text.find("[COMPUTATION]");
        let comp_end = text.find("[/COMPUTATION]");

        if let (Some(start), Some(end)) = (comp_start, comp_end) {
            if start < state_idx {
                return Err(ParseError::StructuralShear("[COMPUTATION] appeared before [STATE]".into()));
            }
            if end <= start {
                return Err(ParseError::StructuralShear("Malformed [COMPUTATION] block".into()));
            }
        } else if comp_start.is_some() || comp_end.is_some() {
            return Err(ParseError::StructuralShear("Unmatched [COMPUTATION] tags".into()));
        }

        let header_line_end = text[state_idx..].find('\n').unwrap_or(text.len() - state_idx) + state_idx;
        let header_line = text[state_idx..header_line_end].to_string();

        let header = Self::parse_and_validate_header(&header_line)?;
        let bwr = Self::extract_block(&text, "[BWR]", None);

        let computation = if let (Some(start), Some(end)) = (comp_start, comp_end) {
            Some(text[start + 13..end].trim().to_string())
        } else {
            None
        };

        let artifact_start = comp_end.map(|idx| idx + 14).unwrap_or(header_line_end);
        let remaining_text = &text[artifact_start..];
        let artifact = Self::classify_artifact(remaining_text)?;

        Ok(ParsedTurn { header, bwr, computation, artifact })
    }

    /// The airlock traversal, input → process → output:
    ///
    /// 1. **Input**: a raw `[STATE] …` header line.
    /// 2. **Process** — classify by the presence of station-marker keys:
    ///    `GATE` → Validator, `MODE=paradox` → Paradox, `PHASE`-without-`CYCLE`
    ///    → Bridge, `CYCLE` → Controller. Then dispatch to the per-station
    ///    parser that knows the shape *that* station carries.
    /// 3. **Output**: a `ParsedHeader` variant. Nothing is coerced across
    ///    stations; a Bridge header stays Bridge-shaped, a Controller header
    ///    stays Controller-shaped.
    ///
    /// This is the Validator's blanket applied one level down: the Validator
    /// is the blanket at the *operator* boundary; this function is the blanket
    /// at the *message* boundary. Both do the same thing — recognize which
    /// exterior sent the message, admit it in the shape appropriate for that
    /// sender, and hand a typed result to the interior.
    fn parse_and_validate_header(header_line: &str) -> Result<ParsedHeader, ParseError> {
        let content = header_line.trim_start_matches("[STATE]").trim();
        let mut map = HashMap::new();
        for part in content.split('|') {
            let kv: Vec<&str> = part.splitn(2, ':').collect();
            if kv.len() == 2 {
                map.insert(kv[0].trim().to_string(), kv[1].trim().to_string());
            }
        }

        // Classification-then-dispatch. Order matters: check MODE=paradox
        // before CYCLE (Paradox headers may carry CYCLE-like fields in future
        // extensions; MODE=paradox is the definitive marker).
        if map.contains_key("GATE") {
            Self::parse_validator_header(&map).map(ParsedHeader::Validator)
        } else if map.get("MODE").map(|s| s.as_str()) == Some("paradox") {
            Self::parse_paradox_header(&map).map(ParsedHeader::Paradox)
        } else if map.contains_key("PHASE") && !map.contains_key("CYCLE") {
            // PHASE-and-no-CYCLE is unambiguous Bridge. If both present, treat as Controller.
            Self::parse_bridge_header(&map).map(ParsedHeader::Bridge)
        } else if map.contains_key("CYCLE") {
            Self::parse_controller_header(&map).map(ParsedHeader::Controller)
        } else {
            Err(ParseError::MalformedHeader(
                format!("[STATE] header classifies as none of Validator|Bridge|Controller|Paradox (fields: {:?})",
                    map.keys().collect::<Vec<_>>())
            ))
        }
    }

    fn parse_controller_header(map: &HashMap<String, String>) -> Result<ControllerHeader, ParseError> {
        let cycle = map.get("CYCLE").ok_or(ParseError::MalformedHeader("Missing CYCLE".into()))?
            .parse::<u32>().map_err(|_| ParseError::MalformedHeader("CYCLE must be u32".into()))?;
        let seq = map.get("SEQ").ok_or(ParseError::MalformedHeader("Missing SEQ".into()))?
            .parse::<u64>().map_err(|_| ParseError::MalformedHeader("SEQ must be u64".into()))?;

        let stance_str = map.get("STANCE").ok_or(ParseError::MalformedHeader("Missing STANCE".into()))?;
        let stance = parse_stance_from_name(stance_str).map_err(ParseError::InvalidStance)?;

        let plane_str = map.get("PLANE").ok_or(ParseError::MalformedHeader("Missing PLANE".into()))?;
        let plane = parse_pole(plane_str.trim_end_matches("-Face").trim())?;

        let held_str = map.get("HELD").ok_or(ParseError::MalformedHeader("Missing HELD".into()))?;
        let held_parts: Vec<&str> = held_str.split('=').collect();
        let _held_pole = if held_parts.len() == 2 { parse_pole(held_parts[0].trim())? } else { parse_pole(held_str.trim())? };
        let held_role = if held_parts.len() == 2 && held_parts[1].trim().to_lowercase() == "material" {
            HeldRole::Material
        } else {
            HeldRole::Nil
        };

        let path_str = map.get("PATH").map_or("P>U>I>R", |s| s.as_str());
        let path = parse_path(path_str)?;
        let face_str = map.get("FACE").map_or("—", |s| s.as_str());
        let current_face = parse_face(face_str)?;

        let raises_str = map.get("RAISES").map_or("0/3", |s| s.as_str());
        let raise_parts: Vec<&str> = raises_str.split('/').collect();
        let raises_current = raise_parts.get(0).unwrap_or(&"0").parse::<u32>().map_err(|_| ParseError::MalformedHeader("RAISES current".into()))?;
        let raises_max = raise_parts.get(1).unwrap_or(&"3").parse::<u32>().map_err(|_| ParseError::MalformedHeader("RAISES max".into()))?;

        let status_str = map.get("STATUS").map_or("run", |s| s.as_str());
        let status = if status_str.trim() == "run" {
            RunStatus::Run
        } else if status_str.trim().starts_with("raised-by-") {
            RunStatus::RaisedBy(parse_pole(&status_str.trim()[10..])?)
        } else {
            RunStatus::Halted(status_str.trim().to_string())
        };

        Ok(ControllerHeader { cycle, seq, stance, plane, held_role, path, current_face, raises: (raises_current, raises_max), status })
    }

    fn parse_bridge_header(map: &HashMap<String, String>) -> Result<BridgeHeader, ParseError> {
        let turn = map.get("TURN").ok_or(ParseError::MalformedHeader("Missing TURN".into()))?
            .parse::<u32>().map_err(|_| ParseError::MalformedHeader("TURN must be u32".into()))?;

        let phase = match map.get("PHASE").map(String::as_str) {
            Some("0")  => BridgePhase::P0,
            Some("1")  => BridgePhase::P1,
            Some("2")  => BridgePhase::P2,
            Some("3")  => BridgePhase::P3,
            Some("4")  => BridgePhase::P4,
            Some("4b") => BridgePhase::P4b,
            Some("5")  => BridgePhase::P5,
            Some("5b") => BridgePhase::P5b,
            Some("6")  => BridgePhase::P6,
            Some(other) => return Err(ParseError::MalformedHeader(format!("Unknown PHASE {}", other))),
            None => return Err(ParseError::MalformedHeader("Missing PHASE".into())),
        };

        let lock = match map.get("LOCK").map(|s| s.trim()) {
            Some("sweeping")     => LockState::Sweeping,
            Some("approaching")  => LockState::Approaching,
            Some("LOCKED")       => LockState::Locked,
            Some("broken")       => LockState::Broken,
            Some(other)          => return Err(ParseError::MalformedHeader(format!("Unknown LOCK {}", other))),
            None                 => return Err(ParseError::MalformedHeader("Missing LOCK".into())),
        };

        let last_facet = match map.get("LAST_FACET").map(|s| s.trim()) {
            Some("—") | Some("-") | None => None,
            Some(n) => Some(n.parse::<u8>().map_err(|_| ParseError::MalformedHeader("LAST_FACET".into()))?),
        };

        let rho = match map.get("RHO").map(|s| s.trim()) {
            Some("—") | Some("-") | Some("") | None => None,
            Some(n) => Some(n.parse::<f32>().map_err(|_| ParseError::MalformedHeader("RHO".into()))?),
        };

        let theta = match map.get("THETA").map(|s| s.trim()) {
            Some("lead") => Some(PhaseDirection::Lead),
            Some("lag")  => Some(PhaseDirection::Lag),
            Some("zero") => Some(PhaseDirection::Zero),
            Some("—") | Some("-") | Some("") | None => None,
            Some(other) => return Err(ParseError::MalformedHeader(format!("Unknown THETA {}", other))),
        };

        let pf = match map.get("PF").map(|s| s.trim()) {
            Some("—") | Some("-") | Some("") | None => None,
            Some(n) => Some(n.parse::<f32>().map_err(|_| ParseError::MalformedHeader("PF".into()))?),
        };

        let qf = match map.get("Qf").map(|s| s.trim()) {
            Some("high") => Some(QFactor::High),
            Some("mod")  => Some(QFactor::Mod),
            Some("low")  => Some(QFactor::Low),
            Some("—") | Some("-") | Some("") | None => None,
            Some(other) => return Err(ParseError::MalformedHeader(format!("Unknown Qf {}", other))),
        };

        Ok(BridgeHeader { turn, phase, lock, last_facet, rho, theta, pf, qf })
    }

    fn parse_validator_header(map: &HashMap<String, String>) -> Result<ValidatorHeader, ParseError> {
        let gate = match map.get("GATE").map(|s| s.trim()) {
            Some("A")    => GatePhase::A,
            Some("B")    => GatePhase::B,
            Some("pass") => GatePhase::Pass,
            Some(other)  => return Err(ParseError::MalformedHeader(format!("Unknown GATE {}", other))),
            None         => return Err(ParseError::MalformedHeader("Missing GATE".into())),
        };
        let ka = match map.get("KA").map(|s| s.trim()) {
            Some("bound")    => BindStatus::Bound,
            Some("drifting") => BindStatus::Drifting,
            Some("—") | Some("-") | Some("") | None => BindStatus::Unset,
            Some(other) => return Err(ParseError::MalformedHeader(format!("Unknown KA {}", other))),
        };
        let kb = match map.get("KB").map(|s| s.trim()) {
            Some("clean") => SubmissionStatus::Clean,
            Some("dirty") => SubmissionStatus::Dirty,
            Some("—") | Some("-") | Some("") | None => SubmissionStatus::Unset,
            Some(other) => return Err(ParseError::MalformedHeader(format!("Unknown KB {}", other))),
        };
        let route = match map.get("ROUTE").map(|s| s.trim()) {
            Some("bridge")     => RouteTarget::Bridge,
            Some("controller") => RouteTarget::Controller,
            Some("paradox")    => RouteTarget::Paradox,
            Some("halt")       => RouteTarget::Halt,
            Some(other) => return Err(ParseError::MalformedHeader(format!("Unknown ROUTE {}", other))),
            None => return Err(ParseError::MalformedHeader("Missing ROUTE".into())),
        };
        Ok(ValidatorHeader { gate, ka, kb, route })
    }

    fn parse_paradox_header(map: &HashMap<String, String>) -> Result<ParadoxHeader, ParseError> {
        let turn = map.get("TURN").ok_or(ParseError::MalformedHeader("Missing TURN".into()))?
            .parse::<u32>().map_err(|_| ParseError::MalformedHeader("TURN must be u32".into()))?;
        let anchor = match map.get("ANCHOR").map(|s| s.trim()) {
            Some("full")      | Some("full-stance") => AnchorKind::Full,
            Some("home-only") | Some("home_only")   => AnchorKind::HomeOnly,
            Some("face-only") | Some("face_only")   => AnchorKind::FaceOnly,
            Some(other) => return Err(ParseError::MalformedHeader(format!("Unknown ANCHOR {}", other))),
            None => return Err(ParseError::MalformedHeader("Missing ANCHOR".into())),
        };
        // AT may be a stance name or blank
        let at = match map.get("AT").map(|s| s.trim()) {
            Some("") | Some("—") | Some("-") | None => None,
            Some(s) => Some(parse_stance_from_name(s).map_err(ParseError::InvalidStance)?),
        };
        let rung = map.get("RUNG").map(|s| s.trim()).unwrap_or("0")
            .parse::<u32>().map_err(|_| ParseError::MalformedHeader("RUNG must be u32".into()))?;
        let recognized = map.get("RECOGNIZED").map(|s| s.trim()).unwrap_or("0")
            .parse::<u32>().map_err(|_| ParseError::MalformedHeader("RECOGNIZED must be u32".into()))?;
        Ok(ParadoxHeader { turn, anchor, at, rung, recognized })
    }

    fn extract_block(text: &str, start_tag: &str, end_tag: Option<&str>) -> Option<String> {
        if let Some(start) = text.find(start_tag) {
            if let Some(end_t) = end_tag {
                if let Some(end) = text[start..].find(end_t) {
                    return Some(text[start + start_tag.len()..start + end].trim().to_string());
                }
            } else {
                let remaining = &text[start + start_tag.len()..];
                let end_markers = ["\n# ", "\n[STATE]", "\n[COMPUTATION]", "\n╭─"];
                let mut end_idx = remaining.len();
                for marker in end_markers {
                    if let Some(idx) = remaining.find(marker) {
                        if idx < end_idx { end_idx = idx; }
                    }
                }
                return Some(remaining[..end_idx].trim().to_string());
            }
        }
        None
    }

    fn classify_artifact(text: &str) -> Result<TerminalArtifact, ParseError> {
        if let Some(idx) = text.find("# HALT") { return Ok(TerminalArtifact::Halt(text[idx..].to_string())); }
        if let Some(idx) = text.find("[RAISE]") {
            let raise_block = &text[idx..];
            let target_str = raise_block.split("target:").nth(1).and_then(|s| s.split('|').next()).unwrap_or("").trim();
            let reason = raise_block.split("reason:").nth(1).unwrap_or("").trim().to_string();
            return Ok(TerminalArtifact::Raise { target: parse_pole(target_str)?, reason });
        }
        if let Some(idx) = text.find("# ROUTING REQUEST") { return Ok(TerminalArtifact::RoutingRequest(text[idx..].to_string())); }
        if let Some(idx) = text.find("# SWARM INITIALIZATION PAYLOAD") { return Ok(TerminalArtifact::SwarmPayload(text[idx..].to_string())); }
        if let Some(idx) = text.find("# PHASE TRANSITION RECORD") { return Ok(TerminalArtifact::PhaseTransitionRecord(text[idx..].to_string())); }
        if let Some(idx) = text.find("# POSSIBILITY MAP") { return Ok(TerminalArtifact::PossibilityMap(text[idx..].to_string())); }
        
        // CATCHING THE PARADOX ENGINE'S INTERACTIVE PAUSE
        if let Some(idx) = text.find("# HELD PARADOXES") { return Ok(TerminalArtifact::HeldParadoxes(text[idx..].to_string())); }
        if text.contains("Which of these is already bearing weight?") { return Ok(TerminalArtifact::HeldParadoxes(text.trim().to_string())); }
        
        if text.contains("FACE-RUNNER PROMPT") { return Ok(TerminalArtifact::FaceRunnerPrompt(text.trim().to_string())); }
        Ok(TerminalArtifact::PlainText(text.trim().to_string()))
    }
}

// Suppress "unused" warning on the imported Stance — used in doc-tests / future work.
#[allow(dead_code)]
fn _stance_typecheck(_s: Stance) {}

fn parse_pole(c: &str) -> Result<Pole, ParseError> {
    match c.trim() {
        "P" => Ok(Pole::P),
        "U" => Ok(Pole::U),
        "I" => Ok(Pole::I),
        "R" => Ok(Pole::R),
        _ => Err(ParseError::InvalidPole(c.to_string())),
    }
}

fn parse_path(path_str: &str) -> Result<Vec<Pole>, ParseError> {
    let mut path = Vec::new();
    for p in path_str.split(|c| c == '>' || c == ',' || c == '→') {
        let p_trim = p.trim();
        if !p_trim.is_empty() {
            path.push(parse_pole(p_trim)?);
        }
    }
    if path.is_empty() {
        return Err(ParseError::MalformedHeader("Empty PATH".to_string()));
    }
    Ok(path)
}

fn parse_face(face_str: &str) -> Result<Option<Pole>, ParseError> {
    let f = face_str.trim();
    if f == "—" || f == "-" || f.is_empty() {
        Ok(None)
    } else {
        Ok(Some(parse_pole(f)?))
    }
}
