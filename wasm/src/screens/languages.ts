// wasm/src/screens/languages.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { 
  vocabGrid, selectedLanguageId, addVocabTerm,
  worldLanguagesGrid
} from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { K4Type, ElementRole, Language } from '../ledger/schema';
import { h } from '../dom';

export function mountLanguagesScreen(container: HTMLElement): () => void {
  const allLanguagesSignal = new Signal<Language[]>([]);

  const listPane = h('div', { 
    style: 'flex: 0 0 300px; background: var(--bg-panel); border-right: 1px solid var(--border-strong); overflow-y: auto; padding: 15px; display: flex; flex-direction: column;' 
  });
  
  const editorPane = h('div', { 
    style: 'flex: 1; padding: 20px; overflow-y: auto; background: var(--bg-deep); display: flex; flex-direction: column;' 
  });

  const layout = h('div', { style: 'display: flex; height: 100%; width: 100%;' }, listPane, editorPane);
  container.appendChild(layout);

  // Load all global languages
  const refreshGlobalLanguages = async () => {
    const langs = await vfsDb.getAllLanguages();
    allLanguagesSignal.value = langs;
  };
  refreshGlobalLanguages();

  // 1. LEFT PANE: Global Languages List & Creation Form
  createEffect(() => {
    const languages = allLanguagesSignal.value;
    const activeLId = selectedLanguageId.value;

    listPane.replaceChildren();

    listPane.appendChild(h('h3', { 
      style: 'margin-top: 0; margin-bottom: 12px; color: var(--text-primary); font-size: 0.95rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;',
      textContent: '📖 Global Languages (Cross-World Pool)' 
    }));

    // Auto-select first language if none active
    if (!activeLId && languages.length > 0) {
      selectedLanguageId.value = languages[0].id;
      return;
    }

    if (languages.length === 0) {
      listPane.appendChild(h('div', { 
        style: 'color: var(--text-muted); font-style: italic; padding: 10px 0; font-size: 0.85rem;',
        textContent: 'No global languages created yet.' 
      }));
    } else {
      languages.forEach(lang => {
        const isActive = activeLId === lang.id;
        const item = h('div', {
          className: `tree-item ${isActive ? 'active' : ''}`,
          style: `padding: 10px; border-radius: 4px; margin-bottom: 6px; background: ${isActive ? 'var(--bg-elevated)' : 'var(--bg-surface)'}; border-left: 3px solid ${isActive ? 'var(--role-bridge)' : 'transparent'}; cursor: pointer; border: 1px solid var(--border-subtle);`,
          on: { click: () => selectedLanguageId.value = lang.id }
        },
          h('strong', { style: 'display: block; font-size: 0.88rem; color: var(--text-primary);', textContent: `📖 ${lang.name}` }),
          lang.description ? h('div', { style: 'font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;', textContent: lang.description }) : null
        );
        listPane.appendChild(item);
      });
    }

    // --- FORM: ADD NEW GLOBAL LANGUAGE ---
    const newLangInput = h('input', { 
      placeholder: 'Language Name (e.g. Exec Lexicon)', 
      style: 'width: 100%; margin-bottom: 8px; font-size: 0.85rem;' 
    });

    const descInput = h('input', { 
      placeholder: 'Description / Purpose...', 
      style: 'width: 100%; margin-bottom: 8px; font-size: 0.85rem;' 
    });

    const addLangBtn = h('button', {
      textContent: '+ Create Global Language',
      className: 'k4-btn-primary',
      style: 'width: 100%; padding: 8px; font-weight: bold; font-size: 0.8rem;',
      on: { click: async () => {
        const name = newLangInput.value.trim();
        if (!name) return;

        const now = Date.now();
        const newLang: Language = {
          id: `lang-${now}-${Math.random().toString(36).substring(2, 7)}`,
          name,
          description: descInput.value.trim(),
          createdAt: now,
          updatedAt: now,
        };

        await vfsDb.upsertLanguage(newLang);
        newLangInput.value = '';
        descInput.value = '';
        await refreshGlobalLanguages();
        selectedLanguageId.value = newLang.id;
      }}
    });

    const addLangForm = h('div', { 
      style: 'margin-top: auto; padding-top: 15px; border-top: 1px solid var(--border-strong);' 
    },
      h('strong', { style: 'font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 6px;', textContent: 'Create New Language' }),
      newLangInput,
      descInput,
      addLangBtn
    );

    listPane.appendChild(addLangForm);
  });

  // 2. RIGHT PANE: Selected Lexicon Vocabulary Terms Table & Editor
  createEffect(() => {
    const lId = selectedLanguageId.value;
    const vocab = vocabGrid.value;

    editorPane.replaceChildren();

    if (!lId) {
      editorPane.appendChild(h('div', { 
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: 'Select or create a Language from the left panel.'
      }));
      return;
    }

    const activeLang = allLanguagesSignal.value.find(l => l.id === lId);

    const header = h('div', { style: 'border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: `📖 Lexicon: ${activeLang?.name || 'Terms'}` }),
      activeLang?.description ? h('div', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;', textContent: activeLang.description }) : null
    );

    // --- VOCABULARY TABLE ---
    const table = h('table', { className: 'numbers-table', style: 'width: 100%; border-collapse: collapse; margin-bottom: 20px;' });
    table.appendChild(h('thead', {}, h('tr', {}, 
      h('th', { textContent: 'Term (Domain Noun)', style: 'width: 35%;' }), 
      h('th', { textContent: 'K4 Pole / Edge', style: 'width: 20%;' }), 
      h('th', { textContent: 'Role', style: 'width: 20%;' }),
      h('th', { textContent: 'Description', style: 'width: 25%;' })
    )));

    const tbody = h('tbody');
    if (vocab.length === 0) {
      tbody.appendChild(h('tr', {}, h('td', { colSpan: 4, style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;', textContent: 'No vocabulary terms defined in this lexicon yet.' })));
    } else {
      vocab.forEach(v => {
        tbody.appendChild(h('tr', {}, 
          h('td', { style: 'font-weight: bold; color: var(--text-primary);' }, v.term),
          h('td', {}, h('span', { className: `badge pole-${v.k4Type.toLowerCase()}`, style: 'font-weight: bold; padding: 2px 6px; border-radius: 3px;', textContent: v.k4Type })),
          h('td', {}, h('span', { className: `badge role-${v.role.toLowerCase()}`, style: 'font-size: 0.8rem; padding: 2px 6px; border-radius: 3px;', textContent: v.role })),
          h('td', { style: 'font-size: 0.85rem; color: var(--text-secondary);' }, v.description || '—')
        ));
      });
    }
    table.appendChild(tbody);

    // --- ADD TERM FORM ---
    const termInput = h('input', { placeholder: 'New Domain Noun (e.g., Pull Request)...', style: 'flex: 2; font-size: 0.85rem;' });
    const descInput = h('input', { placeholder: 'Description...', style: 'flex: 2; font-size: 0.85rem;' });

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
      textContent: '+ Add Term', 
      className: 'k4-btn-primary',
      style: 'padding: 6px 15px; font-weight: bold;',
      on: { click: async () => {
        const val = termInput.value.trim();
        if (!val) return;
        await addVocabTerm(val, poleSel.value as K4Type, roleSel.value as ElementRole, lId);
        termInput.value = '';
        descInput.value = '';
      }}
    });

    const addForm = h('div', { 
      style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); padding: 15px; border-radius: 6px; margin-top: auto;' 
    },
      h('h4', { style: 'margin-top: 0; color: var(--text-primary); margin-bottom: 10px;', textContent: 'Add Domain Noun to Lexicon' }),
      h('div', { style: 'display: flex; gap: 10px; margin-bottom: 10px;' }, termInput, poleSel, roleSel),
      h('div', { style: 'display: flex; gap: 10px;' }, descInput, addBtn)
    );

    editorPane.append(header, table, addForm);
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'languages', label: 'Languages', order: 12, mount: mountLanguagesScreen });

