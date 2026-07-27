// wasm/src/screens/views.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { viewsGrid, selectedProjectId, selectedViewId, activeProject } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { h } from '../dom';

export function mountViewsScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column; overflow-y: auto;' });
  container.appendChild(layout);

  createEffect(() => {
    const views = viewsGrid.value;
    const proj = activeProject.value;
    const pId = selectedProjectId.value;
    const activeV = selectedViewId.value;

    layout.replaceChildren();

    if (!pId || !proj) {
      layout.appendChild(h('div', { style: 'margin: auto; color: var(--text-muted); font-style: italic;', textContent: 'Select a Project from the left context pane.' }));
      return;
    }

    layout.appendChild(h('h2', { style: 'margin-top: 0; color: var(--text-primary); border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px;', textContent: `Views (Rotations of ${proj.name})` }));

    const listCard = h('div', { style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px; margin-bottom: 20px;' });
    
    if (views.length === 0) {
      listCard.appendChild(h('div', { textContent: 'No views defined in this project.', style: 'color: var(--text-muted); font-style: italic;' }));
    } else {
      views.forEach(v => {
        const isActive = activeV === v.id;
        const vRow = h('div', { style: `display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-subtle); align-items: center; background: ${isActive ? 'var(--bg-elevated)' : 'transparent'};` },
          h('strong', { textContent: `👁️ ${v.name}`, style: `color: ${isActive ? 'var(--role-controller)' : 'var(--text-primary)'};` }),
          h('div', { style: 'font-size: 0.8rem; font-family: var(--font-mono); color: var(--text-muted); text-align: right; margin-left: auto; margin-right: 15px;', textContent: `AC Baseline Physics: ω=${v.innateOmega}, R=${v.innateR}, L=${v.innateL}, C=${v.innateC}` }),
          h('button', {
            textContent: isActive ? 'Active' : 'Select View',
            className: 'k4-btn-primary',
            on: { click: () => selectedViewId.value = v.id }
          })
        );
        listCard.appendChild(vRow);
      });
    }

    layout.appendChild(listCard);

    // --- FORM: CREATE / EDIT VIEW ---
    const formCard = h('div', { style: 'background: var(--bg-surface); padding: 20px; border: 1px solid var(--border-strong); border-radius: 6px; max-width: 600px;' });
    const editingView = views.find(v => v.id === activeV);
    const title = editingView ? `Edit View: ${editingView.name}` : 'Create New View Rotation';
    
    formCard.appendChild(h('h3', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 15px;', textContent: title }));

    const nameInput = h('input', { placeholder: 'View Name (e.g. Exploratory Rotation)', value: editingView?.name || '', style: 'width: 100%; margin-bottom: 15px;' });

    const wInput = h('input', { type: 'number', step: '0.1', value: editingView?.innateOmega?.toString() || '1.0', style: 'width: 48%; display: inline-block;' });
    const rInput = h('input', { type: 'number', step: '1', value: editingView?.innateR?.toString() || '10', style: 'width: 48%; display: inline-block; float: right;' });
    const lInput = h('input', { type: 'number', step: '1', value: editingView?.innateL?.toString() || '10', style: 'width: 48%; display: inline-block; margin-top: 15px;' });
    const cInput = h('input', { type: 'number', step: '0.001', value: editingView?.innateC?.toString() || '0.1', style: 'width: 48%; display: inline-block; float: right; margin-top: 15px;' });

    const saveBtn = h('button', { textContent: editingView ? 'Update View' : 'Create View', className: 'k4-btn-primary', style: 'margin-top: 20px;' });

    saveBtn.addEventListener('click', async () => {
      if (!nameInput.value.trim()) return;
      const now = Date.now();
      const newView = {
        id: editingView ? editingView.id : crypto.randomUUID(),
        projectId: pId,
        name: nameInput.value.trim(),
        description: '',
        doc0: editingView?.doc0 || '',
        innateOmega: parseFloat(wInput.value) || 1.0,
        innateR: parseFloat(rInput.value) || 10,
        innateL: parseFloat(lInput.value) || 10,
        innateC: parseFloat(cInput.value) || 0.1,
        createdAt: editingView?.createdAt || now,
        updatedAt: now,
      };
      await vfsDb.upsertView(newView);
      viewsGrid.value = await vfsDb.getViews(pId);
      selectedViewId.value = newView.id;
    });

    formCard.append(
      h('label', { textContent: 'Name', style: 'display: block; color: var(--text-secondary); margin-bottom: 4px; font-weight: bold;' }), nameInput,
      h('div', { style: 'margin-top: 15px; border-top: 1px solid var(--border-subtle); padding-top: 15px;' },
        h('strong', { textContent: 'AC Baseline Physics', style: 'display: block; color: var(--text-primary); margin-bottom: 10px; text-align: right;' }),
        h('div', {}, h('label', { textContent: 'ω (Pacing)', style: 'font-size: 0.8rem; color: var(--text-muted);' }), wInput, h('label', { textContent: 'R (Friction)', style: 'font-size: 0.8rem; color: var(--text-muted); margin-left: 4%;' }), rInput),
        h('div', {}, h('label', { textContent: 'L (Momentum)', style: 'font-size: 0.8rem; color: var(--text-muted);' }), lInput, h('label', { textContent: 'C (Tension)', style: 'font-size: 0.8rem; color: var(--text-muted); margin-left: 4%;' }), cInput)
      ),
      saveBtn
    );

    layout.appendChild(formCard);
  });

  return () => { container.innerHTML = ''; };
}

// Retired: this screen was registered but unreachable — not in globalScreenIds
// nor viewPeerScreenIds, and no pushScreen('views') callers exist. Its
// list-and-form functionality is served by the Project screen's 'views'
// sub-tab. `mountViewsScreen` remains exported for anyone reviving this as
// a peer/global; add it back to the appropriate nav array in shell/default.ts
// and re-register here.
// screenRegistry.register({ id: 'views', label: 'Views', order: 11, mount: mountViewsScreen });

