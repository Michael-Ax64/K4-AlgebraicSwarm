// wasm/ts/src/bridge.ts

import {
    uiState, chatLog, engineHeader, workingSurface, braidHistory, activeThreadId,
    currentRole, currentMode, braidThreads, selectedThreadId, sandboxes, manualPrompt,
    Pole, SlotState, EngineHeader, SurfaceSlot, PtrSummary, HeldRole, ThreadShape
} from './state';

import { activeWorldConfig, getActiveVocabContext, corpusGrid } from './ledger/grid-state';
import { loadVfs, persistVfs } from './persistence';
import init, { create_engine_with_state } from './k4_manifold';

import { callBuiltInAPI } from './llm-client';

let engine: any;

async function bootAirlock() {
    try {
        await init();
        const savedVfs = await loadVfs();
        engine = create_engine_with_state(savedVfs);
        console.log("🟢 [Airlock] Rust K4 Engine coupled successfully.");
        syncEngineState();
    } catch (err) {
        console.warn("🟠 [Airlock] Wasm Engine unavailable. Booting Integrity Stub.", err);
        const stub = await import('./engine-stub');
        engine = stub.create_engine_with_state(await loadVfs());
        syncEngineState();
    }
}
bootAirlock();

// COLD START: Injects corpus and domain context
export async function processSubmission(doc0Text: string): Promise<void> {
    chatLog.value = [...chatLog.value, { role: 'user', text: doc0Text }];
    uiState.value = 'processing';

    const context = getActiveVocabContext();
    engine.set_domain_context(context);
    const docs = corpusGrid.value.map(d => [d.name, d.content]);
    const corpusJson = JSON.stringify(docs);

    let command = engine.step_submission(doc0Text, corpusJson);
    syncEngineState();
    await runEngineLoop(command);
}

// WARM CHAT BYPASS: Bypasses corpus injection for conversational continuity
export async function processUserReply(replyText: string): Promise<void> {
    chatLog.value = [...chatLog.value, { role: 'user', text: replyText }];
    uiState.value = 'processing';
    
    // Direct step without step_submission wrapper
    let command = engine.step(replyText);
    syncEngineState();
    await runEngineLoop(command);
}

export async function submitLlmPaste(llmResponseText: string): Promise<void> {
    chatLog.value = [...chatLog.value, { role: 'user', text: "(Pasted LLM Output)" }];
    uiState.value = 'processing';
    manualPrompt.value = '';

    const context = getActiveVocabContext();
    engine.set_domain_context(context);
    let command = engine.step(llmResponseText);
    syncEngineState();
    await runEngineLoop(command);
}

async function runEngineLoop(initialCommand: any) {
    let command = initialCommand;
    while (command) {
        switch (command.type) {
            case 'FetchLLM': {
                const config = activeWorldConfig.value;
                
                // 1. If explicitly manual, or no config, engage copy/paste
                if (!config || config.apiProvider === 'manual') {
                    manualPrompt.value = command.prompt;
                    uiState.value = 'awaiting_llm_paste';
                    return;
                }

                try {
                    // 2. Unified Cascade: API Key -> Built-in AI -> Throws to Manual
                    const llmResponse = await callBuiltInAPI(config, command.prompt);
                    command = engine.step(llmResponse);
                    syncEngineState();
                } catch (err) {
                    // 3. Fallback to manual if automated routes fail
                    chatLog.value = [...chatLog.value, { role: 'error', text: `API failed: ${err}. Falling back to manual.` }];
                    manualPrompt.value = command.prompt;
                    uiState.value = 'awaiting_llm_paste';
                    return;
                }
                break;
            }
            case 'AwaitUser':
                chatLog.value = [...chatLog.value, { role: 'system', text: command.text }];
                uiState.value = 'awaiting_user';
                return;
            case 'Halt':
                chatLog.value = [...chatLog.value, { role: 'error', text: `HALT: ${command.reason}` }];
                uiState.value = 'halted';
                return;
            case 'Success':
                chatLog.value = [...chatLog.value, { role: 'system', text: `Success: ${command.message}` }];
                uiState.value = 'idle';
                return;
            default:
                uiState.value = 'halted';
                return;
        }
    }
}

interface VfsShape {
    braid?: { active_thread_id: string | null; threads: Record<string, ThreadShape>; };
    sandboxes?: Record<string, Record<string, string>>;
}

function syncEngineState(): void {
    currentRole.value = engine.current_role;
    currentMode.value = engine.current_mode;
    const raw = engine.vfs_state;
    persistVfs(raw);

    let vfs: VfsShape;
    try {
        vfs = JSON.parse(raw) as VfsShape;
    } catch (err) {
        return;
    }

    const safeBraid = vfs.braid || { active_thread_id: null, threads: {} };
    const safeThreads = safeBraid.threads || {};
    sandboxes.value = vfs.sandboxes || {};
    braidThreads.value = safeThreads;
    activeThreadId.value = safeBraid.active_thread_id || null;

    if (!selectedThreadId.value && safeBraid.active_thread_id) {
        selectedThreadId.value = safeBraid.active_thread_id;
    }

    braidHistory.value = collectPtrs(vfs);

    const activeId = safeBraid.active_thread_id;
    const activeThread = activeId ? (safeThreads[activeId] || null) : null;
    const latest = activeThread?.ptr_latest ?? null;

    if (latest) {
        engineHeader.value = ptrToHeader(latest);
        workingSurface.value = snapshotToSlots(latest.surface_snapshot || {});
    } else {
        engineHeader.value = null;
        workingSurface.value = emptySurface();
    }
}

function ptrToHeader(ptr: any): EngineHeader {
    return {
        cycle: ptr.cycle, seq: ptr.final_seq, stance: ptr.stance, plane: ptr.operating_plane,
        path: ptr.path_traversed, heldPole: ptr.held_pole, heldRole: normalizeHeldRole(ptr.held_role), health: ptr.health,
    };
}
function normalizeHeldRole(raw: string): HeldRole { return raw?.toLowerCase() === 'material' ? 'material' : 'nil'; }
function snapshotToSlots(snapshot: Record<Pole, { content: string, state: SlotState }>): SurfaceSlot[] {
    return (['P', 'U', 'I', 'R'] as Pole[]).map(pole => ({ pole, content: snapshot[pole]?.content ?? null, state: snapshot[pole]?.state ?? 'Unwritten' }));
}
function emptySurface(): SurfaceSlot[] {
    return (['P', 'U', 'I', 'R'] as Pole[]).map(pole => ({ pole, content: null, state: 'Unwritten' as SlotState }));
}
function collectPtrs(vfs: VfsShape): PtrSummary[] {
    const out: PtrSummary[] = [];
    const safeBraid = vfs.braid || { threads: {} };
    const threads = safeBraid.threads || {};
    for (const thread of Object.values(threads)) {
        if (!thread || !thread.history) continue;
        for (const ptr of thread.history) {
            out.push({
                threadId: ptr.thread_id, action: ptr.thread_action, cycle: ptr.cycle, finalSeq: ptr.final_seq,
                stance: ptr.stance, plane: ptr.operating_plane, path: ptr.path_traversed, heldPole: ptr.held_pole,
                heldRole: normalizeHeldRole(ptr.held_role), health: ptr.health, surfaceSnapshot: ptr.surface_snapshot,
            });
        }
    }
    return out.sort((a, b) => a.cycle - b.cycle || a.finalSeq - b.finalSeq);
}
