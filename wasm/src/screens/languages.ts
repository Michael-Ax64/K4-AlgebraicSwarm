// wasm/src/screens/languages.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { 
  vocabGrid, selectedLanguageId, languagesGrid, refreshAllGrids
} from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { K4Type, ElementRole, Vocabulary } from '../ledger/schema';
import { h } from '../dom';

export function mountLanguagesScreen(container: HTMLElement): () => void {
  const layout = h('div', { 
    style: 'padding: 20px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; background: var(--bg-deep);' 
  });
  container.appendChild(layout);

  let currentRenderedLangId: string | null = null;
  const editingTermId = new Signal<string | null>(null);

  createEffect(() => {
    const lId = selectedLanguageId.value;
    const languages = languagesGrid.value;

    if (!lId && languages.length > 0) {
      selectedLanguageId.value = languages[0].id;
      return;
    }

    if (!lId) {
      currentRenderedLangId = null;
      layout.replaceChildren(h('div', { 
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: 'Select or create a Language from the left sidebar tree.'
      }));
      return;
    }

    const activeLang = languages.find(l => l.id === lId);
    if (!activeLang) return;

    vfsDb.getVocabulary(lId).then(terms => {
      vocabGrid.value = terms;
    });

    if (currentRenderedLangId !== lId) {
      currentRenderedLangId = lId;
      editingTermId.value = null;
      layout.replaceChildren();

      // 1. EDITABLE LANGUAGE NAME & DESCRIPTION AT TOP
      const nameInput = h('input', {
        value: activeLang.name,
        placeholder: 'Language Name (e.g., Exec Lexicon)...',
        style: 'font-size: 1.2rem; font-weight: bold; width: 100%; margin-bottom: 8px;'
      });

      const descInput = createAutosizingTextarea({
        value: activeLang.description || '',
        placeholder: 'Language Description / Purpose...',
        style: 'width: 100%; min-height: 40px; margin-bottom: 15px; font-size: 0.85rem;'
      });

      const saveLangBtn = h('button', {
        textContent: 'Save Lexicon Header',
        className: 'k4-btn-primary',
        style: 'align-self: flex-start; margin-bottom: 20px;',
        on: { click: async () => {
          activeLang.name = nameInput.value.trim() || activeLang.name;
          activeLang.description = descInput.value.trim();
          activeLang.updatedAt = Date.now();
          await vfsDb.upsertLanguage(activeLang);
          await refreshAllGrids();
        }}
      });

      const headerCard = h('div', {
        style: 'background: var(--bg-surface); padding: 15px; border-radius: 6px; border: 1px solid var(--border-strong); margin-bottom: 20px;'
      },
        h('label', { style: labelStyle, textContent: '📖 Lexicon Name' }), nameInput,
        h('label', { style: labelStyle, textContent: 'Lexicon Description & Purpose' }), descInput,
        saveLangBtn
      );

      // 2. VOCABULARY TABLE (CLICK-TO-EDIT / CONFIRM / CANCEL)
      const tbody = h('tbody');
      const table = h('table', { className: 'numbers-table', style: 'width: 100%; border-collapse: collapse; margin-bottom: 20px;' },
        h('thead', {}, h('tr', {}, 
          h('th', { textContent: 'Term (Domain Noun)', style: 'width: 25%;' }), 
          h('th', { textContent: 'K4 Pole / Edge', style: 'width: 20%;' }), 
          h('th', { textContent: 'Role', style: 'width: 15%;' }),
          h('th', { textContent: 'Description', style: 'width: 35%;' }),
          h('th', { style: 'width: 5%;' })
        )),
        tbody
      );

      createEffect(() => {
        const terms = vocabGrid.value;
        const activeEditingId = editingTermId.value;

        tbody.replaceChildren();

        if (terms.length === 0) {
          tbody.appendChild(h('tr', {}, h('td', { colSpan: 5, style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;', textContent: 'No vocabulary terms defined in this lexicon yet.' })));
        } else {
          terms.forEach(v => {
            const isEditing = activeEditingId === v.id;

            if (isEditing) {
              const termEditInput = h('input', { value: v.term, style: 'width: 100%; font-weight: bold;' });
              
              const poleSel = h('select', { style: 'width: 100%; background: var(--bg-surface);' },
                h('option', { value: 'P', textContent: 'P (Fire / Drive)', selected: v.k4Type === 'P' }),
                h('option', { value: 'U', textContent: 'U (Air / Structure)', selected: v.k4Type === 'U' }),
                h('option', { value: 'I', textContent: 'I (Water / Flow)', selected: v.k4Type === 'I' }),
                h('option', { value: 'R', textContent: 'R (Earth / Ground)', selected: v.k4Type === 'R' }),
                h('option', { value: 'P-U', textContent: 'P-U Edge', selected: v.k4Type === 'P-U' }),
                h('option', { value: 'I-R', textContent: 'I-R Edge', selected: v.k4Type === 'I-R' })
              );

              const roleSel = h('select', { style: 'width: 100%; background: var(--bg-surface);' },
                h('option', { value: 'SPEC', textContent: 'SPEC', selected: v.role === 'SPEC' }),
                h('option', { value: 'MATERIAL', textContent: 'MATERIAL', selected: v.role === 'MATERIAL' }),
                h('option', { value: 'NIL', textContent: 'NIL', selected: v.role === 'NIL' })
              );

              const descEditArea = createAutosizingTextarea({
                value: v.description || '',
                style: 'width: 100%; min-height: 32px; font-size: 0.85rem;'
              });

              const confirmBtn = h('button', {
                textContent: '✓',
                title: 'Confirm Edit',
                style: 'background: var(--health-clear); color: #fff; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-weight: bold; margin-right: 4px;',
                on: { click: async (e: Event) => {
                  e.stopPropagation();
                  v.term = termEditInput.value.trim() || v.term;
                  v.k4Type = poleSel.value as K4Type;
                  v.role = roleSel.value as ElementRole;
                  v.description = descEditArea.value.trim();
                  await vfsDb.upsertVocabulary(v);
                  editingTermId.value = null;
                  vocabGrid.value = await vfsDb.getVocabulary(lId);
                }}
              });

              const cancelBtn = h('button', {
                textContent: '✕',
                title: 'Cancel Edit',
                style: 'background: var(--role-validator); color: #fff; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-weight: bold;',
                on: { click: (e: Event) => {
                  e.stopPropagation();
                  editingTermId.value = null;
                }}
              });

              const editRow = h('tr', { style: 'background: var(--bg-elevated);' },
                h('td', {}, termEditInput),
                h('td', {}, poleSel),
                h('td', {}, roleSel),
                h('td', {}, descEditArea),
                h('td', { style: 'white-space: nowrap;' }, confirmBtn, cancelBtn)
              );

              tbody.appendChild(editRow);
            } else {
              const row = h('tr', {
                style: 'cursor: pointer;',
                on: { click: () => editingTermId.value = (editingTermId.value === v.id ? null : v.id) }
              },
                h('td', { style: 'font-weight: bold; color: var(--text-primary);' }, v.term),
                h('td', {}, h('span', { className: `badge pole-${v.k4Type.toLowerCase()}`, style: 'font-weight: bold; padding: 2px 6px; border-radius: 3px;', textContent: v.k4Type })),
                h('td', {}, h('span', { className: `badge role-${v.role.toLowerCase()}`, style: 'font-size: 0.8rem; padding: 2px 6px; border-radius: 3px;', textContent: v.role })),
                h('td', { style: 'font-size: 0.85rem; color: var(--text-secondary);' }, v.description || '—'),
                h('td', {}, h('button', {
                  textContent: '🗑️',
                  title: 'Delete Term',
                  style: 'background: transparent; border: none; color: var(--health-halted); cursor: pointer;',
                  on: { click: async (e: Event) => {
                    e.stopPropagation();
                    await vfsDb.deleteVocabulary(v.id);
                    vocabGrid.value = await vfsDb.getVocabulary(lId);
                  }}
                }))
              );

              tbody.appendChild(row);
            }
          });
        }
      });

      // 3. ADD ROW FORM
      const termInput = h('input', { placeholder: 'New Domain Noun (e.g., Pull Request)...', style: 'flex: 2; font-size: 0.85rem;' });
      const descAreaInput = createAutosizingTextarea({ placeholder: 'Description...', style: 'flex: 2; font-size: 0.85rem; min-height: 38px;' });

      const poleSel = h('select', { style: 'flex: 1; font-size: 0.85rem; background: var(--bg-surface);' },
        h('option', { value: 'P', textContent: 'P (Fire / Drive)' }),
        h('option', { value: 'U', textContent: 'U (Air / Structure)' }),
        h('option', { value: 'I', textContent: 'I (Water / Flow)' }),
        h('option', { value: 'R', textContent: 'R (Earth / Ground)' }),
        h('option', { value: 'P-U', textContent: 'P-U Edge' }),
        h('option', { value: 'I-R', textContent: 'I-R Edge' })
      );

      const roleSel = h('select', { style: 'flex: 1; font-size: 0.85rem; background: var(--bg-surface);' },
        h('option', { value: 'SPEC', textContent: 'SPEC' }),
        h('option', { value: 'MATERIAL', textContent: 'MATERIAL' }),
        h('option', { value: 'NIL', textContent: 'NIL' })
      );

      const addBtn = h('button', { 
        textContent: '+ Add Row', 
        className: 'k4-btn-primary',
        style: 'padding: 6px 15px; font-weight: bold; height: 38px;',
        on: { click: async () => {
          const val = termInput.value.trim();
          if (!val) return;

          const currentTerms = vocabGrid.peek();
          const existing = currentTerms.find(t => t.term.toLowerCase() === val.toLowerCase());

          const vocab: Vocabulary = {
            id: existing ? existing.id : crypto.randomUUID(),
            languageId: lId,
            term: val,
            k4Type: poleSel.value as K4Type,
            role: roleSel.value as ElementRole,
            description: descAreaInput.value.trim()
          };

          await vfsDb.upsertVocabulary(vocab);
          vocabGrid.value = await vfsDb.getVocabulary(lId);
          termInput.value = '';
          descAreaInput.value = '';
        }}
      });

      const addForm = h('div', { 
        style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); padding: 15px; border-radius: 6px; margin-top: auto;' 
      },
        h('h4', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 10px;', textContent: '+ Add Row' }),
        h('div', { style: 'display: flex; gap: 10px; margin-bottom: 10px;' }, termInput, poleSel, roleSel),
        h('div', { style: 'display: flex; gap: 10px; align-items: center;' }, descAreaInput, addBtn)
      );

      layout.append(headerCard, table, addForm);
    }
  });

  return () => { container.innerHTML = ''; };
}

function createAutosizingTextarea(props: any): HTMLTextAreaElement {
  const area = h('textarea', props) as HTMLTextAreaElement;
  const autoResize = () => {
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  };
  area.addEventListener('input', autoResize);
  setTimeout(autoResize, 0);
  return area;
}

const labelStyle = 'font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px; font-size: 0.85rem;';

screenRegistry.register({ id: 'languages', label: 'Lexicon', order: 11, mount: mountLanguagesScreen });
