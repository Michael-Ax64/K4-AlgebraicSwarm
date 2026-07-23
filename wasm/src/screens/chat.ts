// wasm/src/screens/chat.ts

import { createEffect } from '../reactive';
import {
    uiState, chatLog, engineHeader, workingSurface, braidHistory, activeThreadId,
    currentRole, currentMode, braidThreads, selectedThreadId, sandboxes, manualPrompt,
    manifoldLog, lastQuery, draftQuery, UIState, CurrentRole
} from '../state';

import { submitLlmPaste, processSubmission, processUserReply } from '../bridge';
import { clearVfs } from '../persistence';
import { screenRegistry } from './registry';


export function mountChatScreen(container: HTMLElement): () => void {
    const layout = document.createElement('div');
    layout.style.display = 'flex';
    layout.style.flexDirection = 'column';
    layout.style.height = '100%';
    
    // Global Header with Zoom Controls
    layout.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px; flex: 0 0 auto;">
            <h2 style="margin: 0; color: #14161A;">Operations & Intents</h2>
            <div style="display: flex; gap: 5px;">
                <button id="zoom-out" style="padding: 4px 12px; cursor: pointer; font-weight: bold; border: 1px solid #ccc; background: #fff; border-radius: 4px;">-</button>
                <button id="zoom-reset" style="padding: 4px 12px; cursor: pointer; font-weight: bold; border: 1px solid #ccc; background: #fff; border-radius: 4px;">=</button>
                <button id="zoom-in" style="padding: 4px 12px; cursor: pointer; font-weight: bold; border: 1px solid #ccc; background: #fff; border-radius: 4px;">+</button>
            </div>
        </div>

        <div id="chat-zoom-container" style="display: flex; flex-direction: row; gap: 20px; flex: 1; min-height: 0; font-size: 1rem; transition: font-size 0.2s ease;">
            <div class="k4-chat-col" style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                <div id="chat-log" style="flex: 1; overflow-y: auto; border: 1px solid #DAD5CB; background: #fff; border-radius: 6px; padding: 15px; margin-bottom: 15px; display: flex; flex-direction: column; gap: 10px;"></div>
                
                <div id="prompt-workspace" class="prompt-workspace" style="display:none; margin-bottom: 10px;">
                    <strong>Manual Mode Prompt:</strong><br>
                    <textarea id="prompt-workspace-text" readonly style="width: 100%; height: 80px; font-family: monospace; font-size: 0.85em;"></textarea>
                    <button id="copy-prompt-btn" style="padding: 6px 12px; background: #14161A; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Copy Prompt</button>
                </div>
                
                <form id="input-form" style="display: flex; flex-direction: column; gap: 10px; flex: 0 0 auto;">
                    <textarea id="user-input" placeholder="Enter your intent..." style="height: 80px; padding: 10px; resize: none; border: 1px solid #DAD5CB; border-radius: 6px; font-family: inherit; font-size: inherit;"></textarea>
                    <button id="submit-btn" type="submit" style="background: #14161A; color: #fff; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: inherit;">Submit</button>
                </form>
            </div>

            <div class="k4-state-col" style="flex: 0 0 320px; display: flex; flex-direction: column; overflow-y: auto; background: #FAFAFA; border: 1px solid #DAD5CB; border-radius: 6px; padding: 15px;">
                <div id="role-badge" style="padding: 8px; background: #14161A; color: #fff; border-radius: 4px; font-weight: bold; text-align: center; margin-bottom: 10px; font-size: 0.9em;"></div>
                <div id="status-strip" style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.8em; background: #eee; padding: 8px; border-radius: 4px; margin-bottom: 20px;"></div>
                
                <h4 style="margin: 0 0 10px 0; color: #555;">Working Surface</h4>
                <div id="working-surface" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;"></div>
                
                <h4 style="margin: 0 0 10px 0; color: #555;">Braid History</h4>
                <div style="display: flex; gap: 5px; margin-bottom: 10px; font-size: 0.85em;">
                    <select id="thread-select" style="flex: 1; padding: 4px; font-size: inherit;"></select>
                </div>
                <div id="braid-history" style="flex: 1; overflow-y: auto; font-size: 0.85em; border: 1px solid #eee; padding: 8px; background: #fff; border-radius: 4px; display: flex; flex-direction: column; gap: 4px;"></div>
                
                <button id="reset-btn" style="background: #d32f2f; color: #fff; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 15px; font-size: 0.9em;">Reset Engine VFS</button>
            </div>
        </div>
    `;
    container.appendChild(layout);

    function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
        const el = layout.querySelector(`#${id}`);
        if (!el) throw new Error(`[UI FATAL] Missing DOM id: #${id} in Chat Screen`);
        return el as T;
    }

    const zoomContainer   = requireEl('chat-zoom-container');
    const btnZoomOut      = requireEl<HTMLButtonElement>('zoom-out');
    const btnZoomReset    = requireEl<HTMLButtonElement>('zoom-reset');
    const btnZoomIn       = requireEl<HTMLButtonElement>('zoom-in');

    const chatContainer   = requireEl('chat-log');
    const inputForm       = requireEl<HTMLFormElement>('input-form');
    const inputField      = requireEl<HTMLTextAreaElement>('user-input');
    const submitBtn       = requireEl<HTMLButtonElement>('submit-btn');
    const resetBtn        = requireEl<HTMLButtonElement>('reset-btn');
    const statusStrip     = requireEl('status-strip');
    const roleBadge       = requireEl('role-badge');
    const surfacePanel    = requireEl('working-surface');
    const braidPanel      = requireEl('braid-history');
    const promptWorkspace = requireEl('prompt-workspace');
    const promptTextarea  = requireEl<HTMLTextAreaElement>('prompt-workspace-text');
    const copyPromptBtn   = requireEl<HTMLButtonElement>('copy-prompt-btn');
    const threadSelect    = requireEl<HTMLSelectElement>('thread-select');

    // Zoom Logic
    let currentZoom = 1.0;
    btnZoomOut.onclick = () => { currentZoom = Math.max(0.6, currentZoom - 0.1); zoomContainer.style.fontSize = `${currentZoom}rem`; };
    btnZoomIn.onclick = () => { currentZoom = Math.min(2.0, currentZoom + 0.1); zoomContainer.style.fontSize = `${currentZoom}rem`; };
    btnZoomReset.onclick = () => { currentZoom = 1.0; zoomContainer.style.fontSize = `1rem`; };

    // FIX: Use .peek() to safely restore unfinished input on mount without capturing the Router's effect!
    inputField.value = draftQuery.peek();
    inputField.addEventListener('input', () => {
        draftQuery.value = inputField.value;
    });

    function renderHeldParadoxes(text: string): HTMLElement {
        const root = document.createElement('div');
        root.className = 'held-paradoxes-root';

        try {
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
            if (!jsonMatch) throw new Error("No JSON found");
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            
            const grid = document.createElement('div');
            grid.className = 'paradox-grid';

            const poles = ['P', 'U', 'I', 'R'];
            
            poles.forEach(facePole => {
                const stances = (parsed.stances || []).filter((s: any) => s.home === facePole);
                if (stances.length === 0) return;

                const faceHeader = document.createElement('div');
                faceHeader.className = 'paradox-face-header';
                faceHeader.textContent = `FACE: ${facePole}`;
                grid.appendChild(faceHeader);

                const faceRow = document.createElement('div');
                faceRow.className = 'paradox-face-row';

                stances.forEach((stance: any) => {
                    const card = document.createElement('div');
                    card.className = 'paradox-card';
                    card.innerHTML = `
                        <div class="paradox-name">${stance.name}</div>
                        <div class="paradox-meta">Held: ${stance.absent} | ${stance.eq}</div>
                        <div class="paradox-tension">${stance.tension}</div>
                    `;
                    card.onclick = () => {
                        // Safe to use .value here because it's inside a click handler (no active effect)
                        const newQuery = `${lastQuery.value}\n\n// Anchor: ${stance.name} (${stance.eq})\n${stance.tension}`;
                        inputField.value = newQuery;
                        draftQuery.value = newQuery;
                        inputField.focus();
                    };
                    faceRow.appendChild(card);
                });
                grid.appendChild(faceRow);
            });
            root.appendChild(grid);
        } catch (e) {
            const errDiv = document.createElement('div');
            errDiv.textContent = `[Failed to parse 12-fold JSON: ${e}]`;
            errDiv.className = 'msg-block msg-error wide';
            root.appendChild(errDiv);
        }
        return root;
    }

    createEffect(() => {
        const messages = chatLog.value;
        chatContainer.replaceChildren(...messages.map(msg => {
            const div = document.createElement('div');
            div.className = `msg-block msg-${msg.role}`;
            
            if (msg.role === 'prompt_to_copy') {
                div.innerHTML = `<strong>⚠️ MANUAL MODE: COPY PROMPT</strong><br>Run this in your LLM and paste the output below.<br><br>`;
                const pre = document.createElement('pre');
                pre.textContent = msg.text;
                pre.style.whiteSpace = 'pre-wrap';
                pre.style.fontFamily = 'monospace';
                pre.style.fontSize = '0.85em';
                
                const copyBtn = document.createElement('button');
                copyBtn.textContent = 'Copy to Clipboard';
                copyBtn.style.padding = '6px 12px';
                copyBtn.style.cursor = 'pointer';
                copyBtn.onclick = () => navigator.clipboard.writeText(msg.text);
                
                div.appendChild(pre);
                div.appendChild(copyBtn);
            } else if (msg.role === 'system' && msg.text.trimStart().startsWith('# HELD PARADOXES')) {
                div.appendChild(renderHeldParadoxes(msg.text));
                div.classList.add('wide'); 
            } else {
                const prefix = document.createElement('strong');
                prefix.textContent = msg.role.toUpperCase() + ": \n";
                div.appendChild(prefix);
                
                const content = document.createElement('div');
                content.textContent = msg.text;
                content.style.whiteSpace = 'pre-wrap';
                div.appendChild(content);
            }
            return div;
        }));
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });

    inputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = inputField.value.trim();
        if (!text) return;

        const handleSuccess = () => { 
            inputField.value = ''; 
            draftQuery.value = ''; 
        };
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
        
        const awaitPlaceholders: Record<CurrentRole, string> = {
            Validator:  'Reply to the Validator…',
            Bridge:     "Reply to the Bridge's articulation…",
            Controller: 'Reply to the Controller…',
            Paradox:    'Which of these is bearing weight? (Click a card above or type here)',
        };
        const placeholders = (role: CurrentRole): Record<UIState, string> => ({
            idle:               'Enter your intent or Document 0…',
            processing:         'Computing topology…',
            awaiting_user:      awaitPlaceholders[role],
            awaiting_llm_paste: 'PASTE LLM OUTPUT HERE...',
            halted:             'Run halted. Reset to continue.',
        });
        
        inputField.placeholder = placeholders(role)[state];
        if (state === 'awaiting_user') inputField.focus();
    });

    createEffect(() => {
        const role = currentRole.value;
        const mode = currentMode.value;
        roleBadge.textContent = mode === 'cold' ? 'cold' : `${role.toUpperCase()} · ${mode === 'expect_llm' ? 'thinking' : 'awaiting reply'}`;
    });

    createEffect(() => {
        const h = engineHeader.value;
        if (!h) {
            statusStrip.innerHTML = '<span style="color:#888;">cold · no PTR committed yet</span>';
            return;
        }
        statusStrip.innerHTML = `
            <div><em style="color:#888;">cycle:</em> #${h.cycle}·${h.seq}</div>
            <div><em style="color:#888;">stance:</em> ${h.stance}</div>
            <div><em style="color:#888;">plane:</em> ${h.plane}-face</div>
            <div><em style="color:#888;">path:</em> ${h.path.join('→')}</div>
            <div><em style="color:#888;">held:</em> ${h.heldPole}=${h.heldRole}</div>
            <div><em style="color:#888;">health:</em> <strong style="color:${h.health.startsWith('HALT') ? '#c62828' : '#2e7d32'}">${h.health}</strong></div>
        `;
    });

    createEffect(() => {
        const slots = workingSurface.value;
        surfacePanel.replaceChildren(...slots.map(slot => {
            const cell = document.createElement('div');
            cell.style.border = '1px solid #ccc';
            cell.style.padding = '8px';
            cell.style.borderRadius = '4px';
            cell.style.fontSize = '0.85em';
            cell.style.background = '#fff';
            cell.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 4px; color: #555;">${slot.pole} · ${slot.state}</div>
                <div style="color: #111;">${slot.content ?? '(unwritten)'}</div>
            `;
            return cell;
        }));
    });

    createEffect(() => {
        const threads = braidThreads.value;
        const activeId = activeThreadId.value;
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
        const ptrs = braidHistory.value;
        const selId = selectedThreadId.value;
        const filteredPtrs = selId ? ptrs.filter(p => p.threadId === selId) : ptrs;
        if (filteredPtrs.length === 0) {
            braidPanel.textContent = 'No committed PTRs yet.';
            return;
        }
        
        braidPanel.replaceChildren(...filteredPtrs.map(ptr => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.borderBottom = '1px solid #f4f4f4';
            row.style.padding = '4px 0';
            
            const healthColor = ptr.health.startsWith('HALTED') ? '#c62828' : ptr.health.startsWith('raises') ? '#f57c00' : '#2e7d32';
            const stanceShort = ptr.stance.indexOf(' (') === -1 ? ptr.stance : ptr.stance.slice(0, ptr.stance.indexOf(' ('));
            
            row.innerHTML = `
                <span style="font-weight:bold; color:#555; width:30px;">#${ptr.cycle}</span>
                <span style="flex:1;">${stanceShort}</span>
                <span style="font-family:monospace; color:#888;">${ptr.plane}·${ptr.path.join('')}</span>
                <span style="color:${healthColor}; font-weight:500;">${ptr.health}</span>
            `;
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

    resetBtn.addEventListener('click', async () => {
        if (!confirm('Clear the engine snapshot and reload?')) return;
        await clearVfs();
        location.reload();
    });

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({
    id: 'chat',
    label: 'Operations & Intents',
    order: 10,
    mount: mountChatScreen
});
