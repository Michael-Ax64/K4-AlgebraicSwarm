// wasm/src/screens/doc-editor.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { selectedDocumentId, worldDocumentsGrid, projectDocumentsGrid, activeProject, activeWorldConfig } from '../ledger/grid-state';
import { ledgerVfs } from '../ledger/vfs-wrapper';
import { pushScreen } from '../router';
import { h } from '../dom';

export function mountDocEditorScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column;' });
  container.appendChild(layout);

  createEffect(() => {
    const docId = selectedDocumentId.value;
    layout.replaceChildren();

    const allDocs = [...worldDocumentsGrid.value, ...projectDocumentsGrid.value];
    const existingDoc = allDocs.find(d => d.id === docId);

    const isNew = !existingDoc || docId === 'new';

    // Header Title: "Creating Document" when blank/new, else "Edit Document [SCOPE]"
    const headerTitle = isNew ? 'Creating Document' : `Edit Document [${existingDoc.ownerScope.toUpperCase()}]`;

    const titleInput = h('input', {
      value: existingDoc ? existingDoc.name : '',
      placeholder: 'Document Name (e.g. System_Architecture.md)',
      style: 'font-size: 1.1rem; font-weight: bold; width: 100%; margin-bottom: 15px;'
    });

    const contentArea = h('textarea', {
      value: existingDoc ? existingDoc.content : '',
      placeholder: 'Enter document content here...',
      style: 'flex: 1; width: 100%; font-family: var(--font-mono); font-size: 0.9rem; padding: 12px; resize: none; margin-bottom: 15px;'
    });

    const defaultA = h('input', { type: 'checkbox', checked: existingDoc ? existingDoc.defaultA : true });
    const defaultP = h('input', { type: 'checkbox', checked: existingDoc ? existingDoc.defaultP : false });
    const defaultU = h('input', { type: 'checkbox', checked: existingDoc ? existingDoc.defaultU : false });
    const defaultI = h('input', { type: 'checkbox', checked: existingDoc ? existingDoc.defaultI : false });
    const defaultR = h('input', { type: 'checkbox', checked: existingDoc ? existingDoc.defaultR : false });

    const saveStatus = h('span', { style: 'color: var(--health-clear); font-weight: bold; margin-left: 10px; display: none;' });

    const saveBtn = h('button', {
      textContent: isNew ? 'Create & Save Document' : 'Save Document',
      className: 'k4-btn-primary',
      on: { click: async () => {
        const name = titleInput.value.trim();
        if (!name) return alert('Please enter a document name.');

        const proj = activeProject.peek();
        const world = activeWorldConfig.peek();

        const scope: 'world' | 'project' = existingDoc ? existingDoc.ownerScope : (proj ? 'project' : 'world');
        const ownerId: string = existingDoc ? existingDoc.ownerId : (proj ? proj.id : (world ? world.id : ''));

        if (!ownerId) return alert('No active Project or World selected to own this document.');

        const savedDoc = await ledgerVfs.saveDocument(
          scope,
          ownerId,
          name,
          contentArea.value,
          {
            A: defaultA.checked,
            P: defaultP.checked,
            U: defaultU.checked,
            I: defaultI.checked,
            R: defaultR.checked
          },
          existingDoc ? existingDoc.id : undefined,
          existingDoc ? existingDoc.kind : 'source'
        );

        selectedDocumentId.value = savedDoc.id;
        saveStatus.textContent = isNew ? 'Created & Saved!' : 'Saved!';
        saveStatus.style.display = 'inline';
        setTimeout(() => saveStatus.style.display = 'none', 2000);
      }}
    });

    const deleteBtn = isNew ? null : h('button', {
      textContent: 'Delete Document',
      style: 'background: var(--health-halted); color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer;',
      on: { click: async () => {
        if (existingDoc && confirm(`Delete '${existingDoc.name}'?`)) {
          await ledgerVfs.deleteDocument(existingDoc.id);
          selectedDocumentId.value = 'new';
          pushScreen('documents');
        }
      }}
    });

    const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 15px;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: headerTitle }),
      deleteBtn || h('span')
    );

    const defaultsPanel = h('div', { style: 'display: flex; gap: 20px; align-items: center; background: var(--bg-surface); padding: 10px 15px; border-radius: 4px; border: 1px solid var(--border-subtle); margin-bottom: 15px;' },
      h('strong', { style: 'color: var(--text-secondary); font-size: 0.85rem;', textContent: 'Default Inclusion Flags:' }),
      h('label', {}, defaultA, ' All (A)'),
      h('label', { style: 'color: var(--pole-p); font-weight: bold;' }, defaultP, ' P'),
      h('label', { style: 'color: var(--pole-u); font-weight: bold;' }, defaultU, ' U'),
      h('label', { style: 'color: var(--pole-i); font-weight: bold;' }, defaultI, ' I'),
      h('label', { style: 'color: var(--pole-r); font-weight: bold;' }, defaultR, ' R')
    );

    layout.append(
      header,
      h('label', { style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px; display: block;', textContent: 'Document Name' }),
      titleInput,
      defaultsPanel,
      h('label', { style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px; display: block;', textContent: 'Content' }),
      contentArea,
      h('div', { style: 'display: flex; align-items: center;' }, saveBtn, saveStatus)
    );
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'doc-editor', label: 'Doc Editor', order: 103, mount: mountDocEditorScreen });
