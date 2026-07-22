// wasm/rust/src/vfs.rs
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use crate::algebra::{Pole, Stance};
use crate::state::{StateHeader, WorkingSurface, SlotState};

/// The action taken on the Braid thread at the end of a cycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThreadAction {
    Continue, // Append to current thread
    Sever,    // Park current thread, initialize new thread
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SurfaceSlotSnapshot {
    pub content: String,
    pub state: SlotState,
}

/// The Phase Transition Record (PTR). The only artifact that pays the Landauer Tax.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhaseTransitionRecord {
    pub thread_id: String,
    pub thread_action: ThreadAction,
    pub cycle: u32,
    pub final_seq: u64,
    pub stance: String, // Equation name, e.g., "Synthesis (P = U × I)"
    pub home_variable: Pole,
    pub operating_plane: Pole,
    pub path_traversed: Vec<Pole>,
    pub held_pole: Pole,
    pub held_role: String, // "nil" or "MATERIAL"
    pub surface_snapshot: HashMap<Pole, SurfaceSlotSnapshot>, 
    pub health: String, // "clear", "raises: k", or "HALTED: reason"
}

/// The in-memory Virtual File System. 
/// In Wasm, this is serialized to JSON and handed to the JS host for OPFS/IndexedDB persistence.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualFileSystem {
    /// Read-only originals. Faces never read this directly; it must be distilled first.
    pub input: HashMap<String, String>,
    
    /// Shared corpus. Unlocated content lands here. All faces read this.
    pub documentation: HashMap<String, String>,
    
    /// Located, detailed, face-specific content. (P, U, I, R)
    pub distilled: HashMap<Pole, HashMap<String, String>>,
    
    /// Boundary specification only. Minutiae withheld. (P, U, I, R)
    pub abstracted: HashMap<Pole, HashMap<String, String>>,
    
    /// Quarantined uncollapsed Q. Isolated from the main corpus.
    pub sandboxes: HashMap<String, HashMap<String, String>>, // Key: "Run_[id]"
    
    /// The Braid tree. The source of truth for cross-session continuity.
    pub braid: BraidTree,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BraidTree {
    pub active_thread_id: Option<String>,
    pub threads: HashMap<String, ThreadHistory>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadHistory {
    pub status: String, // "active" or "parked"
    pub ptr_latest: Option<PhaseTransitionRecord>,
    pub history: Vec<PhaseTransitionRecord>, // Append-only
}

impl VirtualFileSystem {
    pub fn new() -> Self {
        let mut distilled = HashMap::new();
        let mut abstracted = HashMap::new();
        for pole in [Pole::P, Pole::U, Pole::I, Pole::R] {
            distilled.insert(pole, HashMap::new());
            abstracted.insert(pole, HashMap::new());
        }

        Self {
            input: HashMap::new(),
            documentation: HashMap::new(),
            distilled,
            abstracted,
            sandboxes: HashMap::new(),
            braid: BraidTree {
                active_thread_id: None,
                threads: HashMap::new(),
            },
        }
    }

    /// THE LANDAUER TAX ENFORCER.
    /// This is the ONLY method that writes to the Braid tree. 
    /// It collapses the WorkingSurface into a committed PhaseTransitionRecord.
    pub fn write_ptr(&mut self, header: &StateHeader, surface: &WorkingSurface, action: ThreadAction, halt_reason: Option<String>) {
        let thread_id = format!("thread-{}", header.cycle); // Simplified ID generation
        
        // Ensure thread exists
        if !self.braid.threads.contains_key(&thread_id) {
            self.braid.threads.insert(thread_id.clone(), ThreadHistory {
                status: "active".to_string(),
                ptr_latest: None,
                history: Vec::new(),
            });
            self.braid.active_thread_id = Some(thread_id.clone());
        }

        // If SEVER, park the old active thread and initialize the new one
        if let ThreadAction::Sever = action {
            if let Some(old_active) = &self.braid.active_thread_id {
                if let Some(old_thread) = self.braid.threads.get_mut(old_active) {
                    old_thread.status = "parked".to_string();
                }
            }
            self.braid.active_thread_id = Some(thread_id.clone());
        }

        // Assemble the PTR with full slot states
        let mut surface_snapshot = HashMap::new();
        for (pole, slot) in &surface.slots {
            if let Some(content) = &slot.content {
                surface_snapshot.insert(*pole, SurfaceSlotSnapshot {
                    content: content.clone(),
                    state: slot.state,
                });
            }
        }

        let health = if let Some(reason) = halt_reason {
            format!("HALTED: {}", reason)
        } else if header.raises.0 > 0 {
            format!("raises: {}", header.raises.0)
        } else {
            "clear".to_string()
        };

        let ptr = PhaseTransitionRecord {
            thread_id: thread_id.clone(),
            thread_action: action,
            cycle: header.cycle,
            final_seq: header.seq,
            stance: header.stance.equation_name().to_string(),
            home_variable: header.stance.home(),
            operating_plane: header.plane,
            path_traversed: header.path.clone(),
            held_pole: header.stance.absent(),
            held_role: format!("{:?}", header.held_role).to_lowercase(),
            surface_snapshot,
            health,
        };

        // Commit to disk (in-memory representation)
        if let Some(thread) = self.braid.threads.get_mut(&thread_id) {
            thread.history.push(ptr.clone());
            thread.ptr_latest = Some(ptr);
        }
    }

    /// Reads the Braid context for the Intake Validator (Gate B).
    pub fn get_braid_context(&self) -> (Option<Stance>, Vec<u8>) {
        let active_id = match &self.braid.active_thread_id {
            Some(id) => id,
            None => return (None, (1..=12).collect()),
        };
        let thread = match self.braid.threads.get(active_id) {
            Some(t) => t,
            None => return (None, (1..=12).collect()),
        };
        let latest = match &thread.ptr_latest {
            Some(p) => p,
            None => return (None, (1..=12).collect()),
        };

        // Parse the stance name — accepts any of the three spec vocabularies.
        match crate::algebra::parse_stance_from_name(&latest.stance) {
            Ok(stance) => {
                let adjacencies = stance.viable_adjacencies();
                let legal_ids: Vec<u8> = adjacencies.iter().map(|s| s.facet_id()).collect();
                (Some(stance), legal_ids)
            }
            Err(_) => {
                // Latest PTR has an unparseable stance — treat as cold, don't crash.
                (None, (1..=12).collect())
            }
        }
    }

    /// Writes to a sandbox (Hold run). Strictly isolated from `/Project/Distilled/`.
    pub fn write_to_sandbox(&mut self, run_id: &str, filename: &str, content: &str) {
        let sandbox = self.sandboxes.entry(run_id.to_string()).or_insert_with(HashMap::new);
        sandbox.insert(filename.to_string(), content.to_string());
    }

    /// Serializes the entire VFS to a JSON string for the JS host to persist to OPFS/IndexedDB.
    pub fn serialize_for_js(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| "{}".to_string())
    }

    /// Deserializes the VFS from a JSON string provided by the JS host on initialization.
    pub fn deserialize_from_js(json_str: &str) -> Self {
        serde_json::from_str(json_str).unwrap_or_else(|_| Self::new())
    }
}
