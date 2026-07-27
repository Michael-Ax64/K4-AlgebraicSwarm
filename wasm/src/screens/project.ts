// wasm/src/screens/project.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { activeCircuit, circuitsGrid, selectedCircuitId } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { CircuitNode } from '../ledger/schema';
import { pushScreen } from '../router';
import { h } from '../dom';

type ProjectSubTab = 'details' | 'children';

export function mountProjectScreen(container: HTMLElement): () => void {
  const activeSubTab = new Signal<ProjectSubTab>('details');
  const saveStatus = new Signal<string | null>(null);

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 20px;' });
  container.appendChild(layout);

  createEffect(() => {
    const c = activeCircuit.value;
    const tab = activeSubTab.value;
    const status = saveStatus.value;
    const allCircuits = circuitsGrid.value;

    layout.replaceChildren();

    if (!c) {
      layout.appendChild(h('div', {
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: '🔒 Select a Circuit from the context graph.'
      }));
      return;
    }

    // Header
    const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: `📁 Project Class: ${c.name}` }),
      status ? h('span', { style: 'color: var(--health-clear); font-weight: bold; font-size: 0.85rem;', textContent: status }) : h('span')
    );

    // Nav tabs
    const nav = h('div', { style: 'display: flex; gap: 8px; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px;' });
    const tabs: { id: ProjectSubTab; label: string }[] = [
      { id: 'details', label: 'Directives & Details' },
      { id: 'children', label: 'Child Circuits & Views' }
    ];

    tabs.forEach(t => {
      nav.appendChild(h('button', {
        textContent: t.label,
        style: `padding: 6px 12px; border-radius: 4px; border: 1px solid ${tab === t.id ? 'var(--role-bridge)' : 'transparent'}; background: ${tab === t.id ? 'var(--bg-surface)' : 'transparent'}; color: ${tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight: bold; cursor: pointer; transition: all 0.2s;`,
        on: { click: () => activeSubTab.value = t.id }
      }));
    });

    const contentWrapper = h('div', { style: 'flex: 1; overflow-y: auto; display: flex; flex-direction: column;' });
    layout.append(header, nav, contentWrapper);

    if (tab === 'details') {
      const nameInput = h('input', { value: c.name, style: 'width: 100%; max-width: 500px; margin-bottom: 15px; font-weight: bold;' });
      const descInput = h('textarea', { value: c.description || '', style: 'width: 100%; max-width: 500px; height: 120px; margin-bottom: 20px; resize: vertical;', placeholder: 'Primary question or project directives...' });

      const saveBtn = h('button', {
        textContent: 'Save Project Details',
        className: 'k4-btn-primary',
        style: 'align-self: flex-start;',
        on: { click: async () => {
          c.specialization = 'project';
          c.name = nameInput.value.trim() || c.name;
          c.description = descInput.value.trim();
          c.updatedAt = Date.now();
          await vfsDb.upsertCircuit(c);
          circuitsGrid.value = await vfsDb.getAllCircuits();
          saveStatus.value = '✓ Project Details Saved!';
          setTimeout(() => saveStatus.value = null, 2000);
        }}
      });

      contentWrapper.append(
        h('label', { style: labelStyle, textContent: 'Project Name (Primary Question)' }), nameInput,
        h('label', { style: labelStyle, textContent: 'Directives & Description' }), descInput,
        saveBtn
      );
    } else if (tab === 'children') {
      const childNodes = allCircuits.filter(other => other.priorId === c.id && other.priorId !== '__TRASH__');
      const childList = h('div', { style: 'display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;' });

      if (childNodes.length === 0) {
        childList.appendChild(h('div', { style: 'color: var(--text-muted); font-style: italic;', textContent: 'No child circuits point to this Project.' }));
      } else {
        childNodes.forEach(child => {
          const badge = child.specialization === 'view' ? '👁️' : '⌖';
          childList.appendChild(h('div', {
            style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 6px; padding: 12px; display: flex; justify-content: space-between; align-items: center;'
          },
            h('span', { style: 'font-weight: bold; color: var(--text-primary);', textContent: `${badge} ${child.name}` }),
            h('button', {
              textContent: 'Select Circuit',
              className: 'k4-btn-primary',
              style: 'padding: 4px 10px; font-size: 0.8rem;',
              on: { click: () => { selectedCircuitId.value = child.id; pushScreen('chat'); } }
            })
          ));
        });
      }

      const addChildBtn = h('button', {
        textContent: '+ Add Child View/Circuit',
        className: 'k4-btn-primary',
        style: 'align-self: flex-start;',
        on: { click: async () => {
          const now = Date.now();
          const fresh: CircuitNode = {
            id: `circ-${now}-${Math.random().toString(36).substring(2, 7)}`,
            priorId: c.id,
            specialization: 'view',
            name: 'New View Rotation',
            description: '',
            doc0: '',
            physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
            activeFace: 'P',
            heldAbsentVar: 'I',
            createdAt: now,
            updatedAt: now,
          };
          await vfsDb.upsertCircuit(fresh);
          circuitsGrid.value = await vfsDb.getAllCircuits();
          selectedCircuitId.value = fresh.id;
        }}
      });

      contentWrapper.append(childList, addChildBtn);
    }
  });

  return () => { container.innerHTML = ''; };
}

const labelStyle = 'display: block; color: var(--text-secondary); margin-bottom: 4px; font-weight: bold; font-size: 0.85rem;';

screenRegistry.register({ id: 'project', label: 'Project Class', order: 11, mount: mountProjectScreen });

