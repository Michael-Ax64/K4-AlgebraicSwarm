// wasm/src/screens/circuit.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { selectedViewId, circuitGrid } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { h } from '../dom';

export function mountCircuitScreen(container: HTMLElement): () => void {
    const selectedListId = new Signal<string | null>(null);

    const listPane = h('div', { style: 'flex: 0 0 280px; background: var(--bg-panel); border-right: 1px solid var(--border-strong); overflow-y: auto; display: flex; flex-direction: column;' });
    const editorPane = h('div', { style: 'flex: 1; padding: 20px; overflow-y: auto; background: var(--bg-deep);' });
    
    const layout = h('div', { style: 'display: flex; height: 100%; width: 100%;' }, listPane, editorPane);
    container.appendChild(layout);

    // --- LIST PANE ---
    createEffect(() => {
        const circuits = circuitGrid.value;
        const vId = selectedViewId.value;
        const activeId = selectedListId.value;

        listPane.replaceChildren();

        const addBtn = h('button', { textContent: '+ New Circuit Profile', className: 'k4-btn-primary', style: 'margin: 10px; width: calc(100% - 20px);' });
        addBtn.addEventListener('click', () => selectedListId.value = 'new');
        listPane.appendChild(addBtn);

        if (circuits.length === 0) {
            listPane.appendChild(h('div', { style: 'padding: 20px; color: var(--text-muted); font-style: italic; text-align: center;', textContent: 'No tuning profiles exist for this View.' }));
        } else {
            circuits.forEach(c => {
                const item = h('div', {
                    className: `tree-item circuit-item ${c.id === activeId ? 'active' : ''}`,
                    style: 'padding: 12px 15px;',
                    on: { click: () => selectedListId.value = c.id }
                },
                    h('div', { style: 'font-weight:bold; margin-bottom: 4px; color: var(--text-primary); white-space: normal;', textContent: c.name }),
                    h('div', { className: 'circuit-coord', textContent: `⌖ ω${c.omega}:R${c.r}:L${c.l}:C${c.c}` })
                );
                listPane.appendChild(item);
            });
        }
    });

    // --- EDITOR PANE ---
    createEffect(() => {
        const vId = selectedViewId.value;
        const activeId = selectedListId.value;
        const circuit = circuitGrid.value.find(c => c.id === activeId);
        
        editorPane.replaceChildren();

        if (!vId) return;
        if (!activeId) {
            editorPane.appendChild(h('div', { style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 50px;', textContent: 'Select a Circuit Profile from the left panel.' }));
            return;
        }

        const isNew = activeId === 'new';
        
        const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px;' },
            h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: isNew ? 'Create New Profile' : 'Edit Circuit Profile' })
        );

        const nameInput = h('input', { value: circuit?.name || '', style: 'width: 100%; max-width: 400px; margin-bottom: 15px;', placeholder: 'e.g., High-Stress Sprint' });
        
        const wInput = h('input', { type: 'number', step: '0.1', value: circuit?.omega?.toString() || '1.0', style: 'width: 100%; margin-bottom: 15px;' });
        const rInput = h('input', { type: 'number', step: '1', value: circuit?.r?.toString() || '10', style: 'width: 100%; margin-bottom: 15px;' });
        const lInput = h('input', { type: 'number', step: '1', value: circuit?.l?.toString() || '10', style: 'width: 100%; margin-bottom: 15px;' });
        const cInput = h('input', { type: 'number', step: '0.001', value: circuit?.c?.toString() || '0.1', style: 'width: 100%; margin-bottom: 15px;' });

        const saveBtn = h('button', { textContent: 'Save Profile', className: 'k4-btn-primary' });
        const saveStatus = h('span', { style: 'color: var(--health-clear); font-weight: bold; margin-left: 10px; display: none;' });

        saveBtn.addEventListener('click', async () => {
            if (!nameInput.value.trim()) return;
            const updated = {
                id: isNew ? crypto.randomUUID() : circuit!.id,
                viewId: vId,
                name: nameInput.value.trim(),
                omega: parseFloat(wInput.value) || 0,
                r: parseFloat(rInput.value) || 0,
                l: parseFloat(lInput.value) || 0,
                c: parseFloat(cInput.value) || 0,
            };
            await vfsDb.upsertCircuit(updated);
            circuitGrid.value = await vfsDb.getCircuits(vId);
            selectedListId.value = updated.id; // Switch off 'new' mode
            saveStatus.textContent = 'Saved!';
            saveStatus.style.display = 'inline';
            setTimeout(() => saveStatus.style.display = 'none', 2000);
        });

        const formGrid = h('div', { style: 'background: var(--bg-surface); padding: 20px; border: 1px solid var(--border-strong); border-radius: 6px; max-width: 500px;' },
            h('label', { textContent: 'Profile Name', style: 'font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px;' }), nameInput,
            h('h4', { textContent: 'AC Coordinates (Tuning)', style: 'margin-top: 10px; color: var(--text-primary); border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px; margin-bottom: 15px;' }),
            h('label', { textContent: 'Driving Frequency (ω)', style: 'font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px;' }), wInput,
            h('label', { textContent: 'Resistance (R - Friction)', style: 'font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px;' }), rInput,
            h('label', { textContent: 'Inductance (L - Momentum)', style: 'font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px;' }), lInput,
            h('label', { textContent: 'Capacitance (C - Tension)', style: 'font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px;' }), cInput,
            h('div', { style: 'margin-top: 20px; display: flex; align-items: center;' }, saveBtn, saveStatus)
        );

        editorPane.append(header, formGrid);
    });

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'circuit', label: 'Circuit', order: 100, mount: mountCircuitScreen });
