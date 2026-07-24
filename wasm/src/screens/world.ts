// wasm/src/screens/world.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { activeWorldConfig, worldsGrid, languagesGrid, selectedLanguageId } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { h } from '../dom';

type WorldTab = 'settings' | 'languages' | 'history';

export function mountWorldScreen(container: HTMLElement): () => void {
    const activeSubTab = new Signal<WorldTab>('settings');
    const saveStatus = new Signal<string | null>(null);

    const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 20px;' });
    container.appendChild(layout);

    createEffect(() => {
        const world = activeWorldConfig.value;
        const tab = activeSubTab.value;
        const levels = languagesGrid.value;
        const status = saveStatus.value;

        layout.replaceChildren();

        if (!world) {
            layout.appendChild(h('div', { 
                style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
                textContent: 'Select a World from the left context pane.'
            }));
            return;
        }

        // --- HEADER ---
        const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;' },
            h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: `🌍 World: ${world.name}` }),
            status ? h('span', { style: 'color: var(--health-clear); font-weight: bold; font-size: 0.85rem;', textContent: status }) : h('span')
        );

        // --- SUB-NAV BAR ---
        const nav = h('div', { style: 'display: flex; gap: 8px; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px;' });
        const tabs: { id: WorldTab, label: string }[] = [
            { id: 'settings', label: 'Settings & Notes' },
            { id: 'languages', label: 'Languages (Lexicons)' },
            { id: 'history', label: 'World History' }
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

        // --- TAB 1: SETTINGS & NOTES ---
        if (tab === 'settings') {
            const nameInput = h('input', { value: world.name, style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' });
            const notesInput = h('textarea', { value: world.description || '', style: 'width: 100%; max-width: 500px; height: 100px; margin-bottom: 20px; resize: vertical;', placeholder: 'World notes, directives, or macro-context...' });
            
            const providerSel = h('select', { style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' },
                h('option', { value: 'manual', textContent: 'Manual (Copy/Paste)', selected: world.apiProvider === 'manual' }),
                h('option', { value: 'auto', textContent: 'Auto (Built-in AI / Local)', selected: world.apiProvider === 'auto' }),
                h('option', { value: 'openai', textContent: 'OpenAI', selected: world.apiProvider === 'openai' }),
                h('option', { value: 'custom', textContent: 'Custom / Local', selected: world.apiProvider === 'custom' })
            );
            const keyInput = h('input', { type: 'password', value: world.apiKey || '', style: 'width: 100%; max-width: 500px; margin-bottom: 15px;', placeholder: 'API Key (if required)' });
            const urlInput = h('input', { type: 'text', value: world.apiBaseUrl || '', style: 'width: 100%; max-width: 500px; margin-bottom: 20px;', placeholder: 'Base URL (e.g. https://api.openai.com/v1/...)' });

            const saveBtn = h('button', { textContent: 'Save World Settings', className: 'k4-btn-primary', style: 'align-self: flex-start;' });
            saveBtn.addEventListener('click', async () => {
                const updated = { 
                    ...world, 
                    name: nameInput.value.trim(), 
                    description: notesInput.value.trim(),
                    apiProvider: providerSel.value as any,
                    apiKey: keyInput.value,
                    apiBaseUrl: urlInput.value,
                    updatedAt: Date.now() 
                };
                await vfsDb.upsertWorld(updated);
                worldsGrid.value = await vfsDb.getWorlds(); 
                activeWorldConfig.value = updated;
                
                saveStatus.value = 'Saved Successfully!';
                setTimeout(() => saveStatus.value = null, 2000);
            });

            contentWrapper.append(
                h('label', { textContent: 'World Name', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), nameInput,
                h('label', { textContent: 'World Notes', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), notesInput,
                h('h3', { textContent: 'API Configuration', style: 'margin-top: 10px; border-bottom: 1px solid var(--border-strong); padding-bottom: 5px; margin-bottom: 15px; max-width: 500px;' }),
                h('label', { textContent: 'Provider', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), providerSel,
                h('label', { textContent: 'API Key', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), keyInput,
                h('label', { textContent: 'Base URL', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), urlInput,
                saveBtn
            );
        }

        // --- TAB 2: LANGUAGES (LEXICONS) ---
        else if (tab === 'languages') {
            const listCard = h('div', { style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px; margin-bottom: 20px;' });
            
            if (levels.length === 0) {
                listCard.appendChild(h('div', { textContent: 'No languages defined in this world.', style: 'color: var(--text-muted); font-style: italic;' }));
            } else {
                levels.forEach(l => {
                    const isActive = selectedLanguageId.value === l.id;
                    const lRow = h('div', { style: `display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-subtle); align-items: center; background: ${isActive ? 'var(--bg-elevated)' : 'transparent'};` },
                        h('strong', { textContent: `📖 ${l.name}`, style: `color: ${isActive ? 'var(--role-bridge)' : 'var(--text-primary)'};` }),
                        h('button', { 
                            textContent: isActive ? 'Active' : 'Select', 
                            style: `padding: 4px 10px; background: transparent; border: 1px solid ${isActive ? 'var(--role-bridge)' : 'var(--border-strong)'}; color: ${isActive ? 'var(--role-bridge)' : 'var(--text-secondary)'}; cursor: pointer; border-radius: 3px; font-weight: bold;`,
                            on: { click: () => selectedLanguageId.value = l.id } 
                        })
                    );
                    listCard.appendChild(lRow);
                });
            }

            const newLangInput = h('input', { placeholder: 'New Language Name (e.g. C-Suite Execs)', style: 'flex: 1;' });
            const addLangBtn = h('button', { textContent: 'Add Language', className: 'k4-btn-primary' });
            
            addLangBtn.addEventListener('click', async () => {
                const val = newLangInput.value.trim();
                if (!val) return;
                const newLevel = {
                    id: crypto.randomUUID(),
                    worldId: world.id,
                    name: val,
                    levelIndex: levels.length
                };
                await vfsDb.upsertLevel(newLevel);
                languagesGrid.value = await vfsDb.getLevels(world.id); 
                newLangInput.value = '';
            });

            const formRow = h('div', { style: 'display: flex; gap: 10px;' }, newLangInput, addLangBtn);

            contentWrapper.append(
                h('h3', { textContent: 'Languages in this World', style: 'margin: 0 0 10px 0; color: var(--text-primary);' }),
                listCard,
                h('h4', { textContent: 'Create New Language', style: 'margin: 0 0 10px 0; color: var(--text-secondary);' }),
                formRow
            );
        }

        // --- TAB 3: HISTORY ---
        else if (tab === 'history') {
            contentWrapper.appendChild(h('div', { 
                style: 'padding: 30px; background: var(--bg-surface); border: 1px dashed var(--border-strong); color: var(--text-muted); text-align: center; border-radius: 4px;',
                textContent: 'Aggregated World-Level Braid History (Pending Implementation)' 
            }));
        }
    });

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'world', label: 'World', order: 10, mount: mountWorldScreen });

