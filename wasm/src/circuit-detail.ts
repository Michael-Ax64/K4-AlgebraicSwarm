// wasm/src/circuit-detail.ts
//
// Helpers for screens presenting the details of a selected Circuit.
// Consolidated from patterns that lived duplicated across VIEW / CIRCUIT / WORLD
// / PROJECT. Every helper here takes state as parameters and returns DOM — no
// helper subscribes to signals on its own. That keeps the caller's reactivity
// pattern (a top-level createEffect that rebuilds on selection change) unchanged.

import { h, cx } from './dom';
import type { CircuitNode } from './ledger/schema';
import { vfsDb } from './ledger/fs';
import { circuitsGrid, selectedCircuitId } from './ledger/grid-state';
import { pushScreen } from './router';


// ─── PHYSICS EDITOR ─────────────────────────────────────────────────────────

/**
 * ω/R/L/C editor for a Circuit's AC baseline physics. Returns the rendered
 * element plus a `read()` function to snapshot current input values.
 *
 * DC physics editing will land later; this API takes an optional title so a
 * later `mountPhysicsEditor(dc, { title: 'DC Bias' })` fits without redesign.
 *
 * `onChange` (if supplied) fires whenever any of the four inputs commits a new
 * value (blur / enter / stepper), delivering a snapshot of all four fields.
 * Callers using auto-save persist inside this callback and can ignore `read()`.
 */
export function mountPhysicsEditor(
    initial: { omega: number; r: number; l: number; c: number },
    options?: {
        title?: string;
        onChange?: (physics: { omega: number; r: number; l: number; c: number }) => void;
    }
): { element: HTMLElement; read: () => { omega: number; r: number; l: number; c: number } } {
    const wIn = h('input', { type: 'number', step: '0.1',   value: String(initial.omega), style: 'width: 100%;' }) as HTMLInputElement;
    const rIn = h('input', { type: 'number', step: '1',     value: String(initial.r),     style: 'width: 100%;' }) as HTMLInputElement;
    const lIn = h('input', { type: 'number', step: '1',     value: String(initial.l),     style: 'width: 100%;' }) as HTMLInputElement;
    const cIn = h('input', { type: 'number', step: '0.001', value: String(initial.c),     style: 'width: 100%;' }) as HTMLInputElement;

    const read = () => ({
        omega: parseFloat(wIn.value) || 1.0,
        r:     parseFloat(rIn.value) || 10,
        l:     parseFloat(lIn.value) || 10,
        c:     parseFloat(cIn.value) || 0.1,
    });

    if (options?.onChange) {
        const fire = () => options.onChange!(read());
        for (const inp of [wIn, rIn, lIn, cIn]) {
            inp.addEventListener('change', fire);
        }
    }

    const element = h('div', { style: 'margin-top: 15px; border-top: 1px solid var(--border-subtle); padding-top: 12px;' },
        h('strong', { style: 'display: block; color: var(--text-primary); margin-bottom: 8px;', textContent: options?.title ?? 'Baseline AC Physics' }),
        h('div', { style: 'display: grid; grid-template-columns: max-content 1fr; column-gap: 12px; row-gap: 8px; align-items: center;' },
            h('label', { className: 'k4-form-sublabel', textContent: 'ω (Pacing)' }),   wIn,
            h('label', { className: 'k4-form-sublabel', textContent: 'R (Friction)' }), rIn,
            h('label', { className: 'k4-form-sublabel', textContent: 'L (Momentum)' }), lIn,
            h('label', { className: 'k4-form-sublabel', textContent: 'C (Tension)' }),  cIn
        )
    );

    return { element, read };
}

// ─── CHILDREN LIST ──────────────────────────────────────────────────────────

/**
 * Render "direct descendants" (CircuitNodes whose priorId points to this
 * parent, excluding trashed) as a stack of cards. Each card has a "Select
 * Circuit" button that navigates the operator to the chat screen for that
 * child. Returns the constructed element; caller appends where it wants.
 */
export function mountChildrenList(
    parentId: string,
    allCircuits: CircuitNode[],
    options?: {
        showDescription?: boolean;
        emptyMessage?: string;
        badgeFor?: (child: CircuitNode) => string;
    }
): HTMLElement {
    const showDesc = options?.showDescription ?? false;
    const empty = options?.emptyMessage ?? 'No child circuits point to this node.';
    const badgeFor = options?.badgeFor ?? defaultBadgeFor;

    const childList = h('div', { style: 'display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;' });

    const kids = allCircuits.filter(other => other.priorId === parentId && other.priorId !== '__TRASH__');

    if (kids.length === 0) {
        childList.appendChild(h('div', {
            className: 'k4-subtle',
            textContent: empty
        }));
        return childList;
    }

    kids.forEach(child => {
        const badge = badgeFor(child);
        const nameBlock = showDesc
            ? h('div', {},
                h('strong', { style: 'color: var(--text-primary); font-size: 0.95rem;', textContent: `${badge} ${child.name}` }),
                h('div', { className: 'k4-caption', style: 'margin-top: 2px;', textContent: child.description || '(No description)' })
              )
            : h('span', { style: 'font-weight: bold; color: var(--text-primary);', textContent: `${badge} ${child.name}` });

        childList.appendChild(h('div', {
            style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 6px; padding: 12px; display: flex; justify-content: space-between; align-items: center;'
        },
            nameBlock,
            h('button', {
                textContent: 'Select Circuit',
                className: 'k4-btn-primary',
                style: 'padding: 4px 10px; font-size: 0.8rem;',
                on: { click: () => {
                    selectedCircuitId.value = child.id;
                    pushScreen('chat');
                }}
            })
        ));
    });

    return childList;
}

function defaultBadgeFor(child: CircuitNode): string {
    switch (child.specialization) {
        case 'project':  return '📁';
        case 'view':     return '👁️';
        case 'world':    return '🌍';
        default:         return '⌖';
    }
}

// ─── ADD-CHILD BUTTON ───────────────────────────────────────────────────────

/**
 * "+ Add Child Circuit under this parent" button. Creates a new CircuitNode
 * whose priorId points to the parent, then selects it. Callers pick the
 * default specialization and label — e.g., under a Project you might want
 * "+ Add Child View/Circuit" defaulting to 'view'; under a World you likely
 * want "+ Add Child Circuit" defaulting to 'circuit'.
 */
export function createAddChildButton(
    parentId: string,
    options?: {
        label?: string;
        defaultSpecialization?: CircuitNode['specialization'];
        defaultName?: string;
    }
): HTMLButtonElement {
    return h('button', {
        textContent: options?.label ?? '+ Add Child Circuit',
        className: 'k4-btn-primary',
        style: 'align-self: flex-start;',
        on: { click: async () => {
            const now = Date.now();
            const fresh: CircuitNode = {
                id: `circ-${now}-${Math.random().toString(36).substring(2, 7)}`,
                priorId: parentId,
                specialization: options?.defaultSpecialization ?? 'circuit',
                name: options?.defaultName ?? 'New Child Circuit',
                description: '',
                doc0: '',
                physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
                activeFace: 'P',
                heldAbsentVar: 'I',
                createdAt: now,
                updatedAt: now,
            };
            await vfsDb.upsertCircuit(fresh);
            circuitsGrid.value = await vfsDb.getAllCircuits();
            selectedCircuitId.value = fresh.id;
        }}
    }) as HTMLButtonElement;
}

// ─── SPECIALIZATION EDITOR SHELL ────────────────────────────────────────────

/**
 * Container-editor shell: clears `container`, renders a header widget with the
 * given title, a horizontal tab-nav that highlights the active tab, and a
 * scrollable content wrapper. Invokes `renderTab(activeTab, wrapper)` to fill
 * the wrapper with tab-specific content.
 *
 * The shell is called *inside* the caller's `createEffect` — the caller owns
 * the reactive signals (activeCircuit, activeSubTab, circuitsGrid, etc.) and
 * decides when to re-run. The shell just knows how to lay out one frame.
 *
 * Consumers today are WORLD and PROJECT. Any future specialization editor with
 * the same "header + tabs + content" shape fits here.
 */
export function mountSpecializationEditor(
    container: HTMLElement,
    config: {
        title: string;
        activeTab: string;
        tabs: Array<{ id: string; label: string }>;
        onTabChange: (tabId: string) => void;
        renderTab: (tabId: string, contentWrapper: HTMLElement) => void;
    }
): void {
    container.replaceChildren();

    const header = h('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;' },
        h('h2', { className: 'k4-screen-title', textContent: config.title })
    );

    const nav = h('div', { style: 'display: flex; gap: 8px; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px; flex-wrap: wrap;' });
    for (const t of config.tabs) {
        const isActive = config.activeTab === t.id;
        nav.appendChild(h('button', {
            textContent: t.label,
            className: cx('k4-subnav-tab', isActive && 'active'),
            on: { click: () => config.onTabChange(t.id) }
        }));
    }

    const contentWrapper = h('div', { style: 'flex: 1; overflow-y: auto; display: flex; flex-direction: column;' });
    container.append(header, nav, contentWrapper);

    config.renderTab(config.activeTab, contentWrapper);
}


