// wasm/src/screens/view.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { activeCircuit, circuitsGrid } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { h } from '../dom';
import { mountPhysicsEditor } from '../circuit-detail';

export function mountViewScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; max-width: 600px;' });
  container.appendChild(layout);

  createEffect(() => {
    // Circuit invariant: activeCircuit is always non-null in a mounted screen.
    const c = activeCircuit.value!;
    layout.replaceChildren();

    const persist = async () => {
      c.updatedAt = Date.now();
      await vfsDb.upsertCircuit(c);
      circuitsGrid.value = await vfsDb.getAllCircuits();
    };

    const nameInput = h('input', { value: c.name, style: 'width: 100%; margin-bottom: 12px; font-weight: bold;' }) as HTMLInputElement;
    nameInput.addEventListener('change', () => { c.name = nameInput.value.trim() || c.name; persist(); });

    const descInput = h('textarea', { value: c.description || '', placeholder: 'View rotation description...', style: 'width: 100%; margin-bottom: 12px; min-height: 60px;' }) as HTMLTextAreaElement;
    descInput.addEventListener('change', () => { c.description = descInput.value.trim(); persist(); });

    const phys = mountPhysicsEditor(c.physics, {
      onChange: (p) => { c.physics = p; persist(); }
    });

    layout.append(
      h('h2', { style: 'margin-top: 0; color: var(--text-primary); border-bottom: 1px solid var(--border-strong); padding-bottom: 8px;', textContent: `👁️ View Rotation Class: ${c.name}` }),
      h('label', { className: 'k4-form-label', textContent: 'View Name' }), nameInput,
      h('label', { className: 'k4-form-label', textContent: 'Description' }), descInput,
      phys.element
    );
  });

  return () => { container.innerHTML = ''; };
}


screenRegistry.register({ id: 'view', label: 'View Class', order: 13, mount: mountViewScreen });

