// wasm/src/screens/doc-editor.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { selectedDocumentId, documentsGrid, refreshAllGrids } from '../ledger/grid-state';
import { ledgerVfs } from '../ledger/vfs-wrapper';
import { vfsDb } from '../ledger/fs';
import { pushScreen } from '../router';
import { h } from '../dom';

export function mountDocEditorScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column;' });
  container.appendChild(layout);

  createEffect(() => {
    const docId = selectedDocumentId.value;
    layout.replaceChildren();

    const existingDoc = documentsGrid.value.find(d => d.id === docId);
    const isNew = !existingDoc || docId === 'new';

    const dPayload = existingDoc?.documentData || {
      content: existingDoc?.doc0 || '',
      defaultA: true, defaultP: false, defaultU: false, defaultI: false, defaultR: false,
      kind: 'source' as const
    };

    // 1. EDITABLE DOCUMENT HEADER CARD
    const titleInput = h('input', {
      value: existingDoc ? existingDoc.name : '',
      placeholder: 'Document Name (e.g. System_Architecture.md)...',
      style: 'font-size: 1.2rem; font-weight: bold; width: 100%; margin-bottom: 8px;'
    });

    const descInput = createAutosizingTextarea({
      value: existingDoc?.description || '',
      placeholder: 'Document Purpose / Description...',
      style: 'width: 100%; min-height: 40px; margin-bottom: 12px; font-size: 0.85rem;'
    });

    const saveHeaderBtn = h('button', {
      textContent: isNew ? 'Create Document Header' : 'Save Document Header',
      className: 'k4-btn-primary',
      style: 'align-self: flex-start; margin-bottom: 15px;',
      on: { click: async () => {
        const name = titleInput.value.trim();
        if (!name) return alert('Please enter a document name.');

        const savedDocNode = await ledgerVfs.saveDocumentNode(
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
          dPayload.kind || 'source'
        );

        savedDocNode.description = descInput.value.trim();
        await vfsDb.upsertCircuit(savedDocNode);
        await refreshAllGrids();

        selectedDocumentId.value = savedDocNode.id;
        alert('Document header saved.');
      }}
    });

    const headerCard = h('div', {
      style: 'background: var(--bg-surface); padding: 15px; border-radius: 6px; border: 1px solid var(--border-strong); margin-bottom: 20px;'
    },
      h('label', { style: labelStyle, textContent: '📄 Document Name' }), titleInput,
      h('label', { style: labelStyle, textContent: 'Document Purpose & Description' }), descInput,
      saveHeaderBtn
    );

    // 2. DOCUMENT CONTENT EDITOR
    const contentArea = createAutosizingTextarea({
      value: dPayload.content || existingDoc?.doc0 || '',
      placeholder: 'Enter document content here...',
      style: 'flex: 1; width: 100%; font-family: var(--font-mono); font-size: 0.9rem; padding: 12px; min-height: 200px; margin-bottom: 15px;'
    });

    const defaultA = h('input', { type: 'checkbox', checked: dPayload.defaultA });
    const defaultP = h('input', { type: 'checkbox', checked: dPayload.defaultP });
    const defaultU = h('input', { type: 'checkbox', checked: dPayload.defaultU });
    const defaultI = h('input', { type: 'checkbox', checked: dPayload.defaultI });
    const defaultR = h('input', { type: 'checkbox', checked: dPayload.defaultR });

    const saveContentBtn = h('button', {
      textContent: 'Save Document Content',
      className: 'k4-btn-primary',
      on: { click: async () => {
        const name = titleInput.value.trim();
        if (!name) return alert('Please enter a document name.');

        const savedDocNode = await ledgerVfs.saveDocumentNode(
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
          dPayload.kind || 'source'
        );

        selectedDocumentId.value = savedDocNode.id;
        alert('Document content saved.');
      }}
    });

    const deleteBtn = isNew ? null : h('button', {
      textContent: '🗑️ Delete Document',
      style: 'background: var(--health-halted); color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-left: 10px;',
      on: { click: async () => {
        if (existingDoc && confirm(`Move '${existingDoc.name}' to Trash?`)) {
          await ledgerVfs.deleteDocument(existingDoc.id);
          selectedDocumentId.value = 'new';
          pushScreen('documents');
        }
      }}
    });

    const defaultsPanel = h('div', { style: 'display: flex; gap: 20px; align-items: center; background: var(--bg-surface); padding: 10px 15px; border-radius: 4px; border: 1px solid var(--border-subtle); margin-bottom: 15px;' },
      h('strong', { style: 'color: var(--text-secondary); font-size: 0.85rem;', textContent: 'Default Inclusion Flags:' }),
      h('label', {}, defaultA, ' All (A)'),
      h('label', { style: 'color: var(--pole-p); font-weight: bold;' }, defaultP, ' P'),
      h('label', { style: 'color: var(--pole-u); font-weight: bold;' }, defaultU, ' U'),
      h('label', { style: 'color: var(--pole-i); font-weight: bold;' }, defaultI, ' I'),
      h('label', { style: 'color: var(--pole-r); font-weight: bold;' }, defaultR, ' R')
    );

    layout.append(
      headerCard,
      defaultsPanel,
      h('label', { style: 'font-weight: bold; color: var(--text-secondary); margin-bottom: 4px; display: block;', textContent: 'Document Body Content' }),
      contentArea,
      h('div', { style: 'display: flex; align-items: center;' }, saveContentBtn, deleteBtn)
    );
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

screenRegistry.register({ id: 'doc-editor', label: 'Document Editor', order: 103, mount: mountDocEditorScreen });

