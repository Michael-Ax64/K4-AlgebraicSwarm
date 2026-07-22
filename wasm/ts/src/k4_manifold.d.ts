/* tslint:disable */
/* eslint-disable */

export class K4Engine {
    free(): void;
    [Symbol.dispose](): void;
    load_vfs_state(json_str: string): void;
    constructor();
    set_domain_context(context: string): void;
    step(input: string): any;
    step_submission(doc0: string, corpus_json: string): any;
    readonly current_mode: string;
    readonly current_role: string;
    readonly vfs_state: string;
}

export function create_engine_with_state(saved_vfs_json: string): K4Engine;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_k4engine_free: (a: number, b: number) => void;
    readonly k4engine_current_mode: (a: number) => [number, number];
    readonly k4engine_current_role: (a: number) => [number, number];
    readonly k4engine_load_vfs_state: (a: number, b: number, c: number) => void;
    readonly k4engine_new: () => number;
    readonly k4engine_set_domain_context: (a: number, b: number, c: number) => void;
    readonly k4engine_step: (a: number, b: number, c: number) => any;
    readonly k4engine_step_submission: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly k4engine_vfs_state: (a: number) => [number, number];
    readonly create_engine_with_state: (a: number, b: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
