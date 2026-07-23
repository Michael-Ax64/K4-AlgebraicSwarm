// wasm/src/screens/api-log.ts

import { createEffect } from '../reactive';
import { apiLog, logConfig } from '../state';
import { screenRegistry } from './registry';


export function mountApiLogScreen(container: HTMLElement): () => void {
    const layout = document.createElement('div');
    layout.style.display = 'flex';
    layout.style.flexDirection = 'column';
    layout.style.height = '100%';
    
    layout.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px; flex: 0 0 auto;">
            <h2 style="margin: 0; color: #14161A;">LLM Exchange Log</h2>
            <div>
                <button id="api-clear-btn" style="padding: 4px 12px; margin-left: 10px;">Clear Log</button>
            </div>
        </div>
        <div id="api-log-container" style="flex: 1; overflow-y: auto; background: #fff; border: 1px solid #DAD5CB; border-radius: 4px; padding: 15px; font-family: monospace; font-size: 0.85rem;"></div>
    `;
    
    container.appendChild(layout);

    const logContainer = layout.querySelector('#api-log-container') as HTMLDivElement;
    const clearBtn = layout.querySelector('#api-clear-btn') as HTMLButtonElement;

    clearBtn.addEventListener('click', () => {
        apiLog.value = [];
    });

    function enforceLimit() {
        const max = logConfig.value?.maxEntries || 0;
        if (max > 0 && apiLog.value.length > max) {
            apiLog.value = apiLog.value.slice(-max);
        }
    }

    createEffect(() => {
        enforceLimit();
        const logs = apiLog.value;
        
        if (logs.length === 0) {
            logContainer.innerHTML = '<div style="color: #888; font-style: italic; font-family: system-ui, -apple-system, sans-serif;">No API exchanges logged yet.</div>';
            return;
        }

        logContainer.replaceChildren(...logs.map(log => {
            const row = document.createElement('div');
            row.style.marginBottom = '15px';
            row.style.padding = '10px';
            row.style.borderRadius = '4px';
            row.style.backgroundColor = log.direction === 'out' ? '#e8f5e9' : '#fff';
            row.style.border = '1px solid #DAD5CB';
            
            const time = new Date(log.ts).toISOString().split('T')[1].slice(0, -1);
            const dirIcon = log.direction === 'out' ? '↗ OUT' : '↙ IN';
            
            row.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.8rem; color: #666; font-family: monospace;">
                    <span><strong>${dirIcon}</strong> | Role: ${log.role.toUpperCase()} | Mode: ${log.temperature.toUpperCase()}</span>
                    <span>${time}</span>
                </div>
                <div style="white-space: pre-wrap; font-family: monospace; font-size: 0.85rem; color: #14161A;">${log.bodyText}</div>
                <div style="margin-top: 10px; text-align: right;">
                    <button class="copy-btn" style="padding: 4px 12px; font-size: 0.75rem; cursor:pointer; background: #14161A; color: #fff; border: none; border-radius: 3px;">Copy Text</button>
                </div>
            `;
            
            const copyBtn = row.querySelector('.copy-btn') as HTMLButtonElement;
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(log.bodyText);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.textContent = 'Copy Text', 2000);
            };

            return row;
        }));
        logContainer.scrollTop = logContainer.scrollHeight;
    });

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({
    id: 'log',
    label: 'API Log',
    order: 30,
    mount: mountApiLogScreen
});

