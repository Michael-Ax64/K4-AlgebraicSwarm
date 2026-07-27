// wasm/src/screens/world.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import {
  activeCircuit, circuitsGrid, selectedCircuitId,
  globalLanguagesGrid, globalDocumentsGrid
} from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { CircuitNode, WorldSettings, LedgerRow } from '../ledger/schema';
import { pushScreen } from '../router';
import { h } from '../dom';

type WorldSubTab = 'settings' | 'children' | 'languages' | 'documents' | 'history';

export function mountWorldScreen(container: HTMLElement): () => void {
  const activeSubTab = new Signal<WorldSubTab>('settings');
  const saveStatus = new Signal<string | null>(null);

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 20px;' });
  container.appendChild(layout);

  createEffect(() => {
    const c = activeCircuit.value;
    const tab = activeSubTab.value;
    const status = saveStatus.value;
    const allCircuits = circuitsGrid.value;

    layout.replaceChildren();

    if (!c) {
      layout.appendChild(h('div', {
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: '🔒 Select a Circuit from the context graph.'
      }));
      return;
    }

    // Header
    const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: `🌍 World Class: ${c.name}` }),
      status ? h('span', { style: 'color: var(--health-clear); font-weight: bold; font-size: 0.85rem;', textContent: status }) : h('span')
    );

    // Sub-Nav Bar
    const nav = h('div', { style: 'display: flex; gap: 8px; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px; flex-wrap: wrap;' });
    const tabs: { id: WorldSubTab; label: string }[] = [
      { id: 'settings', label: 'API Configuration & Directives' },
      { id: 'children', label: 'Child Circuits & Projects' },
      { id: 'languages', label: 'Linked Lexicons' },
      { id: 'documents', label: 'Master Documents' },
      { id: 'history', label: 'World Audit Log' }
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

    const worldData: WorldSettings = c.specializationData || {
      apiProvider: 'manual',
      apiKey: '',
      apiBaseUrl: '',
      worldDirectives: ''
    };

    // ─── TAB 1: API SETTINGS & DIRECTIVES ──────────────────────────────────
    if (tab === 'settings') {
      const providerSel = h('select', { style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' },
        h('option', { value: 'manual', textContent: 'Manual (Copy/Paste)', selected: worldData.apiProvider === 'manual' }),
        h('option', { value: 'auto', textContent: 'Auto (Built-in AI / Local)', selected: worldData.apiProvider === 'auto' }),
        h('option', { value: 'openai', textContent: 'OpenAI', selected: worldData.apiProvider === 'openai' }),
        h('option', { value: 'custom', textContent: 'Custom / Local', selected: worldData.apiProvider === 'custom' })
      );

      const keyInput = h('input', { type: 'password', value: worldData.apiKey || '', placeholder: 'API Key (if required)...', style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' });
      const urlInput = h('input', { type: 'text', value: worldData.apiBaseUrl || '', placeholder: 'Base URL (e.g. https://api.openai.com/v1)...', style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' });
      const dirInput = h('textarea', { value: worldData.worldDirectives || '', placeholder: 'Macro-directives for this World...', style: 'width: 100%; max-width: 500px; height: 100px; margin-bottom: 20px; resize: vertical;' });

      const saveBtn = h('button', {
        textContent: 'Save World Settings',
        className: 'k4-btn-primary',
        style: 'align-self: flex-start;',
        on: { click: async () => {
          c.specialization = 'world';
          c.specializationData = {
            apiProvider: providerSel.value as any,
            apiKey: keyInput.value,
            apiBaseUrl: urlInput.value,
            worldDirectives: dirInput.value
          };
          c.updatedAt = Date.now();
          await vfsDb.upsertCircuit(c);
          saveStatus.value = '✓ World Configuration Saved!';
          setTimeout(() => saveStatus.value = null, 2000);
        }}
      });

      contentWrapper.append(
        h('label', { style: labelStyle, textContent: 'API Provider' }), providerSel,
        h('label', { style: labelStyle, textContent: 'API Key' }), keyInput,
        h('label', { style: labelStyle, textContent: 'Base URL' }), urlInput,
        h('label', { style: labelStyle, textContent: 'Macro World Directives' }), dirInput,
        saveBtn
      );
    }

    // ─── TAB 2: CHILD CIRCUITS & PROJECTS ──────────────────────────────────
    else if (tab === 'children') {
      const childNodes = allCircuits.filter(other => other.priorId === c.id && other.priorId !== '__TRASH__');

      const childList = h('div', { style: 'display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;' });

      if (childNodes.length === 0) {
        childList.appendChild(h('div', {
          style: 'color: var(--text-muted); font-style: italic;',
          textContent: 'No child circuits or projects point to this World as prior.'
        }));
      } else {
        childNodes.forEach(child => {
          const badge = child.specialization === 'project' ? '📁' : child.specialization === 'view' ? '👁️' : '⌖';
          const card = h('div', {
            style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 6px; padding: 12px; display: flex; justify-content: space-between; align-items: center;'
          },
            h('div', {},
              h('strong', { style: 'color: var(--text-primary); font-size: 0.95rem;', textContent: `${badge} ${child.name}` }),
              h('div', { style: 'font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;', textContent: child.description || '(No description)' })
            ),
            h('button', {
              textContent: 'Select Circuit',
              className: 'k4-btn-primary',
              style: 'padding: 4px 10px; font-size: 0.8rem;',
              on: { click: () => {
                selectedCircuitId.value = child.id;
                pushScreen('chat');
              }}
            })
          );
          childList.appendChild(card);
        });
      }

      // Quick Create Child Button
      const addChildBtn = h('button', {
        textContent: '+ Add Child Circuit under this World',
        className: 'k4-btn-primary',
        style: 'align-self: flex-start;',
        on: { click: async () => {
          const now = Date.now();
          const fresh: CircuitNode = {
            id: `circ-${now}-${Math.random().toString(36).substring(2, 7)}`,
            priorId: c.id,
            specialization: 'circuit',
            name: 'New Child Circuit',
            description: '',
            doc0: '',
            physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
            activeFace: 'P',
            heldAbsentVar: 'I',
            createdAt: now,
            updatedAt: now,
          };
          await vfsDb.upsertCircuit(fresh);
          circuitsGrid.value = await vfsDb.getAllCircuits();
          selectedCircuitId.value = fresh.id;
        }}
      });

      contentWrapper.append(
        h('h3', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 12px;', textContent: 'Direct Descendants' }),
        childList,
        addChildBtn
      );
    }

    // ─── TAB 3: LINKED LEXICONS ─────────────────────────────────────────────
    else if (tab === 'languages') {
      const langs = globalLanguagesGrid.value;
      const listCard = h('div', { style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px;' });

      (async () => {
        const selections = await vfsDb.getCircuitLangSelections(c.id);
        const activeSet = new Set(selections.filter(s => s.active).map(s => s.languageId));

        listCard.replaceChildren();

        if (langs.length === 0) {
          listCard.appendChild(h('div', {
            style: 'color: var(--text-muted); font-style: italic;',
            textContent: 'No global languages defined. Create one on the top Global Languages screen.'
          }));
          return;
        }

        langs.forEach(l => {
          const isLinked = activeSet.has(l.id);
          const row = h('div', {
            style: `display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-subtle); align-items: center; background: ${isLinked ? 'var(--bg-elevated)' : 'transparent'};`
          },
            h('div', {},
              h('strong', { textContent: `📖 ${l.name}`, style: `color: ${isLinked ? 'var(--role-bridge)' : 'var(--text-primary)'};` }),
              l.description ? h('div', { style: 'font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;', textContent: l.description }) : null
            ),
            h('input', {
              type: 'checkbox',
              checked: isLinked,
              style: 'cursor: pointer; transform: scale(1.2);',
              on: { change: async (e: Event) => {
                const checked = (e.target as HTMLInputElement).checked;
                await vfsDb.upsertCircuitLangSelection({
                  id: `${c.id}:${l.id}`,
                  circuitId: c.id,
                  languageId: l.id,
                  active: checked
                });
              }}
            })
          );
          listCard.appendChild(row);
        });
      })();

      contentWrapper.append(
        h('h3', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 10px;', textContent: 'Active Lexicons for this World Node' }),
        listCard
      );
    }

    // ─── TAB 4: MASTER DOCUMENTS ───────────────────────────────────────────
    else if (tab === 'documents') {
      const docs = globalDocumentsGrid.value;
      const table = h('table', { className: 'numbers-table', style: 'width: 100%; border-collapse: collapse;' },
        h('thead', {},
          h('tr', {},
            h('th', { textContent: 'Document Name', style: 'width: 50%;' }),
            h('th', { textContent: 'Kind', style: 'width: 20%;' }),
            h('th', { textContent: 'Defaults (A / P / U / I / R)' })
          )
        )
      );

      const tbody = h('tbody');
      if (docs.length === 0) {
        tbody.appendChild(h('tr', {}, h('td', { colSpan: 3, style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;', textContent: 'No documents in global corpus.' })));
      } else {
        docs.forEach(d => {
          const flags = [d.defaultA ? 'A' : '', d.defaultP ? 'P' : '', d.defaultU ? 'U' : '', d.defaultI ? 'I' : '', d.defaultR ? 'R' : ''].filter(Boolean).join(', ') || 'None';
          tbody.appendChild(h('tr', {},
            h('td', { style: 'font-weight: 600; color: var(--text-primary);' }, d.name),
            h('td', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, d.kind),
            h('td', { style: 'font-family: var(--font-mono); font-size: 0.85rem; color: var(--role-bridge);' }, flags)
          ));
        });
      }

      table.appendChild(tbody);
      contentWrapper.append(
        h('h3', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 10px;', textContent: 'Global Corpus Documents' }),
        table
      );
    }

    // ─── TAB 5: WORLD AUDIT LOG ─────────────────────────────────────────────
    else if (tab === 'history') {
      const historyTable = h('table', { className: 'numbers-table', style: 'width: 100%; border-collapse: collapse;' },
        h('thead', {},
          h('tr', {},
            h('th', { textContent: 'Turn.Seq' }),
            h('th', { textContent: 'Kind' }),
            h('th', { textContent: 'Header Signature / PTR' }),
            h('th', { textContent: 'Timestamp' })
          )
        )
      );

      const tbody = h('tbody');

      (async () => {
        const rows: LedgerRow[] = await vfsDb.getLedgerRows(c.id);
        tbody.replaceChildren();

        if (rows.length === 0) {
          tbody.appendChild(h('tr', {}, h('td', { colSpan: 4, style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;', textContent: 'No execution turns logged for this World node.' })));
        } else {
          rows.forEach(r => {
            tbody.appendChild(h('tr', {},
              h('td', { style: 'font-weight: bold;' }, `#${r.turnNumber}.${r.seq}`),
              h('td', { style: 'font-weight: bold; color: var(--role-bridge);' }, r.kind),
              h('td', { style: 'font-family: var(--font-mono); font-size: 0.8rem;' }, r.ptrStance ? `[PTR] ${r.ptrStance}` : (r.header || '—')),
              h('td', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, new Date(r.createdAt).toLocaleTimeString())
            ));
          });
        }
      })();

      historyTable.appendChild(tbody);
      contentWrapper.append(
        h('h3', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 10px;', textContent: 'World Node Execution Audit Log' }),
        historyTable
      );
    }
  });

  return () => { container.innerHTML = ''; };
}

const labelStyle = 'font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px; font-size: 0.85rem;';

screenRegistry.register({ id: 'world', label: 'World Settings', order: 12, mount: mountWorldScreen });
