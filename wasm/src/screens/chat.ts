// wasm/src/screens/chat.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { uiState } from '../state';
import { processSubmission, submitLlmPaste, processUserReply, abortInFlight } from '../bridge';
import { selectedCircuitId, activeCircuit,
         ledgerGrid, updateActiveCircuitDoc0 } from '../ledger/grid-state';
import { systemKindsGrid, resolveKindAlias } from '../kinds/kinds-registry';
import { h } from '../dom';
import { registerWorldFrame } from '../ledger/world-frame-state';

// ─── TOP-LEVEL CHAT SCRATCH SIGNALS ──────────────────────────────
export const selectedChatKindKey = new Signal<string>('chat');
export const isChatWarm = new Signal<boolean>(false);

export interface ChatFrameScratch {
  kindKey: string;
  isWarm: boolean;
}

// ─── IoC FRAME ADAPTER REGISTRATION ──────────────────────────────
registerWorldFrame('chat', {
  getWorldState: (): ChatFrameScratch => ({
    kindKey: selectedChatKindKey.peek(),
    isWarm: isChatWarm.peek(),
  }),
  setWorldState: (raw: unknown) => {
    const state = raw as Partial<ChatFrameScratch>;
    if (state?.kindKey) selectedChatKindKey.value = state.kindKey;
    if (state?.isWarm !== undefined) isChatWarm.value = state.isWarm;
  }
});

export function mountChatScreen(container: HTMLElement): () => void {
  const selectedKindKey = selectedChatKindKey;
  const isWarm = isChatWarm;

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 15px;' });
  container.appendChild(layout);

  const cId = selectedCircuitId.peek()!;
  const circ = activeCircuit.peek()!;

  // 1. Transcript Log
  const logContainer = h('div', { 
    style: 'flex: 1; overflow-y: auto; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px; margin-bottom: 10px;'
  });

  // 2. Kind Selector Bar
  const kindSelect = h('select', {
    style: 'padding: 6px 10px; font-weight: bold; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px;',
    on: { change: (e: Event) => selectedKindKey.value = (e.target as HTMLSelectElement).value }
  });

  const warmCheck = h('input', {
    type: 'checkbox',
    style: 'cursor: pointer; transform: scale(1.1);',
    on: { 
      change: (e: Event) => { 
        isWarm.value = (e.target as HTMLInputElement).checked; 
      } 
    }
  }) as HTMLInputElement;

  createEffect(() => {
    warmCheck.checked = isWarm.value;
  });

  const warmToggleLabel = h('label', {
    style: 'font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; margin-left: auto;',
    on: {
      click: (e: Event) => {
        if (e.target !== warmCheck) {
          e.preventDefault();
          warmCheck.checked = !warmCheck.checked;
          isWarm.value = warmCheck.checked;
        }
      }
    }
  }, warmCheck, 'warm continuation');

  const controlToolbar = h('div', { 
    style: 'position: relative; z-index: 2; display: flex; gap: 15px; align-items: center; background: var(--bg-panel); padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: 4px 4px 0 0;' 
  },
    h('span', { style: 'font-weight: bold; font-size: 0.8rem; color: var(--text-secondary);' }, 'System Flow: '),
    kindSelect,
    warmToggleLabel
  );

  // 3. Draft Doc0 / Reply Input
  const doc0Input = h('textarea', {
    style: 'width: 100%; height: 75px; padding: 10px; resize: vertical; font-family: var(--font-mono); font-size: 0.9rem; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-strong); border-radius: 0 0 4px 4px;',
    value: circ.doc0 || '',
    placeholder: 'Compose prompt draft (doc0)...',
    on: { input: async (e: Event) => {
      if (uiState.value === 'idle' || uiState.value === 'halted') {
        const val = (e.target as HTMLTextAreaElement).value;
        await updateActiveCircuitDoc0(val);
      }
    }}
  });

  // 4. In-Flight Processing Banner (with timer & cancel button)
  const processingCard = h('div', {
    style: 'display: none; align-items: center; justify-content: space-between; background: var(--bg-panel); border: 1px solid var(--role-bridge); border-radius: 0 0 4px 4px; padding: 12px 16px; margin-bottom: 8px;'
  });

  const processingTimerLabel = h('span', {
    style: 'font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-primary);'
  });

  const cancelBtn = h('button', {
    textContent: '✕ Cancel Request',
    className: 'k4-btn-danger',
    style: 'font-size: 0.8rem; padding: 4px 10px;',
    on: { click: () => abortInFlight() }
  });

  processingCard.append(
    h('div', { style: 'display: flex; align-items: center; gap: 10px;' },
      h('span', { style: 'color: var(--role-bridge); font-weight: bold;', textContent: '⚡ Executing Intent...' }),
      processingTimerLabel
    ),
    cancelBtn
  );

  const sendBtn = h('button', {
    textContent: 'Send →',
    className: 'k4-btn-primary',
    style: 'height: 40px; padding: 0 20px; font-weight: bold; align-self: flex-end; margin-top: 8px;',
    on: { click: async () => {
      const text = (doc0Input as HTMLTextAreaElement).value.trim();
      if (!text) return;

      const state = uiState.value;
      try {
        if (state === 'awaiting_llm_paste') {
          await submitLlmPaste(text);
        } else if (state === 'awaiting_user') {
          await processUserReply(text);
        } else {
          await processSubmission(selectedKindKey.value, isWarm.value, text);
        }
        (doc0Input as HTMLTextAreaElement).value = '';
      } catch (err) {
        console.error('[chat] submit failed:', err);
      }
    }}
  });

  layout.append(logContainer, controlToolbar, doc0Input, processingCard, sendBtn);

  // Reactive UI state
  let timerInterval: any = null;
  let startTime = 0;

  createEffect(() => {
    const state = uiState.value;

    if (state === 'processing') {
      processingCard.style.display = 'flex';
      doc0Input.style.display = 'none';
      sendBtn.style.display = 'none';

      startTime = Date.now();
      processingTimerLabel.textContent = 'Elapsed: 00:00s';
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        const secs = Math.floor((Date.now() - startTime) / 1000);
        const mins = String(Math.floor(secs / 60)).padStart(2, '0');
        const remSecs = String(secs % 60).padStart(2, '0');
        processingTimerLabel.textContent = `Elapsed: ${mins}:${remSecs}s`;
      }, 1000);
    } else {
      clearInterval(timerInterval);
      processingCard.style.display = 'none';
      doc0Input.style.display = 'block';
      sendBtn.style.display = 'inline-block';
    }

    switch (state) {
      case 'awaiting_llm_paste':
        sendBtn.textContent      = 'Submit LLM Reply →';
        doc0Input.placeholder    = 'PASTE LLM OUTPUT HERE — the compiled prompt is in the transcript above.';
        (sendBtn as HTMLButtonElement).disabled = false;
        (doc0Input as HTMLTextAreaElement).disabled = false;
        break;
      case 'awaiting_user':
        sendBtn.textContent      = 'Send Reply →';
        doc0Input.placeholder    = 'Reply to the current role…';
        (sendBtn as HTMLButtonElement).disabled = false;
        (doc0Input as HTMLTextAreaElement).disabled = false;
        break;
      case 'processing':
        sendBtn.textContent      = 'Working…';
        (sendBtn as HTMLButtonElement).disabled = true;
        (doc0Input as HTMLTextAreaElement).disabled = true;
        break;
      case 'halted':
        sendBtn.textContent      = 'Send →';
        doc0Input.placeholder    = 'Run halted. Compose new intent…';
        (sendBtn as HTMLButtonElement).disabled = false;
        (doc0Input as HTMLTextAreaElement).disabled = false;
        break;
      case 'idle':
      default:
        sendBtn.textContent      = 'Send →';
        doc0Input.placeholder    = 'Compose prompt draft (doc0)…';
        (sendBtn as HTMLButtonElement).disabled = false;
        (doc0Input as HTMLTextAreaElement).disabled = false;
    }
  });

  // Populate System Kinds Dropdown
  createEffect(() => {
    const kinds = systemKindsGrid.value;
    kindSelect.replaceChildren();
    kinds.forEach(k => {
      kindSelect.appendChild(h('option', {
        value: k.key,
        textContent: `${k.alias} (${k.family})`,
        selected: k.key === selectedKindKey.value
      }));
    });
  });

  // Render Transcript History
  createEffect(() => {
    const rows = ledgerGrid.value;
    logContainer.replaceChildren();

    if (rows.length === 0) {
      logContainer.appendChild(h('div', {
        style: 'color: var(--text-muted); font-style: italic; text-align: center; padding: 30px;',
        textContent: 'No execution history for this Circuit yet. Compose doc0 and hit Send.'
      }));
      return;
    }

    rows.forEach(row => {
      const isOut = row.direction === 'out';
      const alias = resolveKindAlias(row.kind);

      const bubbleBg = isOut ? 'var(--bg-elevated)' : 'var(--bg-panel)';

      const headerRow = h('div', { 
        style: `
          position: sticky; 
          top: -20px; 
          z-index: 2; 
          background: ${bubbleBg}; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 8px 12px; 
          margin: -10px -12px 8px -12px; 
          border-bottom: 1px solid var(--border-subtle); 
          border-radius: 6px 6px 0 0;
        `.replace(/\s+/g, ' ')
      },
        h('span', { style: 'font-weight: bold; font-size: 0.75rem; color: var(--role-bridge);' }, `[${isOut ? 'OUT' : 'IN'}] ${alias.toUpperCase()}`),
        isOut ? h('button', {
          textContent: '📋 Copy',
          style: 'font-size: 0.7rem; padding: 2px 6px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 3px; cursor: pointer; color: var(--text-secondary);',
          on: { click: () => navigator.clipboard.writeText(row.body) }
        }) : h('span')
      );

      const bubble = h('div', {
        style: `margin-bottom: 8px; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-subtle); background: ${bubbleBg};`
      },
        headerRow,
        h('div', { style: 'white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.85rem;', textContent: row.body })
      );

      logContainer.appendChild(bubble);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  });

  return () => { 
    clearInterval(timerInterval);
    container.innerHTML = ''; 
  };
}

screenRegistry.register({ id: 'chat', label: 'Chat', order: 101, mount: mountChatScreen });

