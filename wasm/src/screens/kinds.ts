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

import { createEffect, Signal } from '../reactive';
import { screenRegistry } from './registry';
import { activeWorldConfig, activeProject } from '../ledger/grid-state';
import {
  worldKindsGrid, projectKindsGrid, composedKinds, upsertKindValidated
} from '../kinds/kinds-registry';
import { AppKind } from '../ledger/schema';
import { h } from '../dom';

export function mountKindsScreen(container: HTMLElement): () => void {
  const expandedKindId = new Signal<string | null>(null);

  const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column; overflow-y: auto;' });
  container.appendChild(layout);

  createEffect(() => {
    const world = activeWorldConfig.value;
    const proj = activeProject.value;
    // Read the grids so this effect re-runs when kinds change; composedKinds() uses these.
    void worldKindsGrid.value;
    void projectKindsGrid.value;
    const expandedId = expandedKindId.value;

    layout.replaceChildren();

    if (!world) {
      layout.appendChild(h('div', {
        style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: '🔒 Select a World from the context graph to browse its Kind registry.'
      }));
      return;
    }

    // ─── HEADER ─────────────────────────────────────────────────────────────
    layout.appendChild(h('div', {
      style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 12px; margin-bottom: 15px;'
    },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: '🧩 Kind Registry' }),
      h('div', { style: 'font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);',
        textContent: `${world.name}${proj ? ` / ${proj.name}` : ''}` })
    ));

    // Explanatory note
    layout.appendChild(h('div', {
      style: 'font-size: 0.82rem; color: var(--text-secondary); background: var(--bg-elevated); border-left: 3px solid var(--role-bridge); padding: 10px 12px; margin-bottom: 20px; line-height: 1.5;',
    },
      h('strong', { textContent: 'Kinds define the shapes of exchanges. ' }),
      h('span', { textContent: 'Engine-dispatched Kinds are compiled by the Rust engine — key must match engine.dispatchable_kinds() and template is not editable here. Template-dispatched Kinds carry the operator-authored prompt directly.' })
    ));

    const sections = composedKinds(proj?.name ?? null, world.name);

    if (sections.length === 0) {
      layout.appendChild(h('div', {
        style: 'color: var(--text-muted); font-style: italic;',
        textContent: 'No Kinds registered in this scope.'
      }));
      return;
    }

    sections.forEach(sec => {
      // Section header divider — same style as composed Documents/Languages
      layout.appendChild(h('div', {
        style: 'font-weight: bold; color: var(--role-bridge); font-size: 0.85rem; letter-spacing: 0.5px; text-transform: uppercase; padding: 6px 0; border-bottom: 1px solid var(--border-subtle); margin-top: 12px; margin-bottom: 10px;',
        textContent: sec.scope === 'project' ? `📁 Project Kinds: ${sec.scopeName}` : `🌍 World Kinds: ${sec.scopeName}`
      }));

      // Group by family within a section
      const familyOrder: string[] = [];
      const familyMap = new Map<string, AppKind[]>();
      sec.items.forEach(k => {
        const fam = k.family || 'ungrouped';
        if (!familyMap.has(fam)) { familyMap.set(fam, []); familyOrder.push(fam); }
        familyMap.get(fam)!.push(k);
      });

      familyOrder.forEach(family => {
        layout.appendChild(h('div', {
          style: 'font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 14px; margin-bottom: 6px; font-weight: bold; font-family: var(--font-mono);',
          textContent: `family · ${family}`
        }));

        familyMap.get(family)!.forEach(k => {
          layout.appendChild(renderKindRow(k, expandedId === k.id, () => {
            expandedKindId.value = expandedKindId.value === k.id ? null : k.id;
          }));
        });
      });
    });
  });

  return () => { container.innerHTML = ''; };
}

// ─── ROW RENDERING ─────────────────────────────────────────────────────────

function renderKindRow(k: AppKind, isExpanded: boolean, toggle: () => void): HTMLElement {
  const isEngine = k.dispatch === 'engine';

  const row = h('div', {
    style: `background: var(--bg-surface); border: 1px solid ${isExpanded ? 'var(--role-bridge)' : 'var(--border-strong)'}; border-radius: 4px; margin-bottom: 6px; overflow: hidden;`
  });

  const summary = h('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; cursor: pointer;',
    on: { click: toggle }
  },
    h('div', { style: 'display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;' },
      h('span', { style: 'font-size: 0.9rem; color: var(--text-muted);', textContent: isExpanded ? '▾' : '▸' }),
      h('strong', { style: 'color: var(--text-primary); font-size: 0.95rem;', textContent: k.alias }),
      h('code', { style: 'font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);', textContent: k.key }),
      h('span', {
        style: `font-size: 0.68rem; padding: 2px 6px; border-radius: 3px; font-weight: bold; letter-spacing: 0.5px; ${isEngine
          ? 'background: var(--role-paradox); color: #fff;'
          : 'background: var(--role-bridge); color: #fff;'}`,
        textContent: isEngine ? 'ENGINE' : 'TEMPLATE'
      })
    ),
    h('span', {
      style: 'font-size: 0.8rem; color: var(--text-muted); font-style: italic; max-width: 45%; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: 10px;',
      textContent: k.hint || ''
    })
  );

  row.appendChild(summary);

  if (isExpanded) {
    row.appendChild(renderKindDetails(k));
  }

  return row;
}

function renderKindDetails(k: AppKind): HTMLElement {
  const isEngine = k.dispatch === 'engine';

  const details = h('div', {
    style: 'padding: 12px 16px; border-top: 1px solid var(--border-subtle); background: var(--bg-deep);'
  });

  // Requires panel — read-only summary of what this Kind expects to be
  // present at send time. Enforced elsewhere (chat/engine); shown here for
  // operator awareness.
  const reqBits: string[] = [];
  if (k.requires?.view) reqBits.push('view');
  if (k.requires?.anchor) reqBits.push('anchor');
  if (k.requires?.lockedCoordinate) reqBits.push('locked coordinate');
  if (k.requires?.attachedDocs && k.requires.attachedDocs !== 'none') {
    reqBits.push(`attachedDocs: ${k.requires.attachedDocs}`);
  }
  details.appendChild(h('div', {
    style: 'font-size: 0.75rem; color: var(--text-muted); margin-bottom: 12px; font-family: var(--font-mono);',
    textContent: `requires: ${reqBits.length ? reqBits.join(', ') : '(none)'}`
  }));

  if (isEngine) {
    details.appendChild(h('div', {
      style: 'font-size: 0.82rem; color: var(--text-secondary); font-style: italic; padding: 10px 12px; background: var(--bg-surface); border: 1px dashed var(--border-strong); border-radius: 3px;',
      textContent: 'Template compiled by the Rust engine. Not editable here.'
    }));
    if (k.engineMechanicsDoc) {
      details.appendChild(h('div', {
        style: 'font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; font-family: var(--font-mono);',
        textContent: `mechanics spec: ${k.engineMechanicsDoc}`
      }));
    }
    return details;
  }

  // Template-dispatched — editable
  const aliasInput = h('input', { value: k.alias, style: 'width: 60%; margin-bottom: 10px;' });
  const hintInput = h('input', { value: k.hint, style: 'width: 100%; margin-bottom: 10px;' });
  const tmplArea = h('textarea', {
    value: k.template || '',
    style: 'width: 100%; min-height: 180px; font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.4;'
  });
  const saveBtn = h('button', {
    textContent: 'Save Changes',
    className: 'k4-btn-primary',
    style: 'margin-top: 10px;'
  });
  const status = h('span', { style: 'margin-left: 12px; font-size: 0.8rem; font-weight: bold;' });

  saveBtn.addEventListener('click', async () => {
    const updated: AppKind = {
      ...k,
      alias: aliasInput.value.trim() || k.alias,
      hint: hintInput.value.trim(),
      template: tmplArea.value,
      updatedAt: Date.now(),
    };
    // Template-dispatched Kinds don't hit engine-key validation, but we route
    // through upsertKindValidated regardless so the appropriate grid signal
    // refreshes and downstream (chat picker, ledger alias) recomposes.
    const ok = await upsertKindValidated(updated);
    if (ok) {
      status.textContent = '✓ Saved';
      status.style.color = 'var(--health-clear)';
      setTimeout(() => { status.textContent = ''; }, 2000);
    } else {
      status.textContent = '✗ Rejected — see Console';
      status.style.color = 'var(--health-halted)';
    }
  });

  details.append(
    h('label', { textContent: 'Alias (display label)', style: 'font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px; font-weight: bold;' }),
    aliasInput,
    h('label', { textContent: 'Hint (tooltip / operator note)', style: 'font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px; font-weight: bold;' }),
    hintInput,
    h('label', { textContent: 'Template (prompt body)', style: 'font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px; font-weight: bold;' }),
    tmplArea,
    h('div', { style: 'display: flex; align-items: center;' }, saveBtn, status)
  );

  return details;
}

screenRegistry.register({ id: 'kinds', label: 'Kinds', order: 20, mount: mountKindsScreen });
