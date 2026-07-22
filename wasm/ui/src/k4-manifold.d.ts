// This mirrors what `wasm-pack build` would emit given the Rust in engine.rs.
// #[wasm_bindgen] on K4Engine plus getter/method attrs → this shape.
export type CurrentRole = "Validator" | "Bridge" | "Controller" | "Paradox";
export type CurrentMode = "cold" | "expect_llm" | "expect_user";

export class K4Engine {
  constructor();
  readonly vfs_state: string;      // #[wasm_bindgen(getter)] returning String
  readonly current_role: CurrentRole;  // which K4 instrument is in the loop
  readonly current_mode: CurrentMode;  // engine's expectation for the next step
  load_vfs_state(json_str: string): void;
  step(input: string): any;        // Rust returns JsValue → TS surfaces as any
  free(): void;                    // wasm-bindgen adds this on every class
}
export function create_engine_with_state(saved_vfs_json: string): K4Engine;
