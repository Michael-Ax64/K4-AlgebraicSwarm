use wasm_bindgen::prelude::*;

pub mod algebra;
pub mod state;
pub mod parser;
pub mod engine;
pub mod vfs;

use engine::K4Engine;

#[wasm_bindgen]
pub fn create_engine_with_state(saved_vfs_json: &str) -> K4Engine {
    let mut engine = K4Engine::new();
    if !saved_vfs_json.is_empty() {
        engine.load_vfs_state(saved_vfs_json);
    }
    engine
}
