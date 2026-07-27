// wasm/src/screens/api-log.ts

import { createEffect } from '../reactive';
import { apiLog, logConfig } from '../state';
import { screenRegistry } from './registry';
import { h } from '../dom';

export function mountApiLogScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column;' });
  container.appendChild(layout);

  const logContainer = h('div', { 
    style: 'flex: 1; overflow-y: auto; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px; font-family: var(--font-mono); font-size: 0.85rem;' 
  });

  const clearBtn = h('button', {
    textContent: 'Clear Log',
    className: 'k4-btn-primary',
    style: 'padding: 4px 12px; font-size: 0.8rem;',
    on: { click: () => { apiLog.value = []; } }
  });

  // Top Header (Standalone, No Sub-Tabs)
  const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 12px; margin-bottom: 15px;' },
    h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: '🌐 LLM Exchange Log (API Stream)' }),
    clearBtn
  );

  const infoCard = h('div', {
    style: 'font-size: 0.85rem; color: var(--text-secondary); background: var(--bg-elevated); border-left: 3px solid var(--role-bridge); padding: 12px; margin-bottom: 20px; line-height: 1.5;'
  },
    h('strong', { textContent: 'API Log ' }),
    h('span', { textContent: 'captures raw HTTP completions sent toward external LLM providers or local runtimes.' })
  );

  layout.append(header, infoCard, logContainer);

  createEffect(() => {
    const logs = apiLog.value;
    logContainer.replaceChildren();

    if (logs.length === 0) {
      logContainer.appendChild(h('div', {
        style: 'color: var(--text-muted); font-style: italic; padding: 10px;',
        textContent: 'No API exchanges logged yet.'
      }));
      return;
    }

    logs.forEach(log => {
      const isOut = log.direction === 'out';
      const dirIcon = isOut ? '↗ OUT' : '↙ IN';
      const time = new Date(log.ts).toLocaleTimeString();

      const copyBtn = h('button', {
        textContent: 'Copy Text',
        style: 'padding: 4px 10px; font-size: 0.75rem; cursor: pointer; background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border-strong); border-radius: 3px;',
        on: { click: () => {
          navigator.clipboard.writeText(log.bodyText);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => copyBtn.textContent = 'Copy Text', 2000);
        }}
      });

      const row = h('div', {
        style: `margin-bottom: 12px; padding: 12px; border-radius: 4px; background: ${isOut ? 'var(--bg-elevated)' : 'var(--bg-surface)'}; border: 1px solid var(--border-subtle);`
      },
        h('div', { style: 'display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);' },
          h('span', {}, h('strong', { style: `color: ${isOut ? 'var(--role-bridge)' : 'var(--health-clear)'};` }, dirIcon), ` | Role: ${log.role.toUpperCase()} | Temp: ${log.temperature.toUpperCase()}`),
          h('span', { textContent: time })
        ),
        h('div', { style: 'white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-primary); margin-bottom: 8px;', textContent: log.bodyText }),
        h('div', { style: 'text-align: right;' }, copyBtn)
      );

      logContainer.appendChild(row);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'log', label: 'API Log', order: 40, mount: mountApiLogScreen });
