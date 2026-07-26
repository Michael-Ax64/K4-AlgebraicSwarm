// wasm/src/screens/world.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import {
  activeWorldConfig, worldsGrid, worldLanguagesGrid, worldDocumentsGrid,
  projectsGrid, activeProject, selectedProjectId, viewsGrid, selectedViewId,
  selectedDocumentId, selectedLanguageId
} from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { Project, View, Circuit, Language, Document, LedgerRow } from '../ledger/schema';
import { pushScreen } from '../router';
import { h } from '../dom';

type WorldSubTab = 'projects' | 'circuits' | 'documents' | 'languages' | 'history' | 'settings';

export function mountWorldScreen(container: HTMLElement): () => void {
  const activeSubTab = new Signal<WorldSubTab>('projects');
  const saveStatus = new Signal<string | null>(null);

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 20px;' });
  container.appendChild(layout);

  createEffect(() => {
    const world = activeWorldConfig.value;
    const tab = activeSubTab.value;
    const status = saveStatus.value;

    layout.replaceChildren();

    if (!world) {
      layout.appendChild(h('div', { 
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: '🔒 Select a World from the left context pane.'
      }));
      return;
    }

    // --- HEADER ---
    const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: `🌍 World: ${world.name}` }),
      status ? h('span', { style: 'color: var(--health-clear); font-weight: bold; font-size: 0.85rem;', textContent: status }) : h('span')
    );

    // --- SUB-NAV BAR ---
    const nav = h('div', { style: 'display: flex; gap: 8px; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px; flex-wrap: wrap;' });
    const tabs: { id: WorldSubTab, label: string }[] = [
      { id: 'projects', label: 'Projects & Views' },
      { id: 'circuits', label: 'Circuits (AC Models)' },
      { id: 'documents', label: 'Master Documents' },
      { id: 'languages', label: 'Languages (Lexicons)' },
      { id: 'history', label: 'World Log' },
      { id: 'settings', label: 'Settings & Notes' }
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

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 1: PROJECTS & VIEWS
    // ────────────────────────────────────────────────────────────────────────
    if (tab === 'projects') {
      const projectsList = h('div', { style: 'display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px;' });

      (async () => {
        const projs = await vfsDb.getProjects(world.id);
        projectsList.replaceChildren();

        if (projs.length === 0) {
          projectsList.appendChild(h('div', { textContent: 'No projects created yet.', style: 'color: var(--text-muted); font-style: italic;' }));
          return;
        }

        for (const p of projs) {
          const views = await vfsDb.getViews(p.id);
          const isPActive = selectedProjectId.value === p.id;

          const pCard = h('div', {
            style: `background: var(--bg-surface); border: 1px solid ${isPActive ? 'var(--role-bridge)' : 'var(--border-strong)'}; border-radius: 6px; padding: 15px;`
          });

          const pHeader = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; margin-bottom: 12px;' },
            h('div', {},
              h('strong', { style: 'font-size: 1rem; color: var(--text-primary);', textContent: `📁 ${p.name}` }),
              p.description ? h('div', { style: 'font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;', textContent: p.description }) : null
            ),
            h('button', {
              textContent: isPActive ? 'Active Project' : 'Select Project',
              className: 'k4-btn-primary',
              style: 'padding: 4px 10px; font-size: 0.8rem;',
              on: { click: () => {
                selectedProjectId.value = p.id;
                pushScreen('chat');
              }}
            })
          );

          const viewsContainer = h('div', { style: 'padding-left: 15px; border-left: 2px solid var(--border-subtle);' });
          if (views.length === 0) {
            viewsContainer.appendChild(h('div', { textContent: 'No views defined.', style: 'font-size: 0.8rem; color: var(--text-muted); font-style: italic;' }));
          } else {
            views.forEach(v => {
              const isVActive = selectedViewId.value === v.id;
              const vRow = h('div', {
                style: `display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: ${isVActive ? 'var(--bg-elevated)' : 'transparent'}; border-radius: 4px; margin-bottom: 4px; cursor: pointer;`,
                on: { click: () => {
                  selectedProjectId.value = p.id;
                  selectedViewId.value = v.id;
                  pushScreen('chat');
                }}
              },
                h('span', { style: `font-size: 0.88rem; font-weight: 600; color: ${isVActive ? 'var(--role-controller)' : 'var(--text-secondary)'};`, textContent: `👁️ ${v.name}` }),
                h('span', { style: 'font-size: 0.75rem; font-family: var(--font-mono); color: var(--text-muted); text-align: right; margin-left: auto;', textContent: `AC Baseline Physics: ω=${v.innateOmega}, R=${v.innateR}, L=${v.innateL}, C=${v.innateC}` })
              );
              viewsContainer.appendChild(vRow);
            });
          }

          pCard.append(pHeader, viewsContainer);
          projectsList.appendChild(pCard);
        }
      })();

      // Create Project Form
      const newProjName = h('input', { placeholder: 'Project Name (e.g. I want a map)', style: 'width: 100%; max-width: 400px; margin-bottom: 8px;' });
      const newProjDesc = h('input', { placeholder: 'Project Directives / Description...', style: 'width: 100%; max-width: 400px; margin-bottom: 12px;' });
      const createProjBtn = h('button', {
        textContent: '+ Create Project',
        className: 'k4-btn-primary',
        on: { click: async () => {
          const name = newProjName.value.trim();
          if (!name) return;
          const now = Date.now();
          const newProj: Project = {
            id: `proj-${world.id}-${now}`,
            worldId: world.id,
            name,
            description: newProjDesc.value.trim(),
            createdAt: now,
            updatedAt: now,
          };
          await vfsDb.upsertProject(newProj);

          // Auto-create default Main View for live scratchpad principle
          const defaultView: View = {
            id: `view-${newProj.id}-main`,
            projectId: newProj.id,
            name: 'Main View',
            description: 'Default View rotation',
            doc0: '',
            innateOmega: 1.0, innateR: 10, innateL: 10, innateC: 0.1,
            createdAt: now, updatedAt: now,
          };
          await vfsDb.upsertView(defaultView);

          projectsGrid.value = await vfsDb.getProjects(world.id);
          selectedProjectId.value = newProj.id;
          selectedViewId.value = defaultView.id;
          newProjName.value = '';
          newProjDesc.value = '';
        }}
      });

      const createCard = h('div', { style: 'background: var(--bg-surface); padding: 15px; border-radius: 6px; border: 1px solid var(--border-strong); max-width: 500px;' },
        h('h4', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 8px;', textContent: 'Add New Project' }),
        newProjName, newProjDesc, createProjBtn
      );

      contentWrapper.append(
        h('h3', { textContent: 'Projects & Views in this World', style: 'margin: 0 0 12px 0; color: var(--text-primary);' }),
        projectsList, createCard
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 2: CIRCUITS (WORLD ROLL-UP)
    // ────────────────────────────────────────────────────────────────────────
    else if (tab === 'circuits') {
      const circuitsTable = h('table', { className: 'numbers-table', style: 'width: 100%; border-collapse: collapse;' },
        h('thead', {},
          h('tr', {},
            h('th', { textContent: 'Circuit Name' }),
            h('th', { textContent: 'View' }),
            h('th', { textContent: 'Poles (Active / Held)' }),
            h('th', { textContent: 'AC Physics (ω : R : L : C)' }),
            h('th', { textContent: 'Diagnostic Vocabulary' }),
            h('th', { textContent: 'Reward Question' })
          )
        )
      );

      const tbody = h('tbody');

      (async () => {
        const projs = await vfsDb.getProjects(world.id);
        const allCircuits: { circuit: Circuit; viewName: string }[] = [];

        for (const p of projs) {
          const views = await vfsDb.getViews(p.id);
          for (const v of views) {
            const circs = await vfsDb.getCircuits(v.id);
            circs.forEach(c => allCircuits.push({ circuit: c, viewName: v.name }));
          }
        }

        tbody.replaceChildren();

        if (allCircuits.length === 0) {
          tbody.appendChild(h('tr', {}, h('td', { colSpan: 6, style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;', textContent: 'No circuit models defined in this World.' })));
        } else {
          allCircuits.forEach(({ circuit, viewName }) => {
            tbody.appendChild(h('tr', {},
              h('td', { style: 'font-weight: bold; color: var(--text-primary);' }, circuit.name),
              h('td', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, viewName),
              h('td', { style: 'font-size: 0.85rem;' }, `${circuit.activeFace} (held ${circuit.heldAbsentVar})`),
              h('td', { style: 'font-family: var(--font-mono); font-size: 0.8rem; color: var(--role-bridge);' }, `ω${circuit.omega} : R${circuit.r} : L${circuit.l} : C${circuit.c}`),
              h('td', { style: 'font-size: 0.78rem; color: var(--text-secondary); font-family: var(--font-mono);' }, circuit.diagnosticVocab?.join(', ') || '—'),
              h('td', { style: 'font-size: 0.8rem; color: var(--text-secondary); font-style: italic;' }, circuit.rewardQuestion || '—')
            ));
          });
        }
      })();

      circuitsTable.appendChild(tbody);
      contentWrapper.append(
        h('h3', { textContent: 'World AC Circuit Models', style: 'margin: 0 0 10px 0; color: var(--text-primary);' }),
        circuitsTable
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 3: MASTER DOCUMENTS
    // ────────────────────────────────────────────────────────────────────────
    else if (tab === 'documents') {
      const uploadWorldDocBtn = h('button', {
        textContent: '+ Add World Master Document',
        className: 'k4-btn-primary',
        style: 'margin-bottom: 15px; align-self: flex-start;',
        on: { click: () => {
          selectedDocumentId.value = 'new';
          pushScreen('doc-editor');
        }}
      });

      const docs = worldDocumentsGrid.value;
      const table = h('table', { className: 'numbers-table', style: 'width: 100%; border-collapse: collapse;' },
        h('thead', {},
          h('tr', {},
            h('th', { textContent: 'Document Name', style: 'width: 50%;' }),
            h('th', { textContent: 'Type', style: 'width: 15%;' }),
            h('th', { textContent: 'Default Inclusions (A / P / U / I / R)' })
          )
        )
      );

      const tbody = h('tbody');
      if (docs.length === 0) {
        tbody.appendChild(h('tr', {}, h('td', { colSpan: 3, style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;', textContent: 'No World master documents created.' })));
      } else {
        docs.forEach(d => {
          const defaultFlags = [
            d.defaultA ? 'A' : '',
            d.defaultP ? 'P' : '',
            d.defaultU ? 'U' : '',
            d.defaultI ? 'I' : '',
            d.defaultR ? 'R' : ''
          ].filter(Boolean).join(', ') || 'None';

          const row = h('tr', {
            style: 'cursor: pointer;',
            on: { click: () => {
              selectedDocumentId.value = d.id;
              pushScreen('doc-editor');
            }}
          },
            h('td', { style: 'font-weight: 600; color: var(--text-primary);' }, d.name),
            h('td', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, d.kind),
            h('td', { style: 'font-family: var(--font-mono); font-size: 0.85rem; color: var(--role-bridge);' }, defaultFlags)
          );
          tbody.appendChild(row);
        });
      }

      table.appendChild(tbody);
      contentWrapper.append(uploadWorldDocBtn, table);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 4: LANGUAGES (LINK GLOBAL LEXICONS)
    // ────────────────────────────────────────────────────────────────────────
    else if (tab === 'languages') {
      const listCard = h('div', { style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px; margin-bottom: 20px;' });

      (async () => {
        const allLanguages = await vfsDb.getAllLanguages();
        const worldSels = await vfsDb.getWorldLangSelections(world.id);
        const activeLangIds = new Set(worldSels.filter(s => s.active).map(s => s.languageId));

        listCard.replaceChildren();

        if (allLanguages.length === 0) {
          listCard.appendChild(h('div', { textContent: 'No global languages created yet. Visit the top-level Languages tab to create one.', style: 'color: var(--text-muted); font-style: italic;' }));
        } else {
          allLanguages.forEach(l => {
            const isLinked = activeLangIds.has(l.id);
            const lRow = h('div', { 
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
                  await vfsDb.upsertWorldLangSelection({
                    id: `${world.id}:${l.id}`,
                    worldId: world.id,
                    languageId: l.id,
                    active: checked
                  });
                  worldLanguagesGrid.value = await vfsDb.getLanguages('world', world.id);
                }} 
              })
            );
            listCard.appendChild(lRow);
          });
        }
      })();

      const newLangInput = h('input', { placeholder: 'New Language Name', style: 'flex: 1;' });
      const addLangBtn = h('button', { textContent: 'Create & Link Language', className: 'k4-btn-primary' });
      
      addLangBtn.addEventListener('click', async () => {
        const val = newLangInput.value.trim();
        if (!val) return;
        const now = Date.now();
        const newLang: Language = {
          id: `lang-${now}-${Math.random().toString(36).substring(2, 7)}`,
          name: val,
          description: '',
          createdAt: now,
          updatedAt: now,
        };
        await vfsDb.upsertLanguage(newLang);
        await vfsDb.upsertWorldLangSelection({
          id: `${world.id}:${newLang.id}`,
          worldId: world.id,
          languageId: newLang.id,
          active: true,
        });
        worldLanguagesGrid.value = await vfsDb.getLanguages('world', world.id);
        newLangInput.value = '';
        activeSubTab.value = 'settings';
        setTimeout(() => activeSubTab.value = 'languages', 10);
      });

      const createFormRow = h('div', { style: 'display: flex; gap: 10px; margin-top: 15px;' }, newLangInput, addLangBtn);

      contentWrapper.append(
        h('h3', { textContent: 'Link Global Languages to World', style: 'margin: 0 0 8px 0; color: var(--text-primary);' }),
        h('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;', textContent: 'Select which cross-world lexicons are active for Projects and Views inside this World:' }),
        listCard,
        h('strong', { style: 'font-size: 0.85rem; color: var(--text-secondary); display: block; margin-top: 10px;', textContent: 'Quick Create Global Language:' }),
        createFormRow
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 5: WORLD LOG (CROSS-PROJECT ROLLUP)
    // ────────────────────────────────────────────────────────────────────────
    else if (tab === 'history') {
      const historyTable = h('table', { className: 'numbers-table', style: 'width: 100%; border-collapse: collapse;' },
        h('thead', {},
          h('tr', {},
            h('th', { textContent: 'Turn.Seq' }),
            h('th', { textContent: 'View' }),
            h('th', { textContent: 'Kind' }),
            h('th', { textContent: 'Header Signature / PTR' }),
            h('th', { textContent: 'Timestamp' })
          )
        )
      );

      const tbody = h('tbody');

      (async () => {
        const projs = await vfsDb.getProjects(world.id);
        const allRows: { row: LedgerRow; viewName: string }[] = [];

        for (const p of projs) {
          const views = await vfsDb.getViews(p.id);
          for (const v of views) {
            const rows = await vfsDb.getLedgerRows(v.id);
            rows.forEach(r => allRows.push({ row: r, viewName: v.name }));
          }
        }

        allRows.sort((a, b) => b.row.createdAt - a.row.createdAt);
        tbody.replaceChildren();

        if (allRows.length === 0) {
          tbody.appendChild(h('tr', {}, h('td', { colSpan: 5, style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;', textContent: 'No execution history recorded in this World yet.' })));
        } else {
          allRows.forEach(({ row, viewName }) => {
            tbody.appendChild(h('tr', {},
              h('td', { style: 'font-weight: bold;' }, `#${row.turnNumber}.${row.seq}`),
              h('td', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, viewName),
              h('td', { style: 'font-weight: bold; color: var(--role-bridge);' }, row.kind),
              h('td', { style: 'font-family: var(--font-mono); font-size: 0.8rem;' }, row.ptrStance ? `[PTR] ${row.ptrStance}` : (row.header || '—')),
              h('td', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, new Date(row.createdAt).toLocaleTimeString())
            ));
          });
        }
      })();

      historyTable.appendChild(tbody);
      contentWrapper.append(
        h('h3', { textContent: 'World Cross-Project Audit Log', style: 'margin: 0 0 10px 0; color: var(--text-primary);' }),
        historyTable
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUB-TAB 6: SETTINGS & NOTES
    // ────────────────────────────────────────────────────────────────────────
    else if (tab === 'settings') {
      const nameInput = h('input', { value: world.name, style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' });
      const notesInput = h('textarea', { value: world.description || '', style: 'width: 100%; max-width: 500px; height: 100px; margin-bottom: 20px; resize: vertical;', placeholder: 'World notes, directives, or macro-context...' });
      
      const providerSel = h('select', { style: 'width: 100%; max-width: 500px; margin-bottom: 15px;' },
        h('option', { value: 'manual', textContent: 'Manual (Copy/Paste)', selected: world.apiProvider === 'manual' }),
        h('option', { value: 'auto', textContent: 'Auto (Built-in AI / Local)', selected: world.apiProvider === 'auto' }),
        h('option', { value: 'openai', textContent: 'OpenAI', selected: world.apiProvider === 'openai' }),
        h('option', { value: 'custom', textContent: 'Custom / Local', selected: world.apiProvider === 'custom' })
      );
      const keyInput = h('input', { type: 'password', value: world.apiKey || '', style: 'width: 100%; max-width: 500px; margin-bottom: 15px;', placeholder: 'API Key (if required)' });
      const urlInput = h('input', { type: 'text', value: world.apiBaseUrl || '', style: 'width: 100%; max-width: 500px; margin-bottom: 20px;', placeholder: 'Base URL' });

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
        h('label', { textContent: 'World Notes & Directives', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), notesInput,
        h('h3', { textContent: 'API Configuration', style: 'margin-top: 10px; border-bottom: 1px solid var(--border-strong); padding-bottom: 5px; margin-bottom: 15px; max-width: 500px;' }),
        h('label', { textContent: 'Provider', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), providerSel,
        h('label', { textContent: 'API Key', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), keyInput,
        h('label', { textContent: 'Base URL', style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px;' }), urlInput,
        saveBtn
      );
    }
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'world', label: 'World', order: 10, mount: mountWorldScreen });
