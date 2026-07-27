// wasm/src/screens/kinds.ts
//
// Global screen exposing the AppKind registry. Composes Project → World
// sections (matches composedKinds ordering — nearest scope first). Rows are
// grouped by `family` inside each section. Template-dispatched Kinds edit
// their alias/hint/template inline; engine-dispatched Kinds are read-only
// with a pointer to their mechanics doc — their `template` is compiled by
// the Rust engine and their `key` must remain in engine.dispatchable_kinds().
//
// All writes go through upsertKindValidated (kinds-registry.ts), which
// rejects engine-dispatched Kinds whose key isn't in the engine export and
// updates the appropriate reactive signal on success.

// wasm/src/screens/kinds.ts

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { systemKindsGrid, upsertKindValidated } from '../kinds/kinds-registry';
import { AppKind } from '../ledger/schema';
import { h } from '../dom';

export function mountKindsScreen(container: HTMLElement): () => void {
  const expandedKindId = new Signal<string | null>(null);

  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column; overflow-y: auto;' });
  container.appendChild(layout);

  createEffect(() => {
    const kinds = systemKindsGrid.value;
    const expandedId = expandedKindId.value;

    layout.replaceChildren();

    // Top-Level Screen Header (Standalone, No Sub-Tabs)
    layout.appendChild(h('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 12px; margin-bottom: 15px;'
    },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: '🧩 System Flows (Kinds Registry)' }),
      h('span', { style: 'font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);', textContent: `Total Flows: ${kinds.length}` })
    ));

    layout.appendChild(h('div', {
      style: 'font-size: 0.85rem; color: var(--text-secondary); background: var(--bg-elevated); border-left: 3px solid var(--role-bridge); padding: 12px; margin-bottom: 20px; line-height: 1.5;',
    },
      h('strong', { textContent: 'System Flows (Kinds) ' }),
      h('span', { textContent: 'define the explicit exchange shapes passing through Chat and Wasm. They are global system processes un-scoped from specific circuits.' })
    ));

    if (kinds.length === 0) {
      layout.appendChild(h('div', { style: 'color: var(--text-muted); font-style: italic;', textContent: 'No System Kinds registered.' }));
      return;
    }

    const grid = h('div', { style: 'display: flex; flex-direction: column; gap: 10px;' });

    kinds.forEach(k => {
      grid.appendChild(renderKindCard(k, expandedId === k.id, () => {
        expandedKindId.value = expandedKindId.value === k.id ? null : k.id;
      }));
    });

    layout.appendChild(grid);
  });

  return () => { container.innerHTML = ''; };
}

function renderKindCard(k: AppKind, isExpanded: boolean, toggle: () => void): HTMLElement {
  const isEngine = k.dispatch === 'engine';

  const card = h('div', {
    style: `background: var(--bg-surface); border: 1px solid ${isExpanded ? 'var(--role-bridge)' : 'var(--border-strong)'}; border-radius: 6px; overflow: hidden; transition: border-color 0.2s;`
  });

  const header = h('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; cursor: pointer; background: var(--bg-elevated);',
    on: { click: toggle }
  },
    h('div', { style: 'display: flex; align-items: center; gap: 12px;' },
      h('span', { style: 'font-size: 1rem; color: var(--text-muted);', textContent: isExpanded ? '▾' : '▸' }),
      h('strong', { style: 'color: var(--text-primary); font-size: 1rem;', textContent: k.alias }),
      h('code', { style: 'font-size: 0.78rem; color: var(--role-bridge); font-family: var(--font-mono); background: var(--bg-deep); padding: 2px 6px; border-radius: 3px;', textContent: k.key }),
      h('span', {
        style: `font-size: 0.68rem; padding: 2px 6px; border-radius: 3px; font-weight: bold; letter-spacing: 0.5px; ${isEngine ? 'background: var(--role-paradox); color: #fff;' : 'background: var(--role-controller); color: #fff;'}/`,
        textContent: isEngine ? 'ENGINE DISPATCH' : 'TEMPLATE DISPATCH'
      }),
      h('span', {
        style: 'font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;',
        textContent: `[${k.family}]`
      })
    ),
    h('span', {
      style: 'font-size: 0.82rem; color: var(--text-secondary); font-style: italic;',
      textContent: k.hint || ''
    })
  );

  card.appendChild(header);

  if (isExpanded) {
    const details = h('div', { style: 'padding: 16px; border-top: 1px solid var(--border-subtle); background: var(--bg-deep);' });

    // Prerequisites Summary
    const reqBits: string[] = [];
    if (k.requires?.circuit) reqBits.push('Circuit context active');
    if (k.requires?.anchor) reqBits.push('Paradox Anchor');
    if (k.requires?.lockedCoordinate) reqBits.push('Locked Coordinate');
    if (k.requires?.attachedDocs && k.requires.attachedDocs !== 'none') {
      reqBits.push(`Attached Docs: ${k.requires.attachedDocs}`);
    }

    details.appendChild(h('div', {
      style: 'font-size: 0.78rem; color: var(--text-muted); margin-bottom: 12px; font-family: var(--font-mono);',
      textContent: `Requires: ${reqBits.length ? reqBits.join(' • ') : 'None (Universal)'}`
    }));

    if (isEngine) {
      details.appendChild(h('div', {
        style: 'font-size: 0.85rem; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 12px; line-height: 1.5; font-family: var(--font-mono);',
        textContent: k.engineMechanicsDoc || 'Compiled directly into Wasm binary via prompt harness specification.'
      }));
    } else {
      const aliasInput = h('input', { value: k.alias, style: 'width: 50%; margin-bottom: 10px; font-weight: bold;' });
      const hintInput = h('input', { value: k.hint || '', style: 'width: 100%; margin-bottom: 10px;' });
      const tmplArea = createAutosizingTextarea({
        value: k.template || '',
        style: 'width: 100%; min-height: 150px; font-family: var(--font-mono); font-size: 0.85rem; padding: 10px; margin-bottom: 10px;'
      });

      const saveBtn = h('button', {
        textContent: 'Save Template Changes',
        className: 'k4-btn-primary',
        on: { click: async () => {
          k.alias = aliasInput.value.trim() || k.alias;
          k.hint = hintInput.value.trim();
          k.template = tmplArea.value;
          k.updatedAt = Date.now();
          await upsertKindValidated(k);
          alert('System flow template updated.');
        }}
      });

      details.append(
        h('label', { style: labelStyle, textContent: 'Alias (Display Name)' }), aliasInput,
        h('label', { style: labelStyle, textContent: 'Hint (Operator Note)' }), hintInput,
        h('label', { style: labelStyle, textContent: 'Prompt Template' }), tmplArea,
        saveBtn
      );
    }

    card.appendChild(details);
  }

  return card;
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

const labelStyle = 'font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px; font-size: 0.8rem;';

screenRegistry.register({ id: 'kinds', label: 'Kinds', order: 20, mount: mountKindsScreen });
