// wasm/src/screens/documents.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import {
  composedDocuments, resolvedInclusionForActiveView, setViewDocOverride,
  clearAllViewDocOverrides, selectedDocumentId, selectedCircuitId, activeCircuit,
  refreshAllGrids
} from '../ledger/grid-state';

import { ledgerVfs } from '../ledger/vfs-wrapper';
import { pushScreen } from '../router';
import { h, addRowButton } from '../dom';


export function mountDocumentsScreen(container: HTMLElement): () => void {
  const layout = h('div', { className: 'k4-screen-layout scrollable' });
  container.appendChild(layout);

  createEffect(() => {
    const cId = selectedCircuitId.value;
    const circ = activeCircuit.value;

    layout.replaceChildren();

    const headlineText = circ 
      ? `${circ.name} [${circ.specialization.toUpperCase()}] — Documents & Inclusions`
      : 'Master Documents & Inclusions';

    const deselectBtn = h('button', {
      textContent: '↺ Restore Defaults',
      className: 'k4-btn-secondary',
      on: { click: async () => await clearAllViewDocOverrides() }
    });

    const addRowBtn = addRowButton({
      onClick: async () => {
        const freshDoc = await ledgerVfs.saveDocumentNode(
          'New Master Document',
          '',
          { A: true, P: false, U: false, I: false, R: false }
        );
        selectedDocumentId.value = freshDoc.id;
        await refreshAllGrids();
      }
    });

    const header = h('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 12px; margin-bottom: 20px;'
    },
      h('h2', { className: 'k4-screen-title', textContent: headlineText }),
      h('div', { style: 'display: flex; gap: 10px;' }, deselectBtn, addRowBtn)
    );

    const sections = composedDocuments();
    const resolvedInclusions = resolvedInclusionForActiveView();

    const gridWrapper = h('div', { style: 'display: flex; flex-direction: column; gap: 20px;' });

    sections.forEach(sec => {
      const sectionHeader = h('div', {
        style: 'font-weight: bold; color: var(--role-bridge); font-size: 0.85rem; letter-spacing: 0.5px; text-transform: uppercase; padding: 6px 0; border-bottom: 1px solid var(--border-subtle); margin-top: 10px;',
        textContent: `📄 ${sec.scopeName}`
      });

      const table = h('table', { className: 'numbers-table k4-table-full' },
        h('thead', {},
          h('tr', {},
            h('th', { textContent: 'Document Name', style: 'width: 45%;' }),
            h('th', { textContent: 'Type', style: 'width: 15%;' }),
            h('th', { textContent: 'A', title: 'All Faces (Shared)', style: 'width: 8%; text-align: center;' }),
            h('th', { textContent: 'P', title: 'Fire (Drive)', style: 'width: 8%; text-align: center; color: var(--pole-p);' }),
            h('th', { textContent: 'U', title: 'Air (Structure)', style: 'width: 8%; text-align: center; color: var(--pole-u);' }),
            h('th', { textContent: 'I', title: 'Water (Flow)', style: 'width: 8%; text-align: center; color: var(--pole-i);' }),
            h('th', { textContent: 'R', title: 'Earth (Ground)', style: 'width: 8%; text-align: center; color: var(--pole-r);' })
          )
        )
      );

      const tbody = h('tbody');

      sec.items.forEach(doc => {
        const inc = resolvedInclusions.find(i => i.document.id === doc.id);

        const makeCell = (col: 'A' | 'P' | 'U' | 'I' | 'R') => {
          const isEffective = inc ? inc[col] : false;
          const cb = h('input', {
            type: 'checkbox',
            checked: isEffective,
            className: 'k4-checkbox-large',
            on: { change: async (e: Event) => {
              const checked = (e.target as HTMLInputElement).checked;
              await setViewDocOverride(doc.id, col, checked);
            }}
          });
          return h('td', { style: 'text-align: center;' }, cb);
        };

        const row = h('tr', {
          style: 'cursor: pointer;',
          on: { click: (e: Event) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            selectedDocumentId.value = doc.id;
            pushScreen('doc-editor');
          }}
        },
          h('td', { style: 'font-weight: 600; color: var(--text-primary);' }, doc.name),
          h('td', { className: 'k4-caption' }, doc.documentData?.kind || 'source'),
          makeCell('A'),
          makeCell('P'),
          makeCell('U'),
          makeCell('I'),
          makeCell('R')
        );

        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      gridWrapper.append(sectionHeader, table);
    });

    layout.append(header, gridWrapper);
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'documents', label: 'Documents', order: 102, mount: mountDocumentsScreen });
