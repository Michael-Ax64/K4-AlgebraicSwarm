// wasm/src/screens/console.ts

import { createEffect } from '../reactive';
import { consoleGrid, globalConsoleGrid, activeCircuit } from '../ledger/grid-state';
import { screenRegistry } from './registry';
import { h } from '../dom';

export function mountConsoleScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 15px;' });
  container.appendChild(layout);

  const logContainer = h('div', { 
    style: 'flex: 1; overflow-y: auto; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 12px; font-family: var(--font-mono); font-size: 0.85rem;' 
  });

  layout.append(
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 10px;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: 'Console Stream' })
    ),
    logContainer
  );

  createEffect(() => {
    const circ = activeCircuit.value;
    const logs = circ ? consoleGrid.value : globalConsoleGrid.value;

    logContainer.replaceChildren();

    if (logs.length === 0) {
      logContainer.appendChild(h('div', {
        style: 'color: var(--text-muted); font-style: italic; padding: 10px;',
        textContent: circ ? `No console events recorded for ${circ.name} yet.` : 'No console events recorded.'
      }));
      return;
    }

    logs.forEach(log => {
      const row = h('div', { style: 'padding: 4px 0; border-bottom: 1px solid var(--border-subtle);' });
      const time = new Date(log.createdAt).toLocaleTimeString();
      let color = 'var(--text-primary)';
      if (log.severity === 'error') color = 'var(--health-halted)';
      if (log.severity === 'warn') color = 'var(--health-raises)';
      if (log.severity === 'notice') color = 'var(--role-bridge)';

      row.append(
        h('span', { style: 'color: var(--text-muted); margin-right: 10px;', textContent: `[${time}]` }),
        h('strong', { style: 'color: var(--text-secondary); margin-right: 10px;', textContent: `[${log.category.toUpperCase()}]` }),
        h('span', { style: `color: ${color};`, textContent: log.message })
      );
      logContainer.appendChild(row);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'console', label: 'Console', order: 100, mount: mountConsoleScreen });
