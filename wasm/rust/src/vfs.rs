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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ManifestDoc {
    pub id: String,
    pub name: String,
    pub content: String,
    pub poles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ManifestVocab {
    pub term: String,
    pub k4_type: String,
    pub role: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedManifest {
    pub view_id: String,
    pub doc0: String,
    pub kind: String,
    pub warm: bool,
    pub documents: Vec<ManifestDoc>,
    pub vocabulary: Vec<ManifestVocab>,
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

    /// Hydrates internal VirtualFileSystem maps from the structured LedgerVFS manifest.
    pub fn hydrate_from_manifest(&mut self, manifest: &ResolvedManifest) {
        self.documentation.clear();
        for pole in [Pole::P, Pole::U, Pole::I, Pole::R] {
            if let Some(map) = self.distilled.get_mut(&pole) { map.clear(); }
            if let Some(map) = self.abstracted.get_mut(&pole) { map.clear(); }
        }

        for doc in &manifest.documents {
            for pole_str in &doc.poles {
                match pole_str.as_str() {
                    "A" => { self.documentation.insert(doc.name.clone(), doc.content.clone()); }
                    "P" => { self.distilled.get_mut(&Pole::P).unwrap().insert(doc.name.clone(), doc.content.clone()); }
                    "U" => { self.distilled.get_mut(&Pole::U).unwrap().insert(doc.name.clone(), doc.content.clone()); }
                    "I" => { self.distilled.get_mut(&Pole::I).unwrap().insert(doc.name.clone(), doc.content.clone()); }
                    "R" => { self.distilled.get_mut(&Pole::R).unwrap().insert(doc.name.clone(), doc.content.clone()); }
                    _ => {}
                }
            }
        }
    }

    /// THE LANDAUER TAX ENFORCER.
    pub fn write_ptr(&mut self, header: &StateHeader, surface: &WorkingSurface, action: ThreadAction, halt_reason: Option<String>) {
        let thread_id = format!("thread-{}", header.cycle);
        
        if !self.braid.threads.contains_key(&thread_id) {
            self.braid.threads.insert(thread_id.clone(), ThreadHistory {
                status: "active".to_string(),
                ptr_latest: None,
                history: Vec::new(),
            });
            self.braid.active_thread_id = Some(thread_id.clone());
        }

        if let ThreadAction::Sever = action {
            if let Some(old_active) = &self.braid.active_thread_id {
                if let Some(old_thread) = self.braid.threads.get_mut(old_active) {
                    old_thread.status = "parked".to_string();
                }
            }
            self.braid.active_thread_id = Some(thread_id.clone());
        }

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

        if let Some(thread) = self.braid.threads.get_mut(&thread_id) {
            thread.history.push(ptr.clone());
            thread.ptr_latest = Some(ptr);
        }
    }

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

        match crate::algebra::parse_stance_from_name(&latest.stance) {
            Ok(stance) => {
                let adjacencies = stance.viable_adjacencies();
                let legal_ids: Vec<u8> = adjacencies.iter().map(|s| s.facet_id()).collect();
                (Some(stance), legal_ids)
            }
            Err(_) => (None, (1..=12).collect())
        }
    }

    pub fn write_to_sandbox(&mut self, run_id: &str, filename: &str, content: &str) {
        let sandbox = self.sandboxes.entry(run_id.to_string()).or_insert_with(HashMap::new);
        sandbox.insert(filename.to_string(), content.to_string());
    }

    pub fn serialize_for_js(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn deserialize_from_js(json_str: &str) -> Self {
        serde_json::from_str(json_str).unwrap_or_else(|_| Self::new())
    }
}

