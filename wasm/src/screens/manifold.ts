// wasm/src/screens/manifold.ts

import { createEffect } from '../reactive';
import { manifoldLog } from '../state';
import { screenRegistry } from './registry';
import { h } from '../dom';

export function mountManifoldScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column;' });
  container.appendChild(layout);

  const logContainer = h('div', { 
    style: 'flex: 1; overflow-y: auto; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px; font-family: var(--font-mono); font-size: 0.85rem;' 
  });

  const clearBtn = h('button', {
    textContent: 'Clear Telemetry',
    className: 'k4-btn-primary',
    style: 'padding: 4px 12px; font-size: 0.8rem;',
    on: { click: () => { manifoldLog.value = []; } }
  });

  // Top Header (Standalone, No Sub-Tabs)
  const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 12px; margin-bottom: 15px;' },
    h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: '⚡ Manifold Telemetry (Wasm Kernel Stream)' }),
    clearBtn
  );

  const infoCard = h('div', {
    style: 'font-size: 0.85rem; color: var(--text-secondary); background: var(--bg-elevated); border-left: 3px solid var(--role-bridge); padding: 12px; margin-bottom: 20px; line-height: 1.5;'
  },
    h('strong', { textContent: 'Manifold Telemetry ' }),
    h('span', { textContent: 'records internal state transitions, airlock validations, and algebraic execution events directly from Rust Wasm.' })
  );

  layout.append(header, infoCard, logContainer);

  createEffect(() => {
    const logs = manifoldLog.value;
    logContainer.replaceChildren();

    if (logs.length === 0) {
      logContainer.appendChild(h('div', {
        style: 'color: var(--text-muted); font-style: italic; padding: 10px;',
        textContent: 'No manifold telemetry recorded.'
      }));
      return;
    }

    logs.forEach(log => {
      const row = h('div', { style: 'padding: 6px 0; border-bottom: 1px solid var(--border-subtle); display: flex; gap: 10px;' });
      const time = new Date(log.ts).toLocaleTimeString();

      let color = 'var(--text-primary)';
      if (log.type === 'error') color = 'var(--health-halted)';
      if (log.type === 'warn') color = 'var(--health-raises)';
      if (log.type === 'info') color = 'var(--role-bridge)';

      row.append(
        h('span', { style: 'color: var(--text-muted); min-width: 80px;', textContent: `[${time}]` }),
        h('strong', { style: 'color: var(--text-secondary); min-width: 90px;', textContent: `[${log.source.toUpperCase()}]` }),
        h('span', { style: `color: ${color}; flex: 1;`, textContent: log.message })
      );

      logContainer.appendChild(row);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'manifold', label: 'Manifold', order: 50, mount: mountManifoldScreen });

