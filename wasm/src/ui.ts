// wasm/ui/src/ui.ts

// ANTI-RELOAD: Catch all submits globally before any script crashes
window.addEventListener('submit', (e) => e.preventDefault(), { capture: true });


import { createEffect } from './reactive';
import {
    uiState, chatLog, engineHeader, workingSurface, braidHistory, activeThreadId,
    currentRole, currentMode, braidThreads, selectedThreadId, sandboxes, manualPrompt,
    UIState, CurrentRole, manifoldLog
} from './state';

import { submitLlmPaste, processSubmission, processUserReply } from './bridge';
import { clearVfs } from './persistence';

function bootMonolithicUI() {
    function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
        const el = document.getElementById(id);
        if (!el) {
            throw new Error(`[UI FATAL] Missing DOM id: #${id}`);
        }
        return el as T;
    }

    try {
        const chatContainer   = requireEl('chat-log');
        const inputForm       = requireEl<HTMLFormElement>('input-form');
        const inputField      = requireEl<HTMLTextAreaElement>('user-input');
        const submitBtn       = requireEl<HTMLButtonElement>('submit-btn');
        const resetBtn        = requireEl<HTMLButtonElement>('reset-btn');
        const statusStrip     = requireEl('status-strip');
        const roleBadge       = requireEl('role-badge');
        const surfacePanel    = requireEl('working-surface');
        const braidPanel      = requireEl('braid-history');
        const threadIndicator = requireEl('thread-indicator');
        const promptWorkspace = requireEl('prompt-workspace');
        const promptTextarea  = requireEl<HTMLTextAreaElement>('prompt-workspace-text');
        const copyPromptBtn   = requireEl<HTMLButtonElement>('copy-prompt-btn');
        const threadSelect    = requireEl<HTMLSelectElement>('thread-select');
        const sandboxPanel    = requireEl('sandbox-panel');

        const awaitPlaceholders: Record<CurrentRole, string> = {
            Validator:  'Reply to the Validator…',
            Bridge:     "Reply to the Bridge's articulation…",
            Controller: 'Reply to the Controller…',
            Paradox:    'Which of these is bearing weight?',
        };

        const placeholders = (role: CurrentRole): Record<UIState, string> => ({
            idle:               'Enter your intent or Document 0…',
            processing:         'Computing topology…',
            awaiting_user:      awaitPlaceholders[role],
            awaiting_llm_paste: 'PASTE LLM OUTPUT HERE...',
            halted:             'Run halted. Reset to continue.',
        });

        createEffect(() => {
            const messages = chatLog.value;
            chatContainer.replaceChildren(...messages.map(msg => {
                const div = document.createElement('div');
                div.className = `msg msg-${msg.role}`;
                if (msg.role === 'prompt_to_copy') {
                    const header = document.createElement('div');
                    header.className = 'prompt-header';
                    header.innerHTML = `<strong>⚠️ MANUAL MODE: COPY PROMPT</strong><br>Run this in your LLM and paste the output below.`;
                    const pre = document.createElement('pre');
                    pre.textContent = msg.text;
                    const copyBtn = document.createElement('button');
                    copyBtn.textContent = 'Copy to Clipboard';
                    copyBtn.onclick = () => navigator.clipboard.writeText(msg.text);
                    div.appendChild(header);
                    div.appendChild(pre);
                    div.appendChild(copyBtn);
                } else {
                    div.textContent = msg.text;
                }
                return div;
            }));
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });

        inputForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = inputField.value.trim();
            if (!text) return;

            // DO NOT clear the input field yet. Protect the operator's intent!
            
            const handleSuccess = () => { inputField.value = ''; };
            const handleError = (err: any) => {
                console.error('[BRIDGE] Submission threw:', err);
                chatLog.value = [...chatLog.value, { role: 'error', text: `System: ${err.message ?? err}` }];
                manifoldLog.value = [...manifoldLog.value, {
                    id: crypto.randomUUID(), ts: Date.now(), source: 'bridge', type: 'error', message: `Submission failed: ${err.message}`
                }];
                uiState.value = 'idle';
            };

            if (uiState.value === 'awaiting_llm_paste') {
                submitLlmPaste(text).then(handleSuccess).catch(handleError);
            } else if (uiState.value === 'awaiting_user') {
                processUserReply(text).then(handleSuccess).catch(handleError);
            } else {
                processSubmission(text).then(handleSuccess).catch(handleError);
            }
        });

        createEffect(() => {
            const state = uiState.value;
            const role  = currentRole.value;
            inputField.disabled = state === 'processing';
            submitBtn.disabled  = state === 'processing' || state === 'halted';
            inputField.placeholder = placeholders(role)[state];
            if (state === 'awaiting_user') inputField.focus();
        });

        createEffect(() => {
            const role = currentRole.value;
            const mode = currentMode.value;
            roleBadge.dataset.role = role.toLowerCase();
            roleBadge.dataset.mode = mode;
            roleBadge.textContent = mode === 'cold'
                ? 'cold'
                : `${role.toLowerCase()} · ${mode === 'expect_llm' ? 'thinking' : 'awaiting reply'}`;
        });

        createEffect(() => {
            const h   = engineHeader.value;
            const tid = activeThreadId.value;
            threadIndicator.textContent = tid ?? 'no active thread';
            if (!h) {
                statusStrip.textContent = 'cold · no PTR committed yet';
                statusStrip.dataset.health = 'cold';
                return;
            }
            const healthKind = h.health.startsWith('HALTED') ? 'halted'
                : h.health.startsWith('raises') ? 'raises'
                    : 'clear';
            statusStrip.dataset.health = healthKind;
            
            function field(label: string, value: string): HTMLElement {
                const span = document.createElement('span');
                span.className = `field field-${label}`;
                const em = document.createElement('em');
                em.textContent = label;
                span.appendChild(em);
                span.appendChild(document.createTextNode(' ' + value));
                return span;
            }

            statusStrip.replaceChildren(
                field('cycle',  `#${h.cycle}·${h.seq}`),
                field('stance', h.stance),
                field('plane',  `${h.plane}-face`),
                field('path',   h.path.join('→')),
                field('held',   `${h.heldPole}=${h.heldRole}`),
                field('health', h.health),
            );
        });

        createEffect(() => {
            const slots = workingSurface.value;
            surfacePanel.replaceChildren(...slots.map(slot => {
                const cell = document.createElement('div');
                cell.className = `slot slot-${slot.pole} state-${slot.state}`;
                const label = document.createElement('div');
                label.className = 'slot-label';
                label.textContent = `${slot.pole} · ${slot.state}`;
                const body = document.createElement('div');
                body.className = 'slot-body';
                body.textContent = slot.content ?? '(unwritten)';
                cell.appendChild(label);
                cell.appendChild(body);
                return cell;
            }));
        });

        createEffect(() => {
            const threads    = braidThreads.value;
            const activeId   = activeThreadId.value;
            const selectedId = selectedThreadId.value;
            threadSelect.replaceChildren();
            const keys = Object.keys(threads);
            if (keys.length === 0) {
                const opt = document.createElement('option');
                opt.textContent = 'No threads';
                threadSelect.appendChild(opt);
                return;
            }
            keys.forEach(id => {
                const thread = threads[id];
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = `${id.substring(0, 8)}... (${thread.status})`;
                if (id === (selectedId || activeId)) opt.selected = true;
                threadSelect.appendChild(opt);
            });
        });

        threadSelect.addEventListener('change', (e) => {
            selectedThreadId.value = (e.target as HTMLSelectElement).value;
        });

        createEffect(() => {
            const ptrs  = braidHistory.value;
            const selId = selectedThreadId.value;
            const filteredPtrs = selId ? ptrs.filter(p => p.threadId === selId) : ptrs;
            if (filteredPtrs.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'braid-empty';
                empty.textContent = 'No committed PTRs yet.';
                braidPanel.replaceChildren(empty);
                return;
            }
            
            function shortenStance(stance: string): string {
                const paren = stance.indexOf(' (');
                return paren === -1 ? stance : stance.slice(0, paren);
            }

            braidPanel.replaceChildren(...filteredPtrs.map(ptr => {
                const row = document.createElement('div');
                const healthKind = ptr.health.startsWith('HALTED') ? 'halted'
                    : ptr.health.startsWith('raises') ? 'raises'
                        : 'clear';
                row.className = `ptr action-${ptr.action.toLowerCase()} health-${healthKind}`;
                row.title = `${ptr.threadId} · ${ptr.stance} · ${ptr.health}`;
                const cyc = document.createElement('span');
                cyc.className = 'ptr-cycle';
                cyc.textContent = `#${ptr.cycle}`;
                const stance = document.createElement('span');
                stance.className = 'ptr-stance';
                stance.textContent = shortenStance(ptr.stance);
                const geom = document.createElement('span');
                geom.className = 'ptr-geom';
                geom.textContent = `${ptr.plane}·${ptr.path.join('')}`;
                const health = document.createElement('span');
                health.className = 'ptr-health';
                health.textContent = ptr.health;
                row.append(cyc, stance, geom, health);
                return row;
            }));
        });

        createEffect(() => {
            if (uiState.value === 'awaiting_llm_paste') {
                promptWorkspace.style.display = 'block';
                promptTextarea.value = manualPrompt.value;
            } else {
                promptWorkspace.style.display = 'none';
            }
        });

        copyPromptBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(manualPrompt.value);
            copyPromptBtn.textContent = 'Copied!';
            setTimeout(() => copyPromptBtn.textContent = 'Copy Prompt', 2000);
        });

        createEffect(() => {
            const boxes = sandboxes.value;
            const keys  = Object.keys(boxes);
            if (keys.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty';
                empty.textContent = 'No quarantined Hold-run sandboxes.';
                sandboxPanel.replaceChildren(empty);
                return;
            }
            sandboxPanel.replaceChildren();
            keys.forEach(runId => {
                const files = boxes[runId];
                const details = document.createElement('details');
                details.className = 'sandbox-run';
                const summary = document.createElement('summary');
                summary.textContent = `📦 ${runId} (${Object.keys(files).length} files)`;
                details.appendChild(summary);
                for (const [filename, content] of Object.entries(files)) {
                    const fileDiv = document.createElement('div');
                    fileDiv.className = 'sandbox-file';
                    const strong = document.createElement('strong');
                    strong.textContent = filename;
                    const pre = document.createElement('pre');
                    pre.textContent = content;
                    fileDiv.appendChild(strong);
                    fileDiv.appendChild(pre);
                    details.appendChild(fileDiv);
                }
                sandboxPanel.appendChild(details);
            });
        });

        resetBtn.addEventListener('click', async () => {
            if (!confirm('Clear the engine snapshot and reload?')) return;
            await clearVfs();
            location.reload();
        });

    } catch (err: any) {
        console.error('Monolithic UI boot aborted:', err);
        // We log to the manifold array so when the new Manifold screen mounts, the crash is visible
        manifoldLog.value = [...manifoldLog.value, {
            id: crypto.randomUUID(), ts: Date.now(), source: 'system', type: 'error', message: err.message || String(err)
        }];
    }
}

// Execute safely
bootMonolithicUI();
