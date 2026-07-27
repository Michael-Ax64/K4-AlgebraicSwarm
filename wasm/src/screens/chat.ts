// wasm/src/screens/chat.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { uiState, manualPrompt } from '../state';
import { processSubmission, submitLlmPaste } from '../bridge';
import { selectedCircuitId, activeCircuit,
         ledgerGrid, updateActiveCircuitDoc0 } from '../ledger/grid-state';
import { systemKindsGrid, resolveKindAlias } from '../kinds/kinds-registry';
import { h } from '../dom';


export function mountChatScreen(container: HTMLElement): () => void {
  const selectedKindKey = new Signal<string>('chat');
  const isWarm = new Signal<boolean>(false);

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 15px;' });
  container.appendChild(layout);

  const cId = selectedCircuitId.peek();
  const circ = activeCircuit.peek();

  if (!cId || !circ) {
    layout.appendChild(h('div', { 
      style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
      textContent: '🔒 Select a Circuit from the context graph to initialize Chat.'
    }));
    return () => { container.innerHTML = ''; };
  }

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
    checked: isWarm.value,
    style: 'cursor: pointer; transform: scale(1.1);',
    on: { change: (e: Event) => isWarm.value = (e.target as HTMLInputElement).checked }
  });

  const controlToolbar = h('div', { 
    style: 'display: flex; gap: 15px; align-items: center; background: var(--bg-panel); padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: 4px 4px 0 0;' 
  },
    h('label', { style: 'font-weight: bold; font-size: 0.8rem; color: var(--text-secondary);' }, 'System Flow: '),
    kindSelect,
    h('label', { style: 'font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;' }, warmCheck, ' warm continuation')
  );

  // 3. Draft Doc0 Prompt Input
  const doc0Input = h('textarea', {
    style: 'width: 100%; height: 75px; padding: 10px; resize: vertical; font-family: var(--font-mono); font-size: 0.9rem; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-strong); border-radius: 0 0 4px 4px;',
    value: circ.doc0 || '',
    placeholder: 'Compose prompt draft (doc0)...',
    on: { input: async (e: Event) => {
      const val = (e.target as HTMLTextAreaElement).value;
      await updateActiveCircuitDoc0(val);
    }}
  });

  const sendBtn = h('button', {
    textContent: 'Send →',
    className: 'k4-btn-primary',
    style: 'height: 40px; padding: 0 20px; font-weight: bold; align-self: flex-end; margin-top: 8px;',
    on: { click: async () => {
      await processSubmission(selectedKindKey.value, isWarm.value, doc0Input.value);
    }}
  });

  layout.append(logContainer, controlToolbar, doc0Input, sendBtn);

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

      const bubble = h('div', {
        style: `margin-bottom: 8px; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-subtle); background: ${isOut ? 'var(--bg-elevated)' : 'var(--bg-panel)'};`
      },
        h('div', { style: 'font-weight: bold; font-size: 0.75rem; color: var(--role-bridge); margin-bottom: 4px;' }, `[${isOut ? 'OUT' : 'IN'}] ${alias.toUpperCase()}`),
        h('div', { style: 'white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.85rem;', textContent: row.body })
      );

      logContainer.appendChild(bubble);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'chat', label: 'Chat', order: 101, mount: mountChatScreen });
