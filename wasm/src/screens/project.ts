// wasm/src/screens/project.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { activeCircuit, circuitsGrid, selectedCircuitId } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { CircuitNode } from '../ledger/schema';
import { pushScreen } from '../router';
import { h } from '../dom';
import { mountChildrenList, createAddChildButton, mountSpecializationEditor } from '../circuit-detail';

type ProjectSubTab = 'details' | 'children';

export function mountProjectScreen(container: HTMLElement): () => void {
  const activeSubTab = new Signal<ProjectSubTab>('details');

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 20px;' });
  container.appendChild(layout);

  createEffect(() => {
    // Circuit invariant: activeCircuit is always non-null in a mounted screen.
    const c = activeCircuit.value!;
    const tab = activeSubTab.value;
    const allCircuits = circuitsGrid.value;

    mountSpecializationEditor(layout, {
      title: `📁 Project Class: ${c.name}`,
      activeTab: tab,
      tabs: [
        { id: 'details',  label: 'Directives & Details' },
        { id: 'children', label: 'Child Circuits & Views' }
      ],
      onTabChange: (id) => activeSubTab.value = id as ProjectSubTab,
      renderTab: (tab, contentWrapper) => {
        if (tab === 'details') {
          const persist = async () => {
            c.updatedAt = Date.now();
            await vfsDb.upsertCircuit(c);
            circuitsGrid.value = await vfsDb.getAllCircuits();
          };

          const nameInput = h('input', { value: c.name, style: 'width: 100%; max-width: 500px; margin-bottom: 15px; font-weight: bold;' }) as HTMLInputElement;
          nameInput.addEventListener('change', () => { c.name = nameInput.value.trim() || c.name; persist(); });

          const descInput = h('textarea', { value: c.description || '', style: 'width: 100%; max-width: 500px; height: 120px; margin-bottom: 20px; resize: vertical;', placeholder: 'Primary question or project directives...' }) as HTMLTextAreaElement;
          descInput.addEventListener('change', () => { c.description = descInput.value.trim(); persist(); });

          contentWrapper.append(
            h('label', { className: 'k4-form-label', textContent: 'Project Name (Primary Question)' }), nameInput,
            h('label', { className: 'k4-form-label', textContent: 'Directives & Description' }), descInput,
          );
        } else if (tab === 'children') {
          const childList = mountChildrenList(c.id, allCircuits, {
            emptyMessage: 'No child circuits point to this Project.',
          });

          const addChildBtn = createAddChildButton(c.id, {
            label: '+ Add Child View/Circuit',
            defaultSpecialization: 'view',
            defaultName: 'New View Rotation',
          });

          contentWrapper.append(childList, addChildBtn);
        }
      }
    });
  });

  return () => { container.innerHTML = ''; };
}


screenRegistry.register({ id: 'project', label: 'Project Class', order: 11, mount: mountProjectScreen });

