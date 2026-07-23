// wasm/src/screens/settings.ts

import { createEffect } from '../reactive';
import { logConfig } from '../state';
import { worldsGrid, levelsGrid, selectedWorldId, selectedLevelId, activeWorldConfig } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { screenRegistry } from './registry';


export function mountSettingsScreen(container: HTMLElement): () => void {
    const layout = document.createElement('div');
    layout.style.display = 'flex';
    layout.style.gap = '30px';
    layout.style.height = '100%';
    layout.style.padding = '20px';
    layout.style.overflowY = 'auto';

    layout.innerHTML = `
        <div style="flex: 1; max-width: 400px;">
            <h3 style="margin-top: 0; color: #14161A; border-bottom: 1px solid #ccc; padding-bottom: 8px;">Global App Defaults</h3>
            <div style="margin-bottom: 25px;">
                <label style="font-weight: bold; font-size: 0.85rem; color: #555; display: block; margin-bottom: 4px;">Log Max Entries (0 = ∞)</label>
                <input type="number" id="log-max-input" style="width: 100%; padding: 6px;" min="0">
                <div style="font-size: 0.75rem; color: #888; margin-top: 4px;">Applies to API and Manifold logs.</div>
            </div>
            
            <h3 style="color: #14161A; border-bottom: 1px solid #ccc; padding-bottom: 8px;">Active Context</h3>
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; font-size: 0.85rem; color: #555; display: block; margin-bottom: 4px;">Switch Active World</label>
                <select id="active-world-select" style="width: 100%; padding: 6px;"></select>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; font-size: 0.85rem; color: #555; display: block; margin-bottom: 4px;">Switch Active Level</label>
                <select id="active-level-select" style="width: 100%; padding: 6px;"></select>
            </div>
        </div>

        <div style="flex: 1; max-width: 500px;">
            <h3 style="margin-top: 0; color: #14161A; border-bottom: 1px solid #ccc; padding-bottom: 8px;">World API Configuration</h3>
            <div id="world-config-panel" style="background: #fff; border: 1px solid #DAD5CB; border-radius: 4px; padding: 15px;"></div>
        </div>
    `;

    container.appendChild(layout);

    const logMaxInput     = layout.querySelector('#log-max-input') as HTMLInputElement;
    const activeWorldSel  = layout.querySelector('#active-world-select') as HTMLSelectElement;
    const activeLevelSel  = layout.querySelector('#active-level-select') as HTMLSelectElement;
    const configPanel     = layout.querySelector('#world-config-panel') as HTMLDivElement;

    // FIX: Use peek() to prevent reactivity capture on mount
    logMaxInput.value = (logConfig.peek()?.maxEntries || 0).toString();
    logMaxInput.addEventListener('change', async () => {
        const updated = { maxEntries: parseInt(logMaxInput.value) || 0 };
        logConfig.value = updated;
    });

    activeWorldSel.addEventListener('change', () => { selectedWorldId.value = activeWorldSel.value; });
    activeLevelSel.addEventListener('change', () => { selectedLevelId.value = activeLevelSel.value; });

    createEffect(() => {
        const worlds = worldsGrid.value;
        const activeWId = selectedWorldId.value;
        activeWorldSel.innerHTML = '';
        worlds.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = w.name;
            if (w.id === activeWId) opt.selected = true;
            activeWorldSel.appendChild(opt);
        });
    });

    createEffect(() => {
        const levels = levelsGrid.value;
        const activeLId = selectedLevelId.value;
        activeLevelSel.innerHTML = '';
        levels.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.name;
            if (l.id === activeLId) opt.selected = true;
            activeLevelSel.appendChild(opt);
        });
    });

    createEffect(() => {
        const activeW = activeWorldConfig.value;
        if (!activeW) {
            configPanel.innerHTML = '<span style="color:#888; font-style: italic;">Select a World to configure its API.</span>';
            return;
        }

        configPanel.innerHTML = `
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; font-size: 0.85rem; color: #555;">Provider:</label><br>
                <select id="api-provider-select" style="width: 100%; padding: 6px; margin-top: 4px;">
                    <option value="manual" ${activeW.apiProvider === 'manual' ? 'selected' : ''}>Manual (Copy/Paste)</option>
                    <option value="auto" ${activeW.apiProvider === 'auto' ? 'selected' : ''}>Auto (Built-in AI / Local)</option>
                    <option value="openai" ${activeW.apiProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="custom" ${activeW.apiProvider === 'custom' ? 'selected' : ''}>Custom / Local</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; font-size: 0.85rem; color: #555;">API Key:</label><br>
                <input type="password" id="api-key-input" value="${activeW.apiKey || ''}" style="width: 100%; padding: 6px; margin-top: 4px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; font-size: 0.85rem; color: #555;">Base URL (Optional):</label><br>
                <input type="text" id="api-url-input" value="${activeW.apiBaseUrl || ''}" placeholder="https://api.openai.com/v1/..." style="width: 100%; padding: 6px; margin-top: 4px;">
            </div>
            <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="persist-corpus-check" ${activeW.persistCorpus ? 'checked' : ''}>
                <label for="persist-corpus-check" style="font-size: 0.85rem; color: #555; cursor: pointer;">Persist Corpus</label>
            </div>
            <button id="save-world-btn" style="padding: 8px 16px; background: #14161A; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Configuration</button>
            <span id="save-status" style="margin-left: 10px; font-size: 0.85rem; color: #388e3c; display: none;">Saved!</span>
        `;

        const providerSel = configPanel.querySelector('#api-provider-select') as HTMLSelectElement;
        const keyInput    = configPanel.querySelector('#api-key-input') as HTMLInputElement;
        const urlInput    = configPanel.querySelector('#api-url-input') as HTMLInputElement;
        const persistChk  = configPanel.querySelector('#persist-corpus-check') as HTMLInputElement;
        const saveBtn     = configPanel.querySelector('#save-world-btn') as HTMLButtonElement;
        const statusSpan  = configPanel.querySelector('#save-status') as HTMLSpanElement;

        saveBtn.addEventListener('click', async () => {
            const updatedWorld = {
                ...activeW,
                apiProvider: providerSel.value as any,
                apiKey: keyInput.value,
                apiBaseUrl: urlInput.value,
                persistCorpus: persistChk.checked,
                updatedAt: Date.now()
            };
            await vfsDb.upsertWorld(updatedWorld);
            activeWorldConfig.value = updatedWorld;
            statusSpan.style.display = 'inline';
            setTimeout(() => statusSpan.style.display = 'none', 2000);
        });
    });

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({
    id: 'settings',
    label: 'Settings',
    order: 60,
    mount: mountSettingsScreen
});
