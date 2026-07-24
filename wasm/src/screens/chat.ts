// wasm/src/screens/chat.ts

import { createEffect } from '../reactive';
import { uiState, chatLog, workingSurface, braidHistory, currentRole, currentMode, draftQuery } from '../state';
import { processSubmission, processUserReply, submitLlmPaste, resetEngineRun } from '../bridge';
import { selectedViewId, viewsGrid } from '../ledger/grid-state';
import { screenRegistry } from './registry';
import { h } from '../dom';


export function mountChatScreen(container: HTMLElement): () => void {
    const layout = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
    container.appendChild(layout);

    createEffect(() => {
        const vId = selectedViewId.value;
        const circuit = viewsGrid.value.find(v => v.id === vId);
        
        layout.replaceChildren();

        // BOUNDARY LAYER ENFORCEMENT: Lock UI if no View is selected
        if (!vId) {
            layout.appendChild(h('div', { 
                style: { margin: 'auto', color: '#888', fontStyle: 'italic', padding: '20px', textAlign: 'center' },
                textContent: '🔒 UI LOCKED. Select an Active View (Cursor) from the left pane to initialize the Operations Console.'
            }));
            return;
        }

        const logContainer = h('div', { 
            style: { flex: '1', overflowY: 'auto', backgroundColor: '#1E1E1E', color: '#D4D4D4', padding: '15px', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid #444', borderRadius: '4px', marginBottom: '10px' }
        });

        const inputField = h('textarea', {
            style: { height: '80px', padding: '10px', resize: 'none', fontFamily: 'monospace', backgroundColor: '#2D2D2D', color: '#fff', border: '1px solid #555', borderRadius: '4px' },
            value: draftQuery.peek(),
            placeholder: 'Awaiting Operator Intent...',
            on: { input: (e) => draftQuery.value = (e.target as HTMLTextAreaElement).value }
        });

        const submitBtn = h('button', {
            textContent: 'EXECUTE [ENTER]',
            style: { padding: '10px 15px', backgroundColor: '#00ACC1', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }
        });

        const inputForm = h('form', { 
            style: { display: 'flex', gap: '10px', flex: '0 0 auto' },
            on: { submit: (e) => {
                e.preventDefault();
                const text = inputField.value.trim();
                if (!text) return;
                
                inputField.value = '';
                draftQuery.value = '';
                
                if (uiState.value === 'halted') resetEngineRun();
                else if (uiState.value === 'awaiting_llm_paste') submitLlmPaste(text);
                else if (uiState.value === 'awaiting_user') processUserReply(text);
                else processSubmission(text);
            }}
        }, inputField, submitBtn);

        // Append only the log and the form. The context banner is now handled globally by the shell.
        layout.append(logContainer, inputForm);

        // RENDER LOGS AS CONSOLE OUTPUT
        createEffect(() => {
            const logs = chatLog.value;
            logContainer.replaceChildren();
            logs.forEach(msg => {
                const row = h('div', { style: { marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' } });
                if (msg.role === 'user') {
                    row.appendChild(h('span', { style: { color: '#4CAF50', fontWeight: 'bold' }, textContent: 'operator> ' }));
                    row.appendChild(h('span', { textContent: msg.text }));
                } else if (msg.role === 'system') {
                    row.appendChild(h('span', { style: { color: '#00ACC1', fontWeight: 'bold' }, textContent: 'system> ' }));
                    row.appendChild(h('span', { style: { color: '#aaa' }, textContent: msg.text }));
                } else {
                    row.appendChild(h('span', { style: { color: '#F44336', fontWeight: 'bold' }, textContent: 'error> ' }));
                    row.appendChild(h('span', { style: { color: '#F44336' }, textContent: msg.text }));
                }
                logContainer.appendChild(row);
            });
            logContainer.scrollTop = logContainer.scrollHeight;
        });

        // HANDLE UI LOCK STATE
        createEffect(() => {
            const state = uiState.value;
            inputField.disabled = state === 'processing';
            submitBtn.disabled = state === 'processing';
            inputField.placeholder = state === 'processing' ? 'Computing topology...' : 'Enter Operator Intent...';
        });
    });

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({
  id: 'chat',
  label: 'Console',
  order: 120,
  mount: mountChatScreen 
});

