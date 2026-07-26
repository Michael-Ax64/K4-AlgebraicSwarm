// wasm/src/screens/lexicons.ts
//
// View-scoped peer to `documents`/`chat`/`ledger`. Mirrors the world.ts
// "Languages (Lexicons)" sub-tab shape, but toggles ViewLangSelection.active
// per language for the active View. World-linked Languages are the eligible
// set (see vfsDb.getLanguages('world', worldId) — it already filters via
// WorldLangSelection). Global authoring/vocabulary editing stays on the
// global `languages` screen; this screen is only the per-view activation.

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import {
  activeView, activeWorldConfig, selectedViewId,
  viewLangSelectionsGrid
} from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { Language, ViewLangSelection } from '../ledger/schema';
import { pushScreen } from '../router';
import { h } from '../dom';

export function mountLexiconsScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column; overflow-y: auto;' });
  container.appendChild(layout);

  createEffect(() => {
    const view = activeView.value;
    const world = activeWorldConfig.value;
    const viewSels = viewLangSelectionsGrid.value;
    const vId = selectedViewId.value;

    layout.replaceChildren();

    if (!vId || !view || !world) {
      layout.appendChild(h('div', {
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: '🔒 Select an Active View from the context graph to configure its lexicons.'
      }));
      return;
    }

    // ─── HEADER ─────────────────────────────────────────────────────────────
    const activeCount = viewSels.filter(s => s.active).length;

    layout.appendChild(h('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 12px; margin-bottom: 15px;'
    },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: '📖 Lexicons Active in this View' }),
      h('button', {
        textContent: '↗ Global Languages (Create & Edit Vocabularies)',
        style: 'background: transparent; border: 1px solid var(--border-strong); color: var(--role-bridge); font-size: 0.78rem; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-weight: bold;',
        on: { click: () => pushScreen('languages') }
      })
    ));

    layout.appendChild(h('div', {
      style: 'font-size: 0.78rem; color: var(--text-muted); margin-bottom: 15px; font-family: var(--font-mono);',
      textContent: `👁️ ${view.name}   |   🌍 ${world.name}   |   ✓ Active: ${activeCount}`
    }));

    // ─── LIST ───────────────────────────────────────────────────────────────
    const listCard = h('div', {
      style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px;'
    });
    layout.appendChild(listCard);

    (async () => {
      // World-linked Languages are the eligible pool for view-level activation.
      const worldLinkedLangs: Language[] = await vfsDb.getLanguages('world', world.id);
      const viewActiveIds = new Set(viewSels.filter(s => s.active).map(s => s.languageId));

      listCard.replaceChildren();

      if (worldLinkedLangs.length === 0) {
        listCard.appendChild(h('div', {
          style: 'color: var(--text-muted); font-style: italic; padding: 10px 0;',
          textContent: 'No lexicons linked to this World yet. Link one from World → Languages (Lexicons), or create a new global language on the Languages screen.'
        }));
        return;
      }

      worldLinkedLangs.forEach(l => {
        const isActive = viewActiveIds.has(l.id);
        const row = h('div', {
          style: `display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-subtle); align-items: center; background: ${isActive ? 'var(--bg-elevated)' : 'transparent'};`
        },
          h('div', {},
            h('strong', { textContent: `📖 ${l.name}`, style: `color: ${isActive ? 'var(--role-bridge)' : 'var(--text-primary)'};` }),
            l.description ? h('div', { style: 'font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;', textContent: l.description }) : null
          ),
          h('input', {
            type: 'checkbox',
            checked: isActive,
            style: 'cursor: pointer; transform: scale(1.2);',
            on: { change: async (e: Event) => {
              const checked = (e.target as HTMLInputElement).checked;
              const sel: ViewLangSelection = {
                id: `${vId}:${l.id}`,
                viewId: vId,
                languageId: l.id,
                active: checked,
              };
              await vfsDb.upsertViewLangSelection(sel);
              viewLangSelectionsGrid.value = await vfsDb.getViewLangSelections(vId);
            }}
          })
        );
        listCard.appendChild(row);
      });
    })();

    // ─── FOOTER NOTE ────────────────────────────────────────────────────────
    layout.appendChild(h('div', {
      style: 'font-size: 0.75rem; color: var(--text-muted); font-style: italic; margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--border-subtle); line-height: 1.5;',
      textContent: 'Each ledger row snapshots the active lexicon set at send time. Toggling here applies to future turns; historical turns retain their own activeLanguageIds. Per-turn variation is available from the chat authoring surface.'
    }));
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'lexicons', label: 'Lexicons', order: 105, mount: mountLexiconsScreen });
