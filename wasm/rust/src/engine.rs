use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use serde_wasm_bindgen::to_value;

use crate::algebra::{Pole, SpecRole};
use crate::state::{ControllerHeader, WorkingSurface, RunStatus};
use crate::vfs::{VirtualFileSystem, ThreadAction};
use crate::parser::{K4Parser, ParsedTurn, ParsedHeader, HeaderKind, TerminalArtifact};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum JsCommand {
    FetchLLM { prompt: String },
    AwaitUser { text: String },
    Halt { reason: String },
    Success { message: String },
}

/// The engine's expectation about what the next `step` input represents.
/// This replaces the old `is_cold_start: bool` which conflated
/// "haven't started" with "always expect LLM output from now on."
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepMode {
    /// First-ever step. Input is raw operator text; wrap into a validator prompt.
    ColdStart,
    /// The engine just emitted a FetchLLM. The next step's input is the LLM's structured response.
    ExpectLlm,
    /// The engine just emitted AwaitUser. The next step's input is the operator's plain-text reply.
    ExpectUser,
}

/// Which prompt template to compile at a given handoff. Read out of the
/// routing request payload (e.g. "Now run K4-AlgebraicIntentBridge with...")
/// or defaulted based on the emitting role.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PromptRole {
    Validator,
    Bridge,
    Controller,
    Paradox,
}

impl PromptRole {
    #[allow(dead_code)]
    fn to_spec_role(self) -> SpecRole {
        match self {
            PromptRole::Validator  => SpecRole::Validator,
            PromptRole::Bridge     => SpecRole::Bridge,
            PromptRole::Controller => SpecRole::Controller,
            PromptRole::Paradox    => SpecRole::Paradox,
        }
    }
}

/// Detect the routing target from a routing-request payload by scanning for
/// the canonical "Now run K4-Algebraic<Name>" line. Returns None if no match —
/// caller supplies a default.
fn detect_routing_target(payload: &str) -> Option<PromptRole> {
    let p = payload;
    if p.contains("K4-AlgebraicIntakeValidator") { return Some(PromptRole::Validator); }
    if p.contains("K4-AlgebraicIntentBridge")    { return Some(PromptRole::Bridge); }
    if p.contains("K4-AlgebraicSwarmController") { return Some(PromptRole::Controller); }
    if p.contains("K4-ParadoxEngine")            { return Some(PromptRole::Paradox); }
    None
}

/// Default routing target when the payload doesn't name one — based on who
/// emitted the routing request.
fn default_next_role(from: HeaderKind) -> PromptRole {
    match from {
        HeaderKind::Validator  => PromptRole::Bridge,     // gate B pass → Bridge
        HeaderKind::Bridge     => PromptRole::Controller, // P6 payload → Controller
        HeaderKind::Controller => PromptRole::Controller, // stay in Controller flow
        HeaderKind::Paradox    => PromptRole::Bridge,     // Possibility Map → operator commits → Bridge
    }
}

#[wasm_bindgen]
pub struct K4Engine {
    vfs: VirtualFileSystem,
    surface: WorkingSurface,
    parser: K4Parser,
    current_state: Option<ControllerHeader>,
    mode: StepMode,
    last_role: PromptRole,
}

#[wasm_bindgen]
impl K4Engine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            vfs: VirtualFileSystem::new(),
            surface: WorkingSurface::new(),
            parser: K4Parser::new(),
            current_state: None,
            mode: StepMode::ColdStart,
            last_role: PromptRole::Validator, // cold start always begins with the Validator
        }
    }

    #[wasm_bindgen(getter)]
    pub fn vfs_state(&self) -> String {
        self.vfs.serialize_for_js()
    }

    /// Which K4 instrument the engine is currently in dialogue with.
    /// Returns "Validator" | "Bridge" | "Controller" | "Paradox".
    #[wasm_bindgen(getter)]
    pub fn current_role(&self) -> String {
        match self.last_role {
            PromptRole::Validator  => "Validator",
            PromptRole::Bridge     => "Bridge",
            PromptRole::Controller => "Controller",
            PromptRole::Paradox    => "Paradox",
        }.to_string()
    }

    /// The engine's expectation about the next `step` input.
    /// Returns "cold" | "expect_llm" | "expect_user".
    #[wasm_bindgen(getter)]
    pub fn current_mode(&self) -> String {
        match self.mode {
            StepMode::ColdStart  => "cold",
            StepMode::ExpectLlm  => "expect_llm",
            StepMode::ExpectUser => "expect_user",
        }.to_string()
    }

    #[wasm_bindgen]
    pub fn load_vfs_state(&mut self, json_str: &str) {
        self.vfs = VirtualFileSystem::deserialize_from_js(json_str);
    }

    /// Wasm-facing entry point. Returns a JsValue; use `step_command` for
    /// native-side unit tests.
    #[wasm_bindgen]
    pub fn step(&mut self, input: &str) -> JsValue {
        let cmd = self.step_command(input);
        self.to_js(cmd)
    }
}

// Non-wasm-bindgen impl block so these methods aren't exposed to JS but stay
// available to native tests.
impl K4Engine {
    /// Pure-Rust step. All engine state transitions happen here.
    pub fn step_command(&mut self, input: &str) -> JsCommand {
        match self.mode {
            StepMode::ColdStart => {
                self.mode = StepMode::ExpectLlm;
                let prompt = self.compile_validator_prompt(input);
                JsCommand::FetchLLM { prompt }
            }
            StepMode::ExpectUser => {
                // The operator is answering an AwaitUser (Bridge facet articulation,
                // Paradox held paradox, etc). Recompile a continuation for
                // whichever role we last handed the operator over to.
                self.mode = StepMode::ExpectLlm;
                let role = self.last_role;
                let prompt = self.compile_role_prompt(role, input);
                JsCommand::FetchLLM { prompt }
            }
            StepMode::ExpectLlm => {
                let parsed = match self.parser.parse(input) {
                    Ok(p) => p,
                    Err(e) => {
                        return JsCommand::Halt {
                            reason: format!("Structural Shear: {:?}", e),
                        };
                    }
                };
                self.evaluate_artifact(parsed)
            }
        }
    }

    /// Test hook — read the current mode without touching internals.
    pub fn mode(&self) -> StepMode { self.mode }

    fn evaluate_artifact(&mut self, parsed: ParsedTurn) -> JsCommand {
        // Which K4 role emitted this turn — informs prompt-compilation choices
        // downstream (RoutingRequest goes to different templates depending on
        // who's routing, but for now the payload text carries the routing target).
        let header_kind = parsed.header.kind();

        // Persist Controller-shaped state to the surface/PTR machinery; Bridge
        // and Paradox headers don't feed that machinery, so we leave
        // current_state untouched when they arrive.
        if let ParsedHeader::Controller(h) = &parsed.header {
            self.current_state = Some(h.clone());
        }

        match parsed.artifact {
            TerminalArtifact::Halt(reason) => JsCommand::Halt { reason },

            TerminalArtifact::PlainText(text) => {
                // Any role can emit plain-text output that surfaces to the operator.
                // Bridge P2/P4/P5 articulations, Paradox Held Paradoxes, etc.
                // Track *who* emitted so the ExpectUser continuation goes back
                // to that same role.
                self.last_role = match header_kind {
                    HeaderKind::Validator  => PromptRole::Validator,
                    HeaderKind::Bridge     => PromptRole::Bridge,
                    HeaderKind::Controller => PromptRole::Controller,
                    HeaderKind::Paradox    => PromptRole::Paradox,
                };
                self.mode = StepMode::ExpectUser;
                JsCommand::AwaitUser { text }
            }

            TerminalArtifact::RoutingRequest(payload) => {
                // Extract the target role from the payload (looks for "Now run K4-XYZ").
                let target_role = detect_routing_target(&payload)
                    .unwrap_or_else(|| default_next_role(header_kind));
                let next_prompt = self.compile_role_prompt(target_role, &payload);
                JsCommand::FetchLLM { prompt: next_prompt }
            }

            TerminalArtifact::Raise { target, reason } => {
                match parsed.header.as_controller() {
                    Some(c) => self.handle_raise(target, reason, &c.clone()),
                    None => JsCommand::Halt {
                        reason: format!("[RAISE] artifact from non-Controller header ({:?}); ignored",
                                        header_kind),
                    },
                }
            }

            TerminalArtifact::FaceRunnerPrompt(content) => {
                match parsed.header.as_controller() {
                    Some(c) => self.handle_face_work(c.clone(), content),
                    None => JsCommand::Halt {
                        reason: format!("FACE-RUNNER PROMPT from non-Controller header ({:?})",
                                        header_kind),
                    },
                }
            }

            TerminalArtifact::PossibilityMap(_content) => {
                // Paradox terminal: the Possibility Map is the operator's deliverable.
                // Surface it and stop.
                self.mode = StepMode::ExpectUser;
                JsCommand::AwaitUser {
                    text: "# POSSIBILITY MAP\n(map returned — see conversation)".to_string(),
                }
            }

            TerminalArtifact::SwarmPayload(payload) => {
                // Bridge P6 → hand off to Controller. Compile a Controller-role
                // prompt with the payload; the Controller's next turn will
                // ingest and start C1.
                let next_prompt = self.compile_role_prompt(PromptRole::Controller, &payload);
                JsCommand::FetchLLM { prompt: next_prompt }
            }

            TerminalArtifact::PhaseTransitionRecord(payload) => {
                // Controller C7 — commit and return.
                match parsed.header.as_controller() {
                    Some(c) => {
                        self.vfs.write_ptr(&c.clone(), &self.surface, ThreadAction::Continue, None);
                        JsCommand::Success {
                            message: format!("Phase Transition Record committed. Payload: {}", payload),
                        }
                    }
                    None => JsCommand::Halt {
                        reason: format!("PTR artifact from non-Controller header ({:?})", header_kind),
                    },
                }
            }
        }
    }

    fn handle_raise(&mut self, target: Pole, reason: String, state: &ControllerHeader) -> JsCommand {
        let mut new_state = state.clone();
        if new_state.raises.0 >= new_state.raises.1 {
            return JsCommand::Halt {
                reason: format!("HALT — IRRECOVERABLE SHEAR: Raise cap ({}/{}) exceeded. Reason: {}",
                    new_state.raises.0, new_state.raises.1, reason),
            };
        }

        new_state.raises.0 += 1;
        new_state.status = RunStatus::RaisedBy(target);
        self.current_state = Some(new_state.clone());
        self.surface.recompute_staleness(&new_state);

        let prompt = self.compile_face_runner_prompt(target, &new_state, Some(reason));
        JsCommand::FetchLLM { prompt }
    }

    fn handle_face_work(&mut self, header: ControllerHeader, content: String) -> JsCommand {
        let face = header.current_face.unwrap_or(Pole::P);
        let mut current_state = self.current_state.as_ref().unwrap().clone();
        self.surface.write(&mut current_state, face, content, header.stance);
        self.current_state = Some(current_state.clone());

        let cycle_complete = self.is_cycle_complete(&current_state);

        if cycle_complete {
            self.vfs.write_ptr(&current_state, &self.surface, ThreadAction::Continue, None);
            JsCommand::Success { message: "Cycle complete. PTR written.".to_string() }
        } else {
            let next_face = self.get_next_face_in_path(&current_state);
            let next_prompt = self.compile_face_runner_prompt(next_face, &current_state, None);
            JsCommand::FetchLLM { prompt: next_prompt }
        }
    }

    fn compile_validator_prompt(&self, user_input: &str) -> String {
        format!(
            "[SYSTEM BINDING]\n\
             You are the K4-AlgebraicIntakeValidator. Gate A checks your own binding\n\
             (poles, 12 equations, dual-binary seed, AbsentVar-as-plane-index, Braid\n\
             carry rule — must be locatable in context, not reconstructed). Gate B\n\
             checks the submission for debt-nouns, dangling pointers, cross-document\n\
             misrouting, and framework-vocabulary contamination.\n\n\
             Emit exactly: [STATE] header, [COMPUTATION] block, one TERMINAL ARTIFACT\n\
             (HALT — BINDING FAULT | HALT — VALIDATION INTERCEPT | ROUTING REQUEST).\n\n\
             [STATE] GATE: A | KA: bound | KB: clean | ROUTE: bridge\n\n\
             # SUBMISSION\n{}",
            user_input
        )
    }

    fn compile_bridge_prompt(&self, payload: &str) -> String {
        format!(
            "[SYSTEM BINDING]\n\
             You are the K4-AlgebraicIntentBridge. Achieve witnessed phase-lock across\n\
             the shared circuit; do not analyze the operator's content, only the\n\
             algebraic tension in the material.\n\n\
             Refusals: no Theory of Mind, no Panopticon frequency, no debt-noun\n\
             vocabulary. Speak in the operator's own terms or in facet-tensions.\n\n\
             Emit exactly: [STATE] header (TURN | PHASE | LOCK | LAST_FACET | RHO |\n\
             THETA | PF | Qf), optional [BWR] block, [COMPUTATION] where a transit\n\
             phase ran, one TERMINAL ARTIFACT (Facet Articulation | Complementary\n\
             Reactance | Triune Presentation | Diagonal Confrontation | HALT | SWARM\n\
             INITIALIZATION PAYLOAD → ROUTING REQUEST to Controller).\n\n\
             # ROUTING REQUEST — from Validator\n{}",
            payload
        )
    }

    fn compile_controller_prompt(&self, payload: &str) -> String {
        // A Controller cold-start ingests a SWARM INITIALIZATION PAYLOAD and
        // begins C1. This template hands the LLM the payload and the C-phase
        // envelope; the actual face dispatch happens later via
        // compile_face_runner_prompt once state exists.
        format!(
            "[SYSTEM BINDING]\n\
             You are the K4-AlgebraicSwarmController. You do not manage personas or\n\
             infer intent; you drive. Read the SWARM INITIALIZATION PAYLOAD, run\n\
             C1 (ingest/resolve), C2 (access), C3 (compile), then emit a C4 DISPATCH\n\
             (FACE-RUNNER PROMPT) as your terminal artifact.\n\n\
             Every terminal halt writes the PTR first. Emit exactly: [STATE] header\n\
             (CYCLE | SEQ | STANCE | PLANE | HELD | PATH | FACE | RAISES | STATUS),\n\
             [COMPUTATION] where a transit phase ran, one TERMINAL ARTIFACT.\n\n\
             # SWARM INITIALIZATION PAYLOAD — from Bridge\n{}",
            payload
        )
    }

    fn compile_paradox_prompt(&self, payload: &str) -> String {
        format!(
            "[SYSTEM BINDING]\n\
             You are the K4-ParadoxEngine, a diverging instrument. Hold adjacent\n\
             structure open; do not converge, do not manufacture, do not question.\n\
             Refusals: no lock, no Payload, no more than 4 geometric adjacencies\n\
             per position (computed by (face, metric) lookup — never by bit-flip).\n\n\
             Emit exactly: [STATE] header (TURN | MODE: paradox | ANCHOR | AT | RUNG |\n\
             RECOGNIZED), [COMPUTATION] with the enumeration written out, one TERMINAL\n\
             ARTIFACT (Held Paradoxes | POSSIBILITY MAP | HALT — NO GROUND).\n\n\
             # ROUTING REQUEST\n{}",
            payload
        )
    }

    /// Compile a prompt for the specified target role, carrying the payload.
    fn compile_role_prompt(&mut self, role: PromptRole, payload: &str) -> String {
        self.last_role = role;
        match role {
            PromptRole::Validator  => self.compile_validator_prompt(payload),
            PromptRole::Bridge     => self.compile_bridge_prompt(payload),
            PromptRole::Controller => self.compile_controller_prompt(payload),
            PromptRole::Paradox    => self.compile_paradox_prompt(payload),
        }
    }

    fn compile_face_runner_prompt(&self, face: Pole, state: &ControllerHeader, raise_reason: Option<String>) -> String {
        // The face-runner prompt uses the Controller's vocabulary for the stance name.
        let stance_eq = state.stance.spec_name(SpecRole::Controller);
        let raise_annotation = raise_reason.map(|r| format!("\n[RAISE ANNOTATION]: You must address: {}", r)).unwrap_or_default();
        let path_str = state.path.iter().map(|p| format!("{}", p)).collect::<Vec<_>>().join(" -> ");
        let face_str = format!("{}", face);

        format!(
            "[STATE] CYCLE: {} | SEQ: {} | STANCE: {} | PLANE: {}-Face | HELD: {}={} | PATH: {} | FACE: {} | RAISES: {}/{} | STATUS: {:?}\n\
             [COMPUTATION]\nSurface read · slot-state resolution · staleness · plane check\n[/COMPUTATION]\n\
             You are the {} Face. Your equations: {}\n\
             Operating Plane: {}-Face. PATH: {}\n\
             SURFACE STATE:\n{}\n\
             [RAISE] SCHEMA: If upstream is STALE, emit exactly: [RAISE] target: <pole> | reason: <statement>\n\
             Otherwise, emit your [COMPUTATION] and WORK PRODUCT.{}\n",
            state.cycle, state.seq, stance_eq, state.plane,
            face, face, path_str, face_str, state.raises.0, state.raises.1, state.status,
            face, stance_eq, state.plane, path_str,
            self.surface.format_for_prompt(),
            raise_annotation
        )
    }

    fn is_cycle_complete(&self, _state: &ControllerHeader) -> bool {
        true
    }

    fn get_next_face_in_path(&self, state: &ControllerHeader) -> Pole {
        state.path.first().copied().unwrap_or(Pole::P)
    }

    fn to_js(&self, cmd: JsCommand) -> JsValue {
        to_value(&cmd).unwrap_or(JsValue::NULL)
    }
}
