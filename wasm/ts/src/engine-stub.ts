// wasm/ui/src/engine-stub.ts

import { CurrentRole, CurrentMode } from './state';

export class K4EngineStub {
  public current_role: CurrentRole = 'Validator';
  public current_mode: CurrentMode = 'cold';
  public vfs_state: string;

  constructor() {
    // Integrity Requirement 1: Must provide a valid JSON VfsShape
    // If this is undefined or malformed, syncEngineState() crashes.
    this.vfs_state = JSON.stringify({
      braid: {
        active_thread_id: null,
        threads: {}
      }
    });
  }

  load_vfs_state(json_str: string): void {
    if (json_str && json_str !== "{}") {
      this.vfs_state = json_str;
    }
  }

  set_domain_context(context: string): void {
    // No-op for the stub. Mimics the Wasm interface.
  }

  step(input: string): any {
    return this.mockResponse(input);
  }

  step_submission(doc0: string, corpus_json: string): any {
    return this.mockResponse(doc0);
  }

  private mockResponse(text: string): any {
    // Integrity Requirement 2: Must return a valid JsCommand
    // We return a Halt to safely break out of the bridge.ts while() loop.
    return {
      type: 'Halt',
      reason: '[WASM INTEGRITY STUB] The Rust engine is bypassed. Semantic OS UI test-frame active.'
    };
  }

  free(): void {
    // Wasm garbage collection mock
  }
}

// Mock the instantiation function exported by Wasm
export function create_engine_with_state(saved_vfs_json: string): K4EngineStub {
  const engine = new K4EngineStub();
  engine.load_vfs_state(saved_vfs_json);
  return engine;
}
