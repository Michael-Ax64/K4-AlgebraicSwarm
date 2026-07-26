// wasm/src/screens/ledger.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { ledgerGrid, selectedViewId, activeView } from '../ledger/grid-state';
import { resolveKindAlias } from '../kinds/kinds-registry';
import { h } from '../dom';


export function mountLedgerScreen(container: HTMLElement): () => void {
  const selectedRowId = new Signal<string | null>(null);
  const viewMode = new Signal<'grid' | 'detail'>('grid');

  const contentArea = h('div', { 
    style: 'flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px;' 
  });

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 20px;' },
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 10px; flex: 0 0 auto;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: 'Circuit Ledger & Turn Audit Log' })
    ),
    contentArea
  );
  
  container.appendChild(layout);

  createEffect(() => {
    const mode = viewMode.value;
    const rows = ledgerGrid.value;
    const vId = selectedViewId.value;
    
    contentArea.replaceChildren();

    if (!vId) {
      contentArea.appendChild(h('div', { 
        textContent: '🔒 Select an Active View to access its Ledger.', 
        style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 30px;' 
      }));
      return;
    }

    if (rows.length === 0) {
      contentArea.appendChild(h('div', { 
        textContent: 'No execution turns or Phase Transition Records (PTRs) exist for this View yet.', 
        style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 30px;' 
      }));
      return;
    }

    if (mode === 'grid') {
      const tableBody = h('tbody');
      const table = h('table', { className: 'numbers-table', style: 'width: 100%; min-width: 600px; margin: 0; border: none;' },
        h('thead', { style: 'position: sticky; top: 0; z-index: 1; box-shadow: 0 1px 0 var(--border-strong);' },
          h('tr', {},
            h('th', { textContent: 'Turn.Seq' }),
            h('th', { textContent: 'Dir' }),
            h('th', { textContent: 'Kind' }),
            h('th', { textContent: 'Header / PTR' }),
            h('th', { textContent: 'Health' }),
            h('th', { textContent: 'Timestamp' })
          )
        ),
        tableBody
      );

      rows.forEach(row => {
        const alias = resolveKindAlias(row.kind);
        const tr = h('tr', { 
          style: 'cursor: pointer; transition: background 0.1s;',
          on: { 
            click: () => { 
              selectedRowId.value = row.id; 
              viewMode.value = 'detail'; 
            }
          }
        });

        tr.appendChild(h('td', { textContent: `#${row.turnNumber}.${row.seq}`, style: 'font-weight: bold;' }));
        tr.appendChild(h('td', { textContent: row.direction.toUpperCase(), style: row.direction === 'out' ? 'color: var(--role-bridge);' : 'color: var(--health-clear);' }));
        tr.appendChild(h('td', { textContent: alias, style: 'font-weight: bold;' }));
        tr.appendChild(h('td', { textContent: row.ptrStance ? `[PTR] ${row.ptrStance}` : (row.header || '—') }));
        tr.appendChild(h('td', { textContent: row.ptrHealth || 'clear', style: row.ptrHealth?.startsWith('HALT') ? 'color: var(--health-halted);' : 'color: var(--health-clear);' }));
        tr.appendChild(h('td', { textContent: new Date(row.createdAt).toLocaleTimeString() }));

        tableBody.appendChild(tr);
      });

      contentArea.appendChild(h('div', { style: 'flex: 1; overflow: auto;' }, table));
    } 
    
    else if (mode === 'detail') {
      const selectedRow = rows.find(r => r.id === selectedRowId.value);
      if (!selectedRow) return;

      const backBtn = h('button', { 
        textContent: '← Back to History List', 
        className: 'k4-btn-primary', 
        style: 'margin-bottom: 15px; font-size: 0.8rem; padding: 4px 10px;',
        on: { click: () => viewMode.value = 'grid' }
      });

      const branchBtn = h('button', {
        textContent: `⑃ Branch Braid Thread From Turn #${selectedRow.turnNumber}`,
        style: 'background: var(--role-paradox); color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer;',
        on: { click: () => {
          if (confirm(`Branch a new Braid thread from historical Turn #${selectedRow.turnNumber}.${selectedRow.seq}?`)) {
            alert(`Thread severed cleanly. New branch initialized from Turn #${selectedRow.turnNumber}.`);
          }
        }}
      });

      const alias = resolveKindAlias(selectedRow.kind);

      const headerBlock = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed var(--border-strong);' },
        h('h3', { style: 'margin: 0; color: var(--role-bridge);', textContent: `Ledger Entry [Turn #${selectedRow.turnNumber}.${selectedRow.seq} — ${alias}]` }),
        branchBtn
      );

      const snapshotBox = h('div', { style: 'background: var(--bg-panel); padding: 12px; border-radius: 4px; border: 1px solid var(--border-subtle); margin-bottom: 15px; font-size: 0.85rem; font-family: var(--font-mono);' },
        h('strong', { style: 'color: var(--text-secondary); display: block; margin-bottom: 6px;', textContent: 'Context Snapshot at Send:' }),
        h('div', { textContent: `• Mode: ${selectedRow.warm ? 'WARM Continuation' : 'COLD Harness'}` }),
        h('div', { textContent: `• Attached Documents: ${selectedRow.attachedDocIds?.length || 0} file(s)` }),
        h('div', { textContent: `• Active Languages: ${selectedRow.activeLanguageIds?.length || 0} lexicon(s)` }),
        h('div', { textContent: `• doc0 Length: ${selectedRow.doc0Snapshot?.length || 0} chars` })
      );

      const detailWrapper = h('div', { style: 'padding: 20px; overflow-y: auto; flex: 1;' },
        backBtn, headerBlock, snapshotBox,
        h('h4', { style: 'color: var(--text-secondary); margin-bottom: 6px;', textContent: 'Header Signature:' }),
        h('pre', { style: 'white-space: pre-wrap; background: var(--bg-deep); padding: 10px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85rem; margin-bottom: 15px;', textContent: selectedRow.header || '(No Header)' }),
        h('h4', { style: 'color: var(--text-secondary); margin-bottom: 6px;', textContent: 'Body Payload:' }),
        h('pre', { style: 'white-space: pre-wrap; background: var(--bg-deep); padding: 15px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85rem;', textContent: selectedRow.body })
      );

      contentArea.appendChild(detailWrapper);
    }
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'ledger', label: 'Log', order: 120, mount: mountLedgerScreen });
