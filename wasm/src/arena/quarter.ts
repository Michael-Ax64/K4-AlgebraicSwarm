// wasm/ts/src/arena/quarter.ts

// A Quarter is a face vertex (P|U|I|R) plus its 3 stance references. It's
// always contained by a Whole; the Whole hands each Quarter the 4 DOM cells
// it renders into (1 face cell + 3 stance cells) and the Quarter fills them
// according to its current render mode.
//
// Language:  Quarter reads owner.language() by default. Assigning
//            `languageOverride` non-null locks the Quarter to that vocabulary
//            and stops ripple from the Whole; clearing the override re-inherits.
//
// Border affordances (top-right of the face cell):
//   ◐  cycle render mode
//   ⟲  reset (this Quarter's mode + any sub-containers)
//   ×  clear language override (only visible when override is set)

import { createEffect, Signal } from '../reactive';
import { Face, StanceId, Stance, StanceRegistry, stancesFor } from './registry';
import type { Vocabulary } from '../ledger/schema';
import type { Whole } from './whole';

export type RenderMode =
  | 'surrounding'   // vertex small at center corner, 3 stances in the L (default)
  | 'contained'     // vertex + 3 stance chips nested inside the face cell; outer L blank
  | 'vertex-large'  // vertex fills the face cell huge; outer L blank
  | 'algebra-large';// vertex shrinks to a tag; each outer L cell renders its stance large

const MODE_CYCLE: readonly RenderMode[] =
  ['surrounding', 'contained', 'vertex-large', 'algebra-large'];

// Vocabulary lookup — map a K4 face to its operator-domain term.
function termFor(vocab: readonly Vocabulary[], face: Face, fallback: string): string {
  const hit = vocab.find(v => v.k4Type === face);
  return hit?.term ?? fallback;
}

export class Quarter {
  readonly vertex:     Face;
  readonly stanceRefs: readonly [StanceId, StanceId, StanceId];
  readonly owner:      Whole;
  readonly defaultRenderMode: RenderMode;

  readonly renderMode:       Signal<RenderMode>;
  readonly languageOverride: Signal<Vocabulary[] | null>;
  readonly subContainers:    Signal<Quarter[] | null>;

  constructor(
    vertex: Face,
    defaultRenderMode: RenderMode,
    owner: Whole,
  ) {
    this.vertex = vertex;
    this.owner = owner;
    this.defaultRenderMode = defaultRenderMode;
    this.stanceRefs = stancesFor(vertex).map(s => s.id) as unknown as
      readonly [StanceId, StanceId, StanceId];

    this.renderMode       = new Signal<RenderMode>(defaultRenderMode);
    this.languageOverride = new Signal<Vocabulary[] | null>(null);
    this.subContainers    = new Signal<Quarter[] | null>(null);
  }

  /** Effective vocabulary — override wins, else owner's language. */
  effectiveLanguage(): readonly Vocabulary[] {
    const override = this.languageOverride.value;
    return override ?? this.owner.language.value;
  }

  /** Border affordance ◐ — advance render mode. */
  cycleRenderMode(): void {
    const cur = this.renderMode.value;
    const idx = MODE_CYCLE.indexOf(cur);
    this.renderMode.value = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
  }

  /** Border affordance ⟲ — restore this Quarter's default mode
   *  and cascade the reset into any subContainers. */
  resetRenderAndSubs(): void {
    this.renderMode.value = this.defaultRenderMode;
    const subs = this.subContainers.value;
    if (subs) for (const q of subs) q.resetRenderAndSubs();
  }

  /** Border affordance × — drop the local override; re-inherit from owner. */
  clearLanguageOverride(): void {
    this.languageOverride.value = null;
  }

  /** Populate the given cells. Returns a no-op teardown; effects self-clean
   *  when their parent effect re-runs (see reactive.ts eager unsubscription). */
  mount(
    faceCell: HTMLElement,
    stanceCells: readonly [HTMLElement, HTMLElement, HTMLElement],
  ): () => void {
    const stances = this.stanceRefs.map(id => StanceRegistry.get(id)!) as readonly [Stance, Stance, Stance];

    createEffect(() => {
      const mode  = this.renderMode.value;
      const vocab = this.effectiveLanguage();     // reactive on both signals
      const overrideActive = this.languageOverride.value != null;

      if (!faceCell.isConnected) return;          // torn down; noop

      faceCell.className = `arena-cell face face-${this.vertex} mode-${mode}`;
      faceCell.replaceChildren();
      stanceCells.forEach(c => { if (c.isConnected) { c.replaceChildren(); c.className = `arena-cell stance mode-${mode}`; } });

      // ─── border control strip (always on the face cell) ────
      const controls = el('div', { className: 'quarter-controls' });
      controls.appendChild(charBtn('◐', 'cycle mode', () => this.cycleRenderMode()));
      controls.appendChild(charBtn('⟲', 'reset', () => this.resetRenderAndSubs()));
      if (overrideActive) {
        controls.appendChild(charBtn('×', 'clear language override', () => this.clearLanguageOverride()));
      }
      faceCell.appendChild(controls);

      // ─── vertex label (varies by mode, always in the face cell) ────
      const vertexLabel = termFor(vocab, this.vertex, this.vertex);
      const vertexBlock = el('div', { className: 'vertex' });
      vertexBlock.appendChild(el('span', { className: 'vertex-pole', textContent: this.vertex }));
      vertexBlock.appendChild(el('span', { className: 'vertex-term', textContent: vertexLabel }));
      faceCell.appendChild(vertexBlock);

      // ─── stance content, placed per mode ─────────────────────
      switch (mode) {
        case 'surrounding':
          stanceCells.forEach((cell, i) => renderStanceInto(cell, stances[i], vocab, 'normal'));
          break;

        case 'contained': {
          const nest = el('div', { className: 'stances-nested' });
          for (const s of stances) {
            const chip = el('div', { className: 'stance-chip' });
            chip.appendChild(el('span', { className: 'stance-id',   textContent: String(s.id).padStart(2, '0') }));
            chip.appendChild(el('span', { className: 'stance-name', textContent: s.name }));
            chip.appendChild(el('span', { className: 'stance-eq',   textContent: s.eq }));
            nest.appendChild(chip);
          }
          faceCell.appendChild(nest);
          // outer cells stay blank — indicate they're absorbed
          stanceCells.forEach(cell => cell.classList.add('absorbed'));
          break;
        }

        case 'vertex-large':
          vertexBlock.classList.add('large');
          stanceCells.forEach(cell => cell.classList.add('collapsed'));
          break;

        case 'algebra-large':
          vertexBlock.classList.add('tag-only');
          stanceCells.forEach((cell, i) => renderStanceInto(cell, stances[i], vocab, 'large'));
          break;
      }
    });

    return () => {
      // Container clearance is the caller's job; effect noops when disconnected.
    };
  }
}

// ─── local DOM helpers (mirror ledger-ui.ts style) ─────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (string | Node)[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    (element as any)[key] = value;
  }
  for (const child of children) {
    element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}

function charBtn(char: string, tooltip: string, onClick: () => void): HTMLElement {
  const b = el('button', { className: 'quarter-control-char', title: tooltip, textContent: char });
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

function renderStanceInto(cell: HTMLElement, s: Stance, vocab: readonly Vocabulary[], size: 'normal' | 'large'): void {
  cell.className = `arena-cell stance stance-${s.id} size-${size}`;
  cell.replaceChildren();
  const meta = el('div', { className: 'stance-meta' });
  meta.appendChild(el('span', { className: 'stance-id',   textContent: String(s.id).padStart(2, '0') }));
  meta.appendChild(el('span', { className: 'stance-held', textContent: `held ${termFor(vocab, s.held, s.held)}` }));
  cell.appendChild(meta);
  cell.appendChild(el('div', { className: 'stance-name', textContent: s.name }));
  cell.appendChild(el('div', { className: 'stance-eq',   textContent: s.eq }));
}

