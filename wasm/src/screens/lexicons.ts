// wasm/src/screens/lexicons.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import {
  activeCircuit, selectedCircuitId,
  languagesGrid, activeCircuitLangs, resolveCircuitLineage
} from '../ledger/grid-state';

import { vfsDb } from '../ledger/fs';
import { pushScreen } from '../router';
import { h } from '../dom';


export function mountLexiconsScreen(container: HTMLElement): () => void {
  const layout = h('div', { className: 'k4-screen-layout scrollable' });
  container.appendChild(layout);

  createEffect(() => {
    const circ = activeCircuit.value;
    const cId = selectedCircuitId.value;
    const localSelections = activeCircuitLangs.value;

    layout.replaceChildren();

    if (!cId || !circ) {
      layout.appendChild(h('div', {
        className: 'k4-empty-state',
        textContent: '🔒 Select an Active Circuit from the context graph to configure its language assignments.'
      }));
      return;
    }

    const header = h('div', {
      className: 'k4-section-header'
    },
      h('h2', { className: 'k4-screen-title', textContent: `📖 Language Assignments for ${circ.name}` })
    );

    const listCard = h('div', {
      style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px;'
    });

    layout.append(header, listCard);

    (async () => {
      const allLangs = languagesGrid.value;
      const { lineage } = await resolveCircuitLineage(cId);

      const inheritedActiveLangIds = new Set<string>();
      const ancestorNamesByLangId = new Map<string, string>();

      for (const ancestor of lineage) {
        if (ancestor.id === cId) continue;
        const ancestorSels = await vfsDb.getCircuitLangSelections(ancestor.id);
        ancestorSels.filter(s => s.active).forEach(s => {
          inheritedActiveLangIds.add(s.languageId);
          ancestorNamesByLangId.set(s.languageId, ancestor.name);
        });
      }

      const localActiveIds = new Set(localSelections.filter(s => s.active).map(s => s.languageId));

      listCard.replaceChildren();

      if (allLangs.length === 0) {
        listCard.appendChild(h('div', {
          className: 'k4-subtle', style: 'padding: 10px 0;',
          textContent: 'No sovereign languages created yet. Open Languages space to create one.'
        }));
        return;
      }

      allLangs.forEach(l => {
        const isLocallyActive = localActiveIds.has(l.id);
        const isInherited = inheritedActiveLangIds.has(l.id);
        const isEffective = isLocallyActive || isInherited;
        const ancestorName = ancestorNamesByLangId.get(l.id);

        const row = h('div', {
          style: `display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-subtle); align-items: center; background: ${isEffective ? 'var(--bg-elevated)' : 'transparent'};`
        },
          h('div', {},
            h('strong', { textContent: `📖 ${l.name}`, style: `color: ${isEffective ? 'var(--role-bridge)' : 'var(--text-primary)'};` }),
            isInherited ? h('span', { style: 'font-size: 0.72rem; color: var(--role-paradox); margin-left: 8px; font-weight: bold;', textContent: `[✓ Inherited from ${ancestorName}]` }) : null,
            l.description ? h('div', { className: 'k4-caption', style: 'margin-top: 2px;', textContent: l.description }) : null
          ),
          h('input', {
            type: 'checkbox',
            checked: isLocallyActive,
            style: 'cursor: pointer; transform: scale(1.2);',
            on: { change: async (e: Event) => {
              const checked = (e.target as HTMLInputElement).checked;
              await vfsDb.upsertCircuitLangSelection({
                id: `${cId}:${l.id}`,
                circuitId: cId,
                languageId: l.id,
                active: checked,
              });
              activeCircuitLangs.value = await vfsDb.getCircuitLangSelections(cId);
            }}
          })
        );
        listCard.appendChild(row);
      });
    })();
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'lexicons', label: 'Languages', order: 105, mount: mountLexiconsScreen });

