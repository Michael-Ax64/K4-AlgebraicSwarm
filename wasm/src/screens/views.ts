// wasm/src/screens/views.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { viewsGrid, languagesGrid, selectedWorldId, selectedViewId } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { h } from '../dom';


export function mountViewsScreen(container: HTMLElement): () => void {
    const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column; overflow-y: auto;' });
    container.appendChild(layout);

    createEffect(() => {
        const views = viewsGrid.value;
        const langs = languagesGrid.value;
        const wId = selectedWorldId.value;
        const activeV = selectedViewId.value;

        layout.replaceChildren();

        if (!wId) {
            layout.appendChild(h('div', { style: 'margin: auto; color: var(--text-muted); font-style: italic;', textContent: 'Select a World.' }));
            return;
        }

        layout.appendChild(h('h2', { style: 'margin-top: 0; color: var(--text-primary); border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px;', textContent: 'Views (Operational Sessions)' }));

        const listCard = h('div', { style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px; margin-bottom: 20px;' });
        
        if (views.length === 0) {
            listCard.appendChild(h('div', { textContent: 'No views defined in this world.', style: 'color: var(--text-muted); font-style: italic;' }));
        } else {
            views.forEach(v => {
                const isActive = activeV === v.id;
                const langName = langs.find(l => l.id === v.languageId)?.name || 'Missing Language';
                const vRow = h('div', { style: `display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-subtle); align-items: center; background: ${isActive ? 'var(--bg-elevated)' : 'transparent'};` },
                    h('div', {}, 
                        h('strong', { textContent: `👁️ ${v.name}`, style: `color: ${isActive ? 'var(--role-controller)' : 'var(--text-primary)'};` }),
                        h('div', { style: 'font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;', textContent: `Lens: ${langName} | Base: ω=${v.innateOmega}, R=${v.innateR}, L=${v.innateL}, C=${v.innateC}` })
                    ),
                    h('button', { 
                        textContent: isActive ? 'Editing' : 'Edit', 
                        className: 'k4-btn-primary',
                        on: { click: () => selectedViewId.value = v.id } 
                    })
                );
                listCard.appendChild(vRow);
            });
        }

        layout.appendChild(listCard);

        const formCard = h('div', { style: 'background: var(--bg-surface); padding: 20px; border: 1px solid var(--border-strong); border-radius: 6px; max-width: 600px;' });
        
        const editingView = views.find(v => v.id === activeV);
        const title = editingView ? `Edit View: ${editingView.name}` : 'Create New View';
        
        formCard.appendChild(h('h3', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 15px;', textContent: title }));

        const nameInput = h('input', { placeholder: 'View Name (e.g. Sprint Tracker)', value: editingView?.name || '', style: 'width: 100%; margin-bottom: 15px;' });
        const langSelect = h('select', { style: 'width: 100%; margin-bottom: 15px;' });
        
        langs.forEach(l => {
            langSelect.appendChild(h('option', { value: l.id, textContent: l.name, selected: editingView?.languageId === l.id }));
        });

        const wInput = h('input', { type: 'number', step: '0.1', value: editingView?.innateOmega?.toString() || '1.0', style: 'width: 48%; display: inline-block;' });
        const rInput = h('input', { type: 'number', step: '1', value: editingView?.innateR?.toString() || '10', style: 'width: 48%; display: inline-block; float: right;' });
        const lInput = h('input', { type: 'number', step: '1', value: editingView?.innateL?.toString() || '10', style: 'width: 48%; display: inline-block; margin-top: 15px;' });
        const cInput = h('input', { type: 'number', step: '0.001', value: editingView?.innateC?.toString() || '0.1', style: 'width: 48%; display: inline-block; float: right; margin-top: 15px;' });

        const saveBtn = h('button', { textContent: editingView ? 'Update View' : 'Create View', className: 'k4-btn-primary', style: 'margin-top: 20px;' });

        saveBtn.addEventListener('click', async () => {
            if (!nameInput.value.trim() || !langSelect.value) return;
            const newView = {
                id: editingView ? editingView.id : crypto.randomUUID(),
                worldId: wId,
                languageId: langSelect.value,
                name: nameInput.value.trim(),
                description: '',
                innateOmega: parseFloat(wInput.value) || 1.0,
                innateR: parseFloat(rInput.value) || 10,
                innateL: parseFloat(lInput.value) || 10,
                innateC: parseFloat(cInput.value) || 0.1
            };
            await vfsDb.upsertView(newView);
            viewsGrid.value = await vfsDb.getViews(wId);
            selectedViewId.value = newView.id;
        });

        formCard.append(
            h('label', { textContent: 'Name', style: 'display: block; color: var(--text-secondary); margin-bottom: 4px; font-weight: bold;' }), nameInput,
            h('label', { textContent: 'Domain Language', style: 'display: block; color: var(--text-secondary); margin-bottom: 4px; font-weight: bold;' }), langSelect,
            h('div', { style: 'margin-top: 15px; border-top: 1px solid var(--border-subtle); padding-top: 15px;' },
                h('strong', { textContent: 'Innate Baseline Physics', style: 'display: block; color: var(--text-primary); margin-bottom: 10px;' }),
                h('div', {}, h('label', { textContent: 'ω (Pacing)', style: 'font-size: 0.8rem; color: var(--text-muted);' }), wInput, h('label', { textContent: 'R (Friction)', style: 'font-size: 0.8rem; color: var(--text-muted); margin-left: 4%;' }), rInput),
                h('div', {}, h('label', { textContent: 'L (Momentum)', style: 'font-size: 0.8rem; color: var(--text-muted);' }), lInput, h('label', { textContent: 'C (Tension)', style: 'font-size: 0.8rem; color: var(--text-muted); margin-left: 4%;' }), cInput)
            ),
            saveBtn
        );

        layout.appendChild(formCard);
    });

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'views', label: 'Views', order: 11, mount: mountViewsScreen });
