// wasm/src/screens/ledger.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { ledgerGrid, selectedViewId } from '../ledger/grid-state';
import { h } from '../dom';


export function mountLedgerScreen(container: HTMLElement): () => void {
    const selectedEntryId = new Signal<string | null>(null);
    const viewMode = new Signal<'grid' | 'detail'>('grid');

    const contentArea = h('div', { style: 'flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px;' });

    const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%;' },
        h('div', { style: 'display: flex; justifyContent: space-between; alignItems: center; borderBottom: 1px solid var(--border-strong); paddingBottom: 10px; marginBottom: 10px; flex: 0 0 auto;' },
            h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: 'Circuit Ledger' })
        ),
        contentArea
    );
    
    container.appendChild(layout);

    createEffect(() => {
        const mode = viewMode.value;
        const entries = ledgerGrid.value;
        const cId = selectedViewId.value;
        
        contentArea.replaceChildren();

        if (!vId) {
            contentArea.appendChild(h('div', { textContent: '🔒 Select an Active View to access its Ledger.', style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 30px;' }));
            return;
        }

        if (entries.length === 0) {
            contentArea.appendChild(h('div', { textContent: 'No Phase Transition Records (PTRs) exist for this View yet.', style: 'text-align: center; color: var(--text-muted); font-style: italic; padding: 30px;' }));
            return;
        }

        if (mode === 'grid') {
            const tableBody = h('tbody');
            const table = h('table', { className: 'numbers-table', style: 'width: 100%; min-width: 600px; margin: 0; border: none;' },
                h('thead', { style: 'position: sticky; top: 0; z-index: 1; box-shadow: 0 1px 0 var(--border-strong);' },
                    h('tr', {},
                        h('th', { textContent: 'Cycle.Seq' }),
                        h('th', { textContent: 'Stance' }),
                        h('th', { textContent: 'Health' }),
                        h('th', { textContent: 'P (Fire)' }),
                        h('th', { textContent: 'U (Air)' }),
                        h('th', { textContent: 'I (Water)' }),
                        h('th', { textContent: 'R (Earth)' })
                    )
                ),
                tableBody
            );

            entries.forEach(entry => {
                let snap: any = {};
                try { snap = JSON.parse(entry.snapshotJson); } catch (e) {}

                const tr = h('tr', { 
                    style: 'cursor: pointer; transition: background 0.1s;',
                    on: { 
                        click: () => { 
                            selectedEntryId.value = entry.id; 
                            viewMode.value = 'detail'; 
                        },
                        mouseenter: (e) => (e.target as HTMLElement).style.background = 'var(--bg-elevated)',
                        mouseleave: (e) => (e.target as HTMLElement).style.background = 'transparent'
                    }
                });

                const safeContent = (pole: string) => {
                    const c = snap[pole]?.content;
                    if (!c) return '-';
                    return c.length > 50 ? c.substring(0, 50) + '...' : c;
                };

                tr.appendChild(h('td', { textContent: `${entry.cycle}.${entry.seq}`, style: 'font-weight: bold; color: var(--text-secondary); white-space: nowrap;' }));
                tr.appendChild(h('td', { textContent: entry.stance, style: 'white-space: nowrap;' }));
                tr.appendChild(h('td', { textContent: entry.health, style: entry.health === 'clear' ? 'color: var(--health-clear); font-weight: bold;' : 'color: var(--health-halted); font-weight: bold;' }));
                tr.appendChild(h('td', { textContent: safeContent('P'), style: 'color: var(--text-muted);' }));
                tr.appendChild(h('td', { textContent: safeContent('U'), style: 'color: var(--text-muted);' }));
                tr.appendChild(h('td', { textContent: safeContent('I'), style: 'color: var(--text-muted);' }));
                tr.appendChild(h('td', { textContent: safeContent('R'), style: 'color: var(--text-muted);' }));
                
                tableBody.appendChild(tr);
            });

            contentArea.appendChild(h('div', { style: 'flex: 1; overflow: auto; background: var(--bg-panel);' }, table));
        } 
        
        else if (mode === 'detail') {
            const selectedEntry = entries.find(e => e.id === selectedEntryId.value);
            if (!selectedEntry) return;

            let snap: any = {};
            try { snap = JSON.parse(selectedEntry.snapshotJson); } catch (e) {}

            const backBtn = h('button', { 
                textContent: '← Back to Grid', 
                className: 'k4-btn-primary', 
                style: 'margin-bottom: 20px; font-size: 0.8rem; padding: 4px 10px;',
                on: { click: () => viewMode.value = 'grid' }
            });

            const headerBlock = h('div', { style: 'display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed var(--border-strong);' },
                h('h3', { style: 'margin: 0; color: var(--role-bridge);', textContent: `PTR [${selectedEntry.cycle}.${selectedEntry.seq}]` }),
                h('span', { style: 'font-size: 0.8rem; color: var(--text-muted);', textContent: new Date(selectedEntry.createdAt).toLocaleString() })
            );

            const detailWrapper = h('div', { style: 'padding: 20px; overflow-y: auto; flex: 1;' },
                backBtn, headerBlock,
                h('div', { style: 'margin-bottom: 10px;' }, h('strong', { textContent: 'Stance: ' }), h('span', { textContent: selectedEntry.stance })),
                h('div', { style: 'margin-bottom: 25px;' }, h('strong', { textContent: 'Health: ' }), h('span', { textContent: selectedEntry.health }))
            );

            const poles = ['P', 'U', 'I', 'R'];
            poles.forEach(pole => {
                const data = snap[pole] || { state: 'Unwritten', content: null };
                const block = h('div', { style: `margin-bottom: 15px; border-left: 4px solid var(--pole-${pole.toLowerCase()}); padding-left: 12px; background: var(--bg-panel); padding: 12px; border-radius: 0 4px 4px 0; border: 1px solid var(--border-subtle); border-left-width: 4px;` },
                    h('div', { style: 'display: flex; justify-content: space-between; margin-bottom: 8px;' },
                        h('strong', { style: `color: var(--pole-${pole.toLowerCase()}); font-family: var(--font-mono);`, textContent: `Pole ${pole}` }),
                        h('span', { style: `font-size: 0.75rem; font-weight: bold; color: ${data.state === 'Stale' ? 'var(--health-halted)' : 'var(--text-muted)'};`, textContent: `[${data.state}]` })
                    ),
                    h('pre', { style: 'white-space: pre-wrap; margin: 0; color: var(--text-primary); font-size: 0.85rem; line-height: 1.5; font-family: var(--font-mono);', textContent: data.content || '(unwritten)' })
                );
                detailWrapper.appendChild(block);
            });

            contentArea.appendChild(detailWrapper);
        }
    });

    return () => { container.innerHTML = ''; };
}


screenRegistry.register({
    id: 'ledger',
    label: 'Ledger',
    order: 130,
    mount: mountLedgerScreen
});

