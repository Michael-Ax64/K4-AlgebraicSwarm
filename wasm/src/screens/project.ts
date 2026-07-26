// wasm/src/screens/project.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import {
  activeProject, selectedProjectId, viewsGrid, selectedViewId,
  projectDocumentsGrid, selectedDocumentId
} from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { View, Circuit, Document } from '../ledger/schema';
import { pushScreen } from '../router';
import { h } from '../dom';

type ProjectSubTab = 'views' | 'circuits' | 'documents' | 'details';


export function mountProjectScreen(container: HTMLElement): () => void {
  const activeSubTab = new Signal<ProjectSubTab>('views');
  const saveStatus = new Signal<string | null>(null);

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 20px;' });
  container.appendChild(layout);

  createEffect(() => {
    const proj = activeProject.value;
    const pId = selectedProjectId.value;
    const tab = activeSubTab.value;
    const views = viewsGrid.value;
    const docs = projectDocumentsGrid.value;
    const activeV = selectedViewId.value;
    const status = saveStatus.value;

    layout.replaceChildren();

    if (!pId || !proj) {
      layout.appendChild(h('div', { 
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: '🔒 Select a Project from the left context pane.' 
      }));
      return;
    }

    // --- HEADER ---
    const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: `📁 Project: ${proj.name}` }),
      status ? h('span', { style: 'color: var(--health-clear); font-weight: bold; font-size: 0.85rem;', textContent: status }) : h('span')
    );

    // --- SUB-NAV BAR ---
    const nav = h('div', { style: 'display: flex; gap: 8px; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px;' });
    const tabs: { id: ProjectSubTab, label: string }[] = [
      { id: 'views', label: 'Views (Rotations)' },
      { id: 'circuits', label: 'Circuits (Project Models)' },
      { id: 'documents', label: 'Project Documents' },
      { id: 'details', label: 'Project Details' }
    ];

    tabs.forEach(t => {
      const btn = h('button', {
        textContent: t.label,
        style: `padding: 6px 12px; border-radius: 4px; border: 1px solid ${tab === t.id ? 'var(--role-bridge)' : 'transparent'}; background: ${tab === t.id ? 'var(--bg-surface)' : 'transparent'}; color: ${tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight: bold; cursor: pointer; transition: all 0.2s;`,
        on: { click: () => activeSubTab.value = t.id }
      });
      nav.appendChild(btn);
    });

    const contentWrapper = h('div', { style: 'flex: 1; overflow-y: auto; display: flex; flex-direction: column;' });
    layout.append(header, nav, contentWrapper);

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 1: VIEWS (ROTATIONS)
    // ────────────────────────────────────────────────────────────────────────
    if (tab === 'views') {
      const listCard = h('div', { style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px; margin-bottom: 20px;' });
      
      if (views.length === 0) {
        listCard.appendChild(h('div', { textContent: 'No views defined in this project.', style: 'color: var(--text-muted); font-style: italic;' }));
      } else {
        views.forEach(v => {
          const isActive = activeV === v.id;
          const vRow = h('div', {
            style: `display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-subtle); align-items: center; background: ${isActive ? 'var(--bg-elevated)' : 'transparent'};`
          },
            h('strong', { textContent: `👁️ ${v.name}`, style: `color: ${isActive ? 'var(--role-controller)' : 'var(--text-primary)'};` }),
            h('div', { className: 'baseline-physics', style: 'margin-right: 15px;', textContent: `Innate Baseline Physics: ω=${v.innateOmega}, R=${v.innateR}, L=${v.innateL}, C=${v.innateC}` }),
            h('button', {
              textContent: isActive ? 'Active View' : 'Select View',
              className: 'k4-btn-primary',
              on: { click: () => {
                selectedViewId.value = v.id;
                pushScreen('chat');
              }}
            })
          );
          listCard.appendChild(vRow);
        });
      }

      // Create View Rotation Form
      const formCard = h('div', { style: 'background: var(--bg-surface); padding: 20px; border: 1px solid var(--border-strong); border-radius: 6px; max-width: 600px;' });
      formCard.appendChild(h('h3', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 15px;', textContent: 'Create New View Rotation' }));

      const nameInput = h('input', { placeholder: 'View Name (e.g. Exploratory Rotation)', style: 'width: 100%; margin-bottom: 15px;' });
      const descInput = h('textarea', { placeholder: 'Description — what this rotation is for, distinct from sibling rotations.', style: 'width: 100%; margin-bottom: 15px; min-height: 60px; resize: vertical; font-family: inherit;' });

      // AC Physics Edit Boxes (Flush right over 4 lines)
      const wInput = h('input', { type: 'number', step: '0.1', value: '1.0', style: 'width: 110px; text-align: right; font-family: var(--font-mono);' });
      const rInput = h('input', { type: 'number', step: '1', value: '10', style: 'width: 110px; text-align: right; font-family: var(--font-mono);' });
      const lInput = h('input', { type: 'number', step: '1', value: '10', style: 'width: 110px; text-align: right; font-family: var(--font-mono);' });
      const cInput = h('input', { type: 'number', step: '0.001', value: '0.1', style: 'width: 110px; text-align: right; font-family: var(--font-mono);' });

      const makePhysicsRow = (label: string, inputEl: HTMLElement) =>
        h('div', { style: 'display: flex; justify-content: flex-end; align-items: center; gap: 10px; width: 100%; margin-bottom: 6px;' },
          h('label', { style: 'font-size: 0.8rem; color: var(--text-muted); text-align: right;', textContent: label }),
          inputEl
        );

      const physicsContainer = h('div', { style: 'display: flex; flex-direction: column; align-items: flex-end; margin-top: 10px;' },
        makePhysicsRow('ω (Pacing)', wInput),
        makePhysicsRow('R (Friction)', rInput),
        makePhysicsRow('L (Momentum)', lInput),
        makePhysicsRow('C (Tension)', cInput)
      );

      const saveBtn = h('button', { textContent: 'Create View', className: 'k4-btn-primary', style: 'margin-top: 20px;' });

      saveBtn.addEventListener('click', async () => {
        if (!nameInput.value.trim()) return;
        const now = Date.now();
        const newView = {
          id: `view-${now}-${Math.random().toString(36).substring(2, 7)}`,
          projectId: pId,
          name: nameInput.value.trim(),
          description: descInput.value.trim(),
          doc0: '',
          innateOmega: parseFloat(wInput.value) || 1.0,
          innateR: parseFloat(rInput.value) || 10,
          innateL: parseFloat(lInput.value) || 10,
          innateC: parseFloat(cInput.value) || 0.1,
          createdAt: now,
          updatedAt: now,
        };
        await vfsDb.upsertView(newView);
        viewsGrid.value = await vfsDb.getViews(pId);
        selectedViewId.value = newView.id;
        nameInput.value = '';
        descInput.value = '';
      });

      formCard.append(
        h('label', { textContent: 'Name', style: 'display: block; color: var(--text-secondary); margin-bottom: 4px; font-weight: bold;' }), nameInput,
        h('label', { textContent: 'Description', style: 'display: block; color: var(--text-secondary); margin-bottom: 4px; font-weight: bold;' }), descInput,
        h('div', { style: 'margin-top: 15px; border-top: 1px solid var(--border-subtle); padding-top: 15px;' },
          h('strong', { textContent: 'AC Baseline Physics', style: 'display: block; color: var(--text-primary); margin-bottom: 12px; text-align: right;' }),
          physicsContainer
        ),
        saveBtn
      );

      contentWrapper.append(listCard, formCard);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 2: CIRCUITS (PROJECT MODELS)
    // ────────────────────────────────────────────────────────────────────────
    else if (tab === 'circuits') {
      const table = h('table', { className: 'numbers-table', style: 'width: 100%; border-collapse: collapse;' },
        h('thead', {},
          h('tr', {},
            h('th', { textContent: 'Circuit Model Name' }),
            h('th', { textContent: 'View' }),
            h('th', { textContent: 'Poles (Active / Held)' }),
            h('th', { textContent: 'AC Physics (ω : R : L : C)' }),
            h('th', { textContent: 'Diagnostic Vocabulary' }),
            h('th', { textContent: 'Reward Question' })
          )
        )
      );

      const tbody = h('tbody');

      (async () => {
        const projectCircuits: { circuit: Circuit; viewName: string }[] = [];
        for (const v of views) {
          const circs = await vfsDb.getCircuits(v.id);
          circs.forEach(c => projectCircuits.push({ circuit: c, viewName: v.name }));
        }

        tbody.replaceChildren();

        if (projectCircuits.length === 0) {
          tbody.appendChild(h('tr', {}, h('td', { colSpan: 6, style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;', textContent: 'No circuit models compiled for this Project.' })));
        } else {
          projectCircuits.forEach(({ circuit, viewName }) => {
            tbody.appendChild(h('tr', {},
              h('td', { style: 'font-weight: bold; color: var(--text-primary);' }, circuit.name),
              h('td', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, viewName),
              h('td', { style: 'font-size: 0.85rem;' }, `${circuit.activeFace} (held ${circuit.heldAbsentVar})`),
              h('td', { style: 'font-family: var(--font-mono); font-size: 0.8rem; color: var(--role-bridge);' }, `ω${circuit.omega} : R${circuit.r} : L${circuit.l} : C${circuit.c}`),
              h('td', { style: 'font-size: 0.78rem; color: var(--text-secondary); font-family: var(--font-mono);' }, circuit.diagnosticVocab?.join(', ') || '—'),
              h('td', { style: 'font-size: 0.8rem; color: var(--text-secondary); font-style: italic;' }, circuit.rewardQuestion || '—')
            ));
          });
        }
      })();

      table.appendChild(tbody);
      contentWrapper.append(
        h('h3', { textContent: 'Project Circuit Models', style: 'margin: 0 0 10px 0; color: var(--text-primary);' }),
        h('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;', textContent: 'The models and AC equations generated for this Project:' }),
        table
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 3: PROJECT DOCUMENTS
    // ────────────────────────────────────────────────────────────────────────
    else if (tab === 'documents') {
      const uploadDocBtn = h('button', {
        textContent: '+ Add Project Document',
        className: 'k4-btn-primary',
        style: 'margin-bottom: 15px; align-self: flex-start;',
        on: { click: () => {
          selectedDocumentId.value = 'new';
          pushScreen('doc-editor');
        }}
      });

      const table = h('table', { className: 'numbers-table', style: 'width: 100%; border-collapse: collapse;' },
        h('thead', {},
          h('tr', {},
            h('th', { textContent: 'Document Name', style: 'width: 50%;' }),
            h('th', { textContent: 'Type', style: 'width: 15%;' }),
            h('th', { textContent: 'Default Inclusions (A / P / U / I / R)' })
          )
        )
      );

      const tbody = h('tbody');
      if (docs.length === 0) {
        tbody.appendChild(h('tr', {}, h('td', { colSpan: 3, style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;', textContent: 'No Project documents created yet.' })));
      } else {
        docs.forEach(d => {
          const defaultFlags = [
            d.defaultA ? 'A' : '',
            d.defaultP ? 'P' : '',
            d.defaultU ? 'U' : '',
            d.defaultI ? 'I' : '',
            d.defaultR ? 'R' : ''
          ].filter(Boolean).join(', ') || 'None';

          const row = h('tr', {
            style: 'cursor: pointer;',
            on: { click: () => {
              selectedDocumentId.value = d.id;
              pushScreen('doc-editor');
            }}
          },
            h('td', { style: 'font-weight: 600; color: var(--text-primary);' }, d.name),
            h('td', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, d.kind),
            h('td', { style: 'font-family: var(--font-mono); font-size: 0.85rem; color: var(--role-bridge);' }, defaultFlags)
          );
          tbody.appendChild(row);
        });
      }

      table.appendChild(tbody);
      contentWrapper.append(uploadDocBtn, table);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 4: DETAILS & DIRECTIVES
    // ────────────────────────────────────────────────────────────────────────
    else if (tab === 'details') {
      const nameInput = h('input', { value: proj.name, style: 'width: 100%; max-width: 500px; margin-bottom: 15px; font-weight: bold;' });
      const descInput = h('textarea', { value: proj.description || '', style: 'width: 100%; max-width: 500px; height: 120px; margin-bottom: 20px; resize: vertical;', placeholder: 'Primary question or project directives...' });

      const saveBtn = h('button', { textContent: 'Save Project Details', className: 'k4-btn-primary', style: 'align-self: flex-start;' });
      saveBtn.addEventListener('click', async () => {
        const updated = {
          ...proj,
          name: nameInput.value.trim(),
          description: descInput.value.trim(),
          updatedAt: Date.now()
        };
        await vfsDb.upsertProject(updated);
        activeProject.value = updated;
        saveStatus.value = 'Project Details Saved!';
        setTimeout(() => saveStatus.value = null, 2000);
      });

      contentWrapper.append(
        h('label', { textContent: 'Project Name (Primary Question)', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), nameInput,
        h('label', { textContent: 'Directives & Description', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), descInput,
        saveBtn
      );
    }
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'project', label: 'Project', order: 11, mount: mountProjectScreen });
