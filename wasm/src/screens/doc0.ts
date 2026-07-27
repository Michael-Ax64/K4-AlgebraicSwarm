// wasm/src/screens/doc0.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { activeCircuit, selectedCircuitId, updateActiveCircuitDoc0 } from '../ledger/grid-state';
import { processSubmission } from '../bridge';
import { pushScreen } from '../router';
import { h } from '../dom';

export function mountDoc0Screen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column;' });
  container.appendChild(layout);

  let currentRenderedCircuitId: string | null = null;
  let doc0Area: HTMLTextAreaElement | null = null;
  let wordCountEl: HTMLElement | null = null;

  createEffect(() => {
    const circ = activeCircuit.value;
    const cId = selectedCircuitId.value;

    if (!cId || !circ) {
      currentRenderedCircuitId = null;
      layout.replaceChildren(h('div', { 
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: '🔒 Select an Active Circuit from the context graph.'
      }));
      return;
    }

    // STABLE DOM PATTERN: Only rebuild DOM when switching to a DIFFERENT Circuit
    if (currentRenderedCircuitId !== circ.id) {
      currentRenderedCircuitId = circ.id;
      layout.replaceChildren();

      doc0Area = h('textarea', {
        style: 'flex: 1; width: 100%; font-family: var(--font-mono); font-size: 0.95rem; padding: 15px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-strong); border-radius: 4px; resize: none; margin-bottom: 15px;',
        value: circ.doc0 || '',
        placeholder: 'Compose prompt draft (Document 0)...',
        on: { input: async (e: Event) => {
          const val = (e.target as HTMLTextAreaElement).value;
          updateWordCount(val);
          await updateActiveCircuitDoc0(val);
        }}
      });

      wordCountEl = h('span', {
        style: 'color: var(--text-muted); font-size: 0.85rem; font-family: var(--font-mono);'
      });
      updateWordCount(circ.doc0 || '');

      const executeBtn = h('button', {
        textContent: 'EXECUTE INTENT [ENTER]',
        className: 'k4-btn-primary',
        style: 'align-self: flex-end; padding: 10px 20px; font-weight: bold;',
        on: { click: async () => {
          if (!doc0Area) return;
          const text = doc0Area.value.trim();
          if (!text) return;
          await processSubmission('chat', false, text);
          pushScreen('chat');
        }}
      });

      const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 15px;' },
        h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: `doc0 Draft Composition: ${circ.name}` }),
        wordCountEl
      );

      layout.append(header, doc0Area, executeBtn);
    } else {
      // Passive update without DOM destruction
      if (doc0Area && document.activeElement !== doc0Area) {
        doc0Area.value = circ.doc0 || '';
      }
      updateWordCount(circ.doc0 || '');
    }
  });

  function updateWordCount(text: string) {
    if (wordCountEl) {
      const chars = text.length;
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      wordCountEl.textContent = `Length: ${chars} chars | Words: ${words}`;
    }
  }

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'doc0', label: 'doc0', order: 104, mount: mountDoc0Screen });
