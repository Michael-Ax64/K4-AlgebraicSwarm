// wasm/rust/src/engine.rs
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use serde_wasm_bindgen::to_value;

use crate::algebra::{Pole, SpecRole};
use crate::state::{ControllerHeader, HeldRole, WorkingSurface, RunStatus};
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepMode {
    ColdStart,
    ExpectLlm,
    ExpectUser,
}

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

fn detect_routing_target(payload: &str) -> Option<PromptRole> {
    if payload.contains("K4-AlgebraicIntakeValidator") { return Some(PromptRole::Validator); }
    if payload.contains("K4-AlgebraicIntentBridge")    { return Some(PromptRole::Bridge); }
    if payload.contains("K4-AlgebraicSwarmController") { return Some(PromptRole::Controller); }
    if payload.contains("K4-ParadoxEngine")            { return Some(PromptRole::Paradox); }
    None
}

fn default_next_role(from: HeaderKind) -> PromptRole {
    match from {
        HeaderKind::Validator  => PromptRole::Bridge,
        HeaderKind::Bridge     => PromptRole::Controller,
        HeaderKind::Controller => PromptRole::Controller,
        HeaderKind::Paradox    => PromptRole::Bridge,
    }
}

#[wasm_bindgen]
pub struct K4Engine {
    vfs: VirtualFileSystem,
    surface: WorkingSurface,
    parser: K4Parser,
    current_state: Option<ControllerHeader>,
    last_bwr: Option<String>,
    last_bridge_state: Option<String>,
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
            last_bwr: None,
            last_bridge_state: None,
            mode: StepMode::ColdStart,
            last_role: PromptRole::Validator, 
        }
    }

    #[wasm_bindgen(getter)]
    pub fn vfs_state(&self) -> String {
        self.vfs.serialize_for_js()
    }

    #[wasm_bindgen(getter)]
    pub fn current_role(&self) -> String {
        match self.last_role {
            PromptRole::Validator  => "Validator",
            PromptRole::Bridge     => "Bridge",
            PromptRole::Controller => "Controller",
            PromptRole::Paradox    => "Paradox",
        }.to_string()
    }

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

    /// Single string step for legacy tests
    #[wasm_bindgen]
    pub fn step(&mut self, input: &str) -> JsValue {
        let cmd = self.step_command(input);
        self.to_js(cmd)
    }

    /// Full Validator-compliant submission taking multiple documents
    #[wasm_bindgen]
    pub fn step_submission(&mut self, doc0: &str, corpus_json: &str) -> JsValue {
        // Build the unified geometric object: Document 0 + Corpus 1..N
        let mut unified_input = format!("Document 0 (Prompt):\n{}\n\n", doc0);
        
        if let Ok(docs) = serde_json::from_str::<Vec<(String, String)>>(corpus_json) {
            for (i, (name, content)) in docs.iter().enumerate() {
                unified_input.push_str(&format!("Document {} ({}):\n{}\n\n", i + 1, name, content));
            }
        }
        
        let cmd = self.step_command(&unified_input);
        self.to_js(cmd)
    }
}

impl K4Engine {
    pub fn step_command(&mut self, input: &str) -> JsCommand {
        match self.mode {
            StepMode::ColdStart => {
                self.mode = StepMode::ExpectLlm;
                let prompt = self.compile_validator_prompt(input);
                JsCommand::FetchLLM { prompt }
            }
            StepMode::ExpectUser => {
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

    pub fn mode(&self) -> StepMode { self.mode }

    fn evaluate_artifact(&mut self, parsed: ParsedTurn) -> JsCommand {
        let header_kind = parsed.header.kind();

        if let ParsedHeader::Controller(h) = &parsed.header {
            self.current_state = Some(h.clone());
        }

        // Bridge BWR and State persistence for the validation intercept dirty-bounce
        if let Some(bwr) = &parsed.bwr {
            self.last_bwr = Some(bwr.clone());
        }
        if let ParsedHeader::Bridge(_) = &parsed.header {
            // Re-serialize strictly the header line if needed, but for now we just
            // trust we can reflect it.
            self.last_bridge_state = Some(format!("{:?}", parsed.header));
        }

        match parsed.artifact {
            TerminalArtifact::Halt(reason) => {
                // If this is a validation intercept, spec requires we echo [STATE] and [BWR].
                if reason.contains("VALIDATION INTERCEPT") {
                    let bwr_str = self.last_bwr.as_deref().unwrap_or("NONE");
                    let state_str = self.last_bridge_state.as_deref().unwrap_or("NONE");
                    let full_reason = format!("{}\n\n[STATE]\n{}\n[BWR]\n{}", reason, state_str, bwr_str);
                    JsCommand::Halt { reason: full_reason }
                } else {
                    JsCommand::Halt { reason }
                }
            },

            TerminalArtifact::PlainText(text) => {
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
                self.mode = StepMode::ExpectUser;
                JsCommand::AwaitUser {
                    text: "# POSSIBILITY MAP\n(map returned — see conversation)".to_string(),
                }
            }

            TerminalArtifact::SwarmPayload(payload) => {
                let next_prompt = self.compile_role_prompt(PromptRole::Controller, &payload);
                JsCommand::FetchLLM { prompt: next_prompt }
            }

            TerminalArtifact::PhaseTransitionRecord(payload) => {
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
        
        // Dimensional Fork: Push (2D surface) vs Hold (3D sandbox)
        if current_state.held_role == HeldRole::Material {
            let run_id = format!("Run_{}", current_state.cycle);
            let filename = format!("{}_face.md", face);
            self.vfs.write_to_sandbox(&run_id, &filename, &content);
        } else {
            self.surface.write(&mut current_state, face, content, header.stance);
        }
        
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
             You are the K4-AlgebraicIntakeValidator. You gate and route.\n\
             [FOUNDATIONAL LEXICON]\n\
             - Bounded Frame: Has a metabolic budget. Pays for what it does.\n\
             - Payability/Debt-noun: Which frame pays for this word? No payer = debt.\n\
             - Markov Blanket: You are the K3 boundary separating interior from exterior.\n\
             - Misrouting: P-claim assigned as R-claim across documents. (Shear).\n\n\
             GATE A: Binding Check. Locate the 4 poles, 12 equations, dual-binary seed in context.\n\
             GATE B: Submission Check. Check unified submission (Doc 0-N) for debt-nouns, misrouting.\n\n\
             Emit exactly: [STATE] header, [COMPUTATION] block, one TERMINAL ARTIFACT.\n\
             [STATE] GATE: A | KA: bound | KB: clean | ROUTE: bridge\n\n\
             # SUBMISSION\n{}",
            user_input
        )
    }

    fn compile_bridge_prompt(&self, payload: &str) -> String {
        format!(
            "[SYSTEM BINDING]\n\
             You are the K4-AlgebraicIntentBridge. Achieve witnessed phase-lock across the shared circuit.\n\
             Refusals: No Theory of Mind. No Panopticon frequency. No debt-noun vocabulary.\n\
             [THE HARNESS]\n\
             P (Fire): Active+Asserting. U (Air): Active+Yielding. I (Water): Reactive+Yielding. R (Earth): Reactive+Asserting.\n\
             Read the AC parameters: theta (phase direction), rho (coherence score).\n\
             Emit exactly: [STATE] header, [BWR] block with LiveProbe/Map, [COMPUTATION], one TERMINAL ARTIFACT.\n\
             Artifacts: Facet Articulation | Complementary Reactance | Triune Presentation | Diagonal Confrontation | SWARM INITIALIZATION PAYLOAD\n\n\
             # ROUTING REQUEST\n{}",
            payload
        )
    }

    fn compile_controller_prompt(&self, payload: &str) -> String {
        format!(
            "[SYSTEM BINDING]\n\
             You are the K4-AlgebraicSwarmController. You drive. You do not manage personas.\n\
             [GRAIN LEDGER RULES]\n\
             SPEC = Binding constraint. MATERIAL = Object of work (Hold role). Nil = Off-plane (Push role).\n\
             Ingest the SWARM INITIALIZATION PAYLOAD. Resolve C1, C2, C3. Emit C4 DISPATCH.\n\
             Emit exactly: [STATE] header, [COMPUTATION], TERMINAL ARTIFACT (FACE-RUNNER PROMPT).\n\n\
             # PAYLOAD\n{}",
            payload
        )
    }

    fn compile_paradox_prompt(&self, payload: &str) -> String {
        format!(
            "[SYSTEM BINDING]\n\
             You are the K4-ParadoxEngine. Hold adjacent structure open. Do not converge.\n\
             Geometric Adjacency Law: Adjacency is (face, metric) lookup, never bit-flip.\n\
             Emit exactly: [STATE] header, [COMPUTATION] (the enumeration), TERMINAL ARTIFACT (Held Paradoxes | POSSIBILITY MAP).\n\n\
             # REQUEST\n{}",
            payload
        )
    }

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
        let stance_eq = state.stance.spec_name(SpecRole::Controller);
        let raise_annotation = raise_reason.map(|r| format!("\n[RAISE ANNOTATION]: Address: {}", r)).unwrap_or_default();
        let path_str = state.path.iter().map(|p| format!("{}", p)).collect::<Vec<_>>().join(" -> ");
        
        let dimensional_fork = if state.held_role == HeldRole::Material {
            format!("You are operating in the K4 volume. [AbsentVar] is the axis you map. Return phenomenology. Write to Sandbox Run_{}.", state.cycle)
        } else {
            format!("You are operating on the {}-Face (2D K3 plane). [AbsentVar] is nil. Do not treat it as a target.", state.plane)
        };

        format!(
            "[STATE] CYCLE: {} | SEQ: {} | STANCE: {} | PLANE: {}-Face | HELD: {}={:?} | PATH: {} | FACE: {} | RAISES: {}/{} | STATUS: {:?}\n\
             [COMPUTATION]\nSurface read · slot-state resolution\n[/COMPUTATION]\n\
             You are the {} Face. Equations: {}\n\
             {}\n\
             SURFACE STATE:\n{}\n\
             [RAISE] SCHEMA: If upstream is STALE, emit: [RAISE] target: <pole> | reason: <stmt>\n\
             Otherwise emit WORK PRODUCT.{}\n",
            state.cycle, state.seq, stance_eq, state.plane, state.stance.absent(), state.held_role, path_str, face, state.raises.0, state.raises.1, state.status,
            face, stance_eq, dimensional_fork, self.surface.format_for_prompt(), raise_annotation
        )
    }

    fn is_cycle_complete(&self, _state: &ControllerHeader) -> bool {
        // C8 stub implementation. In reality, check payload termination criteria.
        true
    }

    fn get_next_face_in_path(&self, state: &ControllerHeader) -> Pole {
        state.path.first().copied().unwrap_or(Pole::P)
    }

    fn to_js(&self, cmd: JsCommand) -> JsValue {
        to_value(&cmd).unwrap_or(JsValue::NULL)
    }
}

