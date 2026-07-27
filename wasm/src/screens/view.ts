// wasm/src/screens/view.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { activeCircuit, circuitsGrid } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { h } from '../dom';

export function mountViewScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; max-width: 600px;' });
  container.appendChild(layout);

  createEffect(() => {
    const c = activeCircuit.value;
    layout.replaceChildren();

    if (!c) {
      layout.appendChild(h('div', {
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: '🔒 Select a Circuit from the context graph.'
      }));
      return;
    }

    const nameInput = h('input', { value: c.name, style: 'width: 100%; margin-bottom: 12px; font-weight: bold;' });
    const descInput = h('textarea', { value: c.description || '', placeholder: 'View rotation description...', style: 'width: 100%; margin-bottom: 12px; min-height: 60px;' });

    const wIn = h('input', { type: 'number', step: '0.1', value: String(c.physics.omega), style: 'width: 100%;' });
    const rIn = h('input', { type: 'number', step: '1', value: String(c.physics.r), style: 'width: 100%;' });
    const lIn = h('input', { type: 'number', step: '1', value: String(c.physics.l), style: 'width: 100%;' });
    const cIn = h('input', { type: 'number', step: '0.001', value: String(c.physics.c), style: 'width: 100%;' });

    const saveBtn = h('button', {
      textContent: 'Save View Parameters',
      className: 'k4-btn-primary',
      style: 'margin-top: 15px;',
      on: { click: async () => {
        c.specialization = 'view';
        c.name = nameInput.value.trim() || c.name;
        c.description = descInput.value.trim();
        c.physics = {
          omega: parseFloat(wIn.value) || 1.0,
          r: parseFloat(rIn.value) || 10,
          l: parseFloat(lIn.value) || 10,
          c: parseFloat(cIn.value) || 0.1,
        };
        c.updatedAt = Date.now();
        await vfsDb.upsertCircuit(c);
        circuitsGrid.value = await vfsDb.getAllCircuits();
        alert('View parameters saved.');
      }}
    });

    layout.append(
      h('h2', { style: 'margin-top: 0; color: var(--text-primary); border-bottom: 1px solid var(--border-strong); padding-bottom: 8px;', textContent: `👁️ View Rotation Class: ${c.name}` }),
      h('label', { style: labelStyle, textContent: 'View Name' }), nameInput,
      h('label', { style: labelStyle, textContent: 'Description' }), descInput,
      h('div', { style: 'margin-top: 15px; border-top: 1px solid var(--border-subtle); padding-top: 12px;' },
        h('strong', { style: 'display: block; color: var(--text-primary); margin-bottom: 8px;', textContent: 'Innate Baseline AC Physics' }),
        h('div', { style: 'display: grid; grid-template-columns: max-content 1fr; column-gap: 12px; row-gap: 8px; align-items: center;' },
          h('label', { style: sublabelStyle, textContent: 'ω (Pacing)' }), wIn,
          h('label', { style: sublabelStyle, textContent: 'R (Friction)' }), rIn,
          h('label', { style: sublabelStyle, textContent: 'L (Momentum)' }), lIn,
          h('label', { style: sublabelStyle, textContent: 'C (Tension)' }), cIn
        )
      ),
      saveBtn
    );
  });

  return () => { container.innerHTML = ''; };
}

const labelStyle = 'display: block; color: var(--text-secondary); margin-bottom: 4px; font-weight: bold; font-size: 0.85rem;';
const sublabelStyle = 'font-size: 0.78rem; color: var(--text-muted);';

screenRegistry.register({ id: 'view', label: 'View Class', order: 13, mount: mountViewScreen });

