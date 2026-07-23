// wasm/rust/src/engine.rs

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use serde_wasm_bindgen::to_value;

use crate::algebra::{Pole, SpecRole};
use crate::state::{ControllerHeader, HeldRole, WorkingSurface, RunStatus};
use crate::vfs::{VirtualFileSystem, ThreadAction};
use crate::parser::{K4Parser, ParsedTurn, ParsedHeader, HeaderKind, TerminalArtifact};

// ─── BINDING THE MASTER SPECS INTO THE BINARY ──────────────────
// This enforces the Cold-Start Rule. Blank LLM instances will now 
// receive the full algebraic harness, rules, and Lexicons inline.
const PROMPT_VALIDATOR: &str = include_str!("../../prompts/AlgebraicIntakeValidator.md");
const PROMPT_BRIDGE: &str = include_str!("../../prompts/AlgebraicIntentBridge.md");
const PROMPT_CONTROLLER: &str = include_str!("../../prompts/AlgebraicSwarmController.md");
const PROMPT_PARADOX: &str = include_str!("../../prompts/AlgebraicParadoxEngine.md");
// ───────────────────────────────────────────────────────────────

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
    domain_context: String, // <--- NEW: Rust holds the Domain Matrix
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
            domain_context: String::new(), 
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

    #[wasm_bindgen]
    pub fn set_domain_context(&mut self, context: &str) {
        self.domain_context = context.to_string();
    }

    #[wasm_bindgen]
    pub fn step(&mut self, input: &str) -> JsValue {
        let cmd = self.step_command(input);
        self.to_js(cmd)
    }

    #[wasm_bindgen]
    pub fn step_submission(&mut self, doc0: &str, corpus_json: &str) -> JsValue {
        // The doc0 string is now PURE user intent, free of TS context hacks
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
                
                // P-ROOM Recursion handler goes here. For now, simply routing the 
                // user's response back to the active role's prompt.
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

        if let Some(bwr) = &parsed.bwr {
            self.last_bwr = Some(bwr.clone());
        }
        if let ParsedHeader::Bridge(_) = &parsed.header {
            self.last_bridge_state = Some(format!("{:?}", parsed.header));
        }

        match parsed.artifact {
            TerminalArtifact::Halt(reason) => {
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
            
            // Diverging lens intercept
            TerminalArtifact::HeldParadoxes(text) => {
                self.last_role = PromptRole::Paradox;
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
                    text: "# POSSIBILITY MAP\n(Map returned — operator may now commit via Routing Request)".to_string(),
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
        
        if current_state.held_role == HeldRole::Material {
            let run_id = format!("Run_{}", current_state.cycle);
            let filename = format!("{}_face.md", face);
            self.vfs.write_to_sandbox(&run_id, &filename, &content);
        } else {
            self.surface.write(&mut current_state, face, content, header.stance);
        }
        
        self.current_state = Some(current_state.clone());

        if self.is_cycle_complete(&current_state) {
            self.vfs.write_ptr(&current_state, &self.surface, ThreadAction::Continue, None);
            JsCommand::Success { message: "Cycle complete. PTR written.".to_string() }
        } else {
            let next_face = self.get_next_face_in_path(&current_state);
            let next_prompt = self.compile_face_runner_prompt(next_face, &current_state, None);
            JsCommand::FetchLLM { prompt: next_prompt }
        }
    }

    fn compile_validator_prompt(&self, user_input: &str) -> String {
        let ctx = if self.domain_context.is_empty() { String::new() } else { format!("\n\n[CONTEXTUAL DICTIONARY]\n{}", self.domain_context) };
        // Placed ABOVE # SUBMISSION so it acts as rules, not operator text
        format!("{}{}\n\n# SUBMISSION\n{}", PROMPT_VALIDATOR, ctx, user_input)
    }

    fn compile_bridge_prompt(&self, payload: &str) -> String {
        // Computing the Gray-code adjacencies from the Braid
        let (last_stance, legal_facets) = self.vfs.get_braid_context();
        let stance_str = last_stance.map_or("NONE".to_string(), |s| s.equation_name().to_string());
        let facets_str = if legal_facets.len() == 12 { "ALL".to_string() } else { format!("{:?}", legal_facets) };
        
        let ctx = if self.domain_context.is_empty() { String::new() } else { format!("\n\n[DOMAIN MATRIX]\n{}", self.domain_context) };
        
        format!(
            "{}{}\n\n[BRAID-CONTEXT: last-stance {} | legal-facets {}]\n\n# ROUTING REQUEST\n{}",
            PROMPT_BRIDGE, ctx, stance_str, facets_str, payload
        )
    }

    fn compile_controller_prompt(&self, payload: &str) -> String {
        let ctx = if self.domain_context.is_empty() { String::new() } else { format!("\n\n[DOMAIN MATRIX]\n{}", self.domain_context) };
        format!("{}{}\n\n# PAYLOAD\n{}", PROMPT_CONTROLLER, ctx, payload)
    }

    fn compile_paradox_prompt(&self, payload: &str) -> String {
        let ctx = if self.domain_context.is_empty() { String::new() } else { format!("\n\n[DOMAIN MATRIX]\n{}", self.domain_context) };
        
        // P-ROOM Recursion handler: If the payload is a user reply (E3), wrap it 
        // in E3 instructions rather than blindly appending.
        if self.last_role == PromptRole::Paradox {
            format!(
                "{}{}\n\n[E3 RECOGNITION READ]\nThe operator responded to the Held Paradoxes:\n\"{}\"\n\
                 If they 'ring' on a tension, step to P-ROOM (shift AT, increment RUNG, enumerate from there).\n\
                 If 'clang', offer next, or E-EXIT with Possibility Map.",
                PROMPT_PARADOX, ctx, payload
            )
        } else {
            format!("{}{}\n\n# REQUEST\n{}", PROMPT_PARADOX, ctx, payload)
        }
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

        let ctx = if self.domain_context.is_empty() { String::new() } else { format!("\n[DOMAIN MATRIX]\n{}\n", self.domain_context) };

        format!(
            "[STATE] CYCLE: {} | SEQ: {} | STANCE: {} | PLANE: {}-Face | HELD: {}={:?} | PATH: {} | FACE: {} | RAISES: {}/{} | STATUS: {:?}\n\
             [COMPUTATION]\nSurface read · slot-state resolution\n[/COMPUTATION]\n\
             You are the {} Face. Equations: {}\n\
             {}\n\
             {}\n\
             SURFACE STATE:\n{}\n\
             [RAISE] SCHEMA: If upstream is STALE, emit: [RAISE] target: <pole> | reason: <stmt>\n\
             Otherwise emit WORK PRODUCT.{}\n",
            state.cycle, state.seq, stance_eq, state.plane, state.stance.absent(), state.held_role, path_str, face, state.raises.0, state.raises.1, state.status,
            face, stance_eq, dimensional_fork, ctx, self.surface.format_for_prompt(), raise_annotation
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
