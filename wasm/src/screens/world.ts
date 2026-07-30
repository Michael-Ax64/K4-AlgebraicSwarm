// wasm/src/screens/world.ts

import { screenRegistry } from './registry';
import { createEffect, Signal } from '../reactive';
import {
  activeCircuit, circuitsGrid, selectedCircuitId,
  languagesGrid, documentsGrid
} from '../ledger/grid-state';

import { vfsDb } from '../ledger/fs';
import { providers } from '../config';
import { pushScreen } from '../router';
import { CircuitNode, WorldSettings, LedgerRow } from '../ledger/schema';
import { h } from '../dom';
import { mountChildrenList, createAddChildButton, mountSpecializationEditor } from '../circuit-detail';

type WorldSubTab = 'settings' | 'children' | 'languages' | 'documents' | 'history';

export function mountWorldScreen(container: HTMLElement): () => void {
  const activeSubTab = new Signal<WorldSubTab>('settings');

  const layout = h('div', { className: 'k4-screen-layout' });
  container.appendChild(layout);

  createEffect(() => {
    // Circuit invariant: activeCircuit is always non-null in a mounted screen.
    const c = activeCircuit.value!;
    const tab = activeSubTab.value;
    const allCircuits = circuitsGrid.value;

    mountSpecializationEditor(layout, {
      title: `🌍 World Class: ${c.name}`,
      activeTab: tab,
      tabs: [
        { id: 'settings',  label: 'API Configuration & Directives' },
        { id: 'children',  label: 'Child Circuits & Projects' },
        { id: 'languages', label: 'Linked Lexicons' },
        { id: 'documents', label: 'Master Documents' },
        { id: 'history',   label: 'World Audit Log' }
      ],
      onTabChange: (id) => activeSubTab.value = id as WorldSubTab,
      renderTab: (tab, contentWrapper) => {

    const worldData: WorldSettings = c.specializationData || {
      apiProvider: 'manual',
      apiKey: '',
      apiBaseUrl: '',
      worldDirectives: ''
    };

    // ─── TAB 1: API SETTINGS & DIRECTIVES ──────────────────────────────────
    if (tab === 'settings') {
      const catalog     = providers.value;
      const currentPick = worldData.apiProvider || 'default';

      const persistWorldData = async () => {
        c.specializationData = {
          apiProvider: providerSel.value as any,
          apiKey: keyInput.value,
          apiBaseUrl: urlInput.value,
          worldDirectives: dirInput.value,
        };
        c.updatedAt = Date.now();
        await vfsDb.upsertCircuit(c);
      };

      const providerSel = h('select', { style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' },
        h('option', {
          value: 'default',
          textContent: 'Use Global Default (from Settings)',
          selected: currentPick === 'default' || currentPick === '' || currentPick === 'auto'
        }),
        h('option', {
          value: 'manual',
          textContent: 'Manual (Copy/Paste)',
          selected: currentPick === 'manual'
        }),
        ...catalog.map(p => h('option', {
          value: p.id,
          textContent: `${p.name}  [${p.transport}]`,
          selected: currentPick === p.id
        }))
      ) as HTMLSelectElement;
      providerSel.addEventListener('change', persistWorldData);

      const keyInput = h('input', { type: 'password', value: worldData.apiKey || '', placeholder: 'API Key (if required)...', style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' }) as HTMLInputElement;
      keyInput.addEventListener('change', persistWorldData);

      const urlInput = h('input', { type: 'text', value: worldData.apiBaseUrl || '', placeholder: 'Base URL (e.g. https://api.openai.com/v1)...', style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' }) as HTMLInputElement;
      urlInput.addEventListener('change', persistWorldData);

      const dirInput = h('textarea', { value: worldData.worldDirectives || '', placeholder: 'Macro-directives for this World...', style: 'width: 100%; max-width: 500px; height: 100px; margin-bottom: 20px; resize: vertical;' }) as HTMLTextAreaElement;
      dirInput.addEventListener('change', persistWorldData);

      contentWrapper.append(
        h('label', { className: 'k4-form-label', textContent: 'API Provider' }), providerSel,
        h('label', { className: 'k4-form-label', textContent: 'API Key' }), keyInput,
        h('label', { className: 'k4-form-label', textContent: 'Base URL' }), urlInput,
        h('label', { className: 'k4-form-label', textContent: 'Macro World Directives' }), dirInput,
      );
    }

    // ─── TAB 2: CHILD CIRCUITS & PROJECTS ──────────────────────────────────
    else if (tab === 'children') {
      const childList = mountChildrenList(c.id, allCircuits, {
        showDescription: true,
        emptyMessage: 'No child circuits or projects point to this World as prior.',
      });

      const addChildBtn = createAddChildButton(c.id, {
        label: '+ Add Child Circuit under this World',
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
            className: 'k4-subtle',
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
              l.description ? h('div', { className: 'k4-caption', style: 'margin-top: 2px;', textContent: l.description }) : null
            ),
            h('input', {
              type: 'checkbox',
              checked: isLinked,
              className: 'k4-checkbox-large',
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
        h('h3', { className: 'k4-section-title', textContent: 'Active Lexicons for this World Node' }),
        listCard
      );
    }

    // ─── TAB 4: MASTER DOCUMENTS ───────────────────────────────────────────
    else if (tab === 'documents') {
      const docs = globalDocumentsGrid.value;
      const table = h('table', { className: 'numbers-table k4-table-full' },
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
        tbody.appendChild(h('tr', {}, h('td', { colSpan: 3, className: 'k4-empty-state', style: 'padding: 20px;', textContent: 'No documents in global corpus.' })));
      } else {
        docs.forEach(d => {
          const flags = [d.defaultA ? 'A' : '', d.defaultP ? 'P' : '', d.defaultU ? 'U' : '', d.defaultI ? 'I' : '', d.defaultR ? 'R' : ''].filter(Boolean).join(', ') || 'None';
          tbody.appendChild(h('tr', {},
            h('td', { style: 'font-weight: 600; color: var(--text-primary);' }, d.name),
            h('td', { className: 'k4-caption' }, d.kind),
            h('td', { style: 'font-family: var(--font-mono); font-size: 0.85rem; color: var(--role-bridge);' }, flags)
          ));
        });
      }

      table.appendChild(tbody);
      contentWrapper.append(
        h('h3', { className: 'k4-section-title', textContent: 'Global Corpus Documents' }),
        table
      );
    }

    // ─── TAB 5: WORLD AUDIT LOG ─────────────────────────────────────────────
    else if (tab === 'history') {
      const historyTable = h('table', { className: 'numbers-table k4-table-full' },
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
          tbody.appendChild(h('tr', {}, h('td', { colSpan: 4, className: 'k4-empty-state', style: 'padding: 20px;', textContent: 'No execution turns logged for this World node.' })));
        } else {
          rows.forEach(r => {
            tbody.appendChild(h('tr', {},
              h('td', { style: 'font-weight: bold;' }, `#${r.turnNumber}.${r.seq}`),
              h('td', { style: 'font-weight: bold; color: var(--role-bridge);' }, r.kind),
              h('td', { style: 'font-family: var(--font-mono); font-size: 0.8rem;' }, r.ptrStance ? `[PTR] ${r.ptrStance}` : (r.header || '—')),
              h('td', { className: 'k4-caption' }, new Date(r.createdAt).toLocaleTimeString())
            ));
          });
        }
      })();

      historyTable.appendChild(tbody);
      contentWrapper.append(
        h('h3', { className: 'k4-section-title', textContent: 'World Node Execution Audit Log' }),
        historyTable
      );
    }
      }
    });
  });

  return () => { container.innerHTML = ''; };
}


screenRegistry.register({ id: 'world', label: 'World Settings', order: 12, mount: mountWorldScreen });

