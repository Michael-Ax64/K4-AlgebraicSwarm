// wasm/src/screens/manifold.ts

import { createEffect } from '../reactive';
import { manifoldLog, logConfig } from '../state';
import { screenRegistry } from './registry';

export function mountManifoldScreen(container: HTMLElement): () => void {
    const layout = document.createElement('div');
    layout.style.display = 'flex';
    layout.style.flexDirection = 'column';
    layout.style.height = '100%';
    
    layout.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin: 0; color: #14161A;">Manifold Telemetry</h2>
            <div>
                <button id="manifold-clear-btn" style="padding: 4px 12px; margin-left: 10px;">Clear</button>
            </div>
        </div>
        <div id="manifold-log-container" style="flex: 1; overflow-y: auto; background: #fff; border: 1px solid #DAD5CB; border-radius: 4px; padding: 10px; font-family: monospace; font-size: 0.85rem;"></div>
    `;
    
    container.appendChild(layout);

    const logContainer = layout.querySelector('#manifold-log-container') as HTMLDivElement;
    const clearBtn = layout.querySelector('#manifold-clear-btn') as HTMLButtonElement;

    clearBtn.addEventListener('click', () => {
        manifoldLog.value = [];
    });

    function enforceLimit() {
        const max = logConfig.value?.maxEntries || 0;
        if (max > 0 && manifoldLog.value.length > max) {
            manifoldLog.value = manifoldLog.value.slice(-max);
        }
    }

    createEffect(() => {
        enforceLimit();
        const logs = manifoldLog.value;
        logContainer.replaceChildren(...logs.map(log => {
            const row = document.createElement('div');
            row.style.padding = '4px 0';
            row.style.borderBottom = '1px solid #f0f0f0';
            
            const time = new Date(log.ts).toISOString().split('T')[1].slice(0, -1);
            
            let color = '#333';
            if (log.type === 'error') color = '#d32f2f';
            if (log.type === 'warn') color = '#f57c00';
            if (log.type === 'info') color = '#0891B2';

            row.innerHTML = `
                <span style="color: #999; margin-right: 10px;">[${time}]</span>
                <strong style="color: #555; margin-right: 10px;">[${log.source.toUpperCase()}]</strong>
                <span style="color: ${color};">${log.message}</span>
            `;
            return row;
        }));
        logContainer.scrollTop = logContainer.scrollHeight;
    });

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({
    id: 'manifold',
    label: 'Manifold',
    order: 50,
    mount: mountManifoldScreen
});
