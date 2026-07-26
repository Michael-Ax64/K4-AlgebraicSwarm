// wasm/src/screens/doc0.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { activeView, selectedViewId, updateActiveViewDoc0 } from '../ledger/grid-state';
import { processSubmission } from '../bridge';
import { pushScreen } from '../router';
import { h } from '../dom';

export function mountDoc0Screen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column;' });
  container.appendChild(layout);

  createEffect(() => {
    const view = activeView.value;
    const vId = selectedViewId.value;

    layout.replaceChildren();

    if (!vId || !view) {
      layout.appendChild(h('div', { 
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: '🔒 Select an Active View from the context graph.'
      }));
      return;
    }

    const doc0Area = h('textarea', {
      style: 'flex: 1; width: 100%; font-family: var(--font-mono); font-size: 0.95rem; padding: 15px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-strong); border-radius: 4px; resize: none; margin-bottom: 15px;',
      value: view.doc0,
      placeholder: 'Compose prompt draft (Document 0)...',
      on: { input: async (e: Event) => {
        const val = (e.target as HTMLTextAreaElement).value;
        await updateActiveViewDoc0(val);
      }}
    });

    const executeBtn = h('button', {
      textContent: 'EXECUTE INTENT [ENTER]',
      className: 'k4-btn-primary',
      style: 'align-self: flex-end; padding: 10px 20px; font-weight: bold;',
      on: { click: async () => {
        const text = doc0Area.value.trim();
        if (!text) return;
        await processSubmission('chat', false, text);
        pushScreen('chat');
      }}
    });

    const wordCount = h('span', {
      style: 'color: var(--text-muted); font-size: 0.85rem; font-family: var(--font-mono);',
      textContent: `Length: ${view.doc0.length} chars | Words: ${view.doc0.trim().split(/\s+/).filter(Boolean).length}`
    });

    const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 15px;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: 'doc0 Composition Draft' }),
      wordCount
    );

    layout.append(header, doc0Area, executeBtn);
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'doc0', label: 'doc0', order: 104, mount: mountDoc0Screen });

