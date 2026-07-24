// wasm/src/screens/settings.ts

import { createEffect } from '../reactive';
import { logConfig } from '../state';
import { screenRegistry } from './registry';

export function mountSettingsScreen(container: HTMLElement): () => void {
    const layout = document.createElement('div');
    layout.style.display = 'flex';
    layout.style.flexDirection = 'column';
    layout.style.height = '100%';
    layout.style.padding = '20px';

    layout.innerHTML = `
        <div style="max-width: 500px;">
            <h2 style="margin-top: 0; color: var(--text-primary); border-bottom: 1px solid var(--border-strong); padding-bottom: 8px;">Global App Defaults</h2>
            <div style="margin-top: 20px; background: var(--bg-surface); padding: 20px; border-radius: 6px; border: 1px solid var(--border-strong);">
                <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 8px;">Telemetry Log Max Entries (0 = ∞)</label>
                <input type="number" id="log-max-input" style="width: 100%; padding: 8px;" min="0">
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">Limits memory usage for the API Log and Manifold Telemetry streams.</div>
            </div>
            <div style="margin-top: 30px; padding: 20px; border: 1px dashed var(--health-halted); border-radius: 6px; background: rgba(239, 68, 68, 0.05);">
                <h3 style="color: var(--health-halted); margin-top: 0;">Danger Zone</h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem;">This will nuke the entire IndexedDB graph, destroying all Worlds, Languages, Views, and Ledgers.</p>
                <button id="factory-reset-btn" style="padding: 8px 16px; background: var(--health-halted); color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Factory Reset Database</button>
            </div>
        </div>
    `;

    container.appendChild(layout);

    const logMaxInput = layout.querySelector('#log-max-input') as HTMLInputElement;
    const resetBtn = layout.querySelector('#factory-reset-btn') as HTMLButtonElement;

    logMaxInput.value = (logConfig.peek()?.maxEntries || 0).toString();
    logMaxInput.addEventListener('change', () => {
        logConfig.value = { maxEntries: parseInt(logMaxInput.value) || 0 };
    });

    resetBtn.addEventListener('click', async () => {
        if (confirm("Are you absolutely sure? This cannot be undone.")) {
            const { vfsDb } = await import('../ledger/fs');
            await vfsDb.factoryReset();
            location.reload();
        }
    });

    return () => { container.innerHTML = ''; };
}


screenRegistry.register({
    id: 'settings',
    label: 'Settings',
    order: 60,
    mount: mountSettingsScreen
});

