// wasm/src/arena/quarter.ts

import { createEffect, Signal } from '../reactive';
import { Face, StanceId, Stance, StanceRegistry, stancesFor } from './registry';
import type { Vocabulary } from '../ledger/schema';
import type { Whole } from './whole';
import { h } from '../dom';

export type RenderMode =
  | 'surrounding'   // vertex small at center corner, 3 stances in the L (default)
  | 'contained'     // vertex + 3 stance chips nested inside the face cell; outer L blank
  | 'vertex-large'  // vertex fills the face cell huge; outer L blank
  | 'algebra-large';// vertex shrinks to a tag; each outer L cell renders its stance large

const MODE_CYCLE: readonly RenderMode[] =
  ['surrounding', 'contained', 'vertex-large', 'algebra-large'];

/**
 * Resolves the primary domain word for a K4 Pole (P, U, I, R).
 * Prioritizes core pole nouns over stance equation terms.
 */
export function termFor(vocab: readonly Vocabulary[], face: Face, fallback: string): string {
  if (!vocab || vocab.length === 0) return fallback;

  // 1. Prefer core pole noun (term without equation parentheses)
  const coreHit = vocab.find(v => v.k4Type === face && !v.term.includes('(') && !v.term.includes('='));
  if (coreHit && coreHit.term.trim()) {
    return coreHit.term.trim();
  }

  // 2. Fallback: match first hit and strip parenthetical equation
  const firstHit = vocab.find(v => v.k4Type === face);
  if (!firstHit) return fallback;

  const cleaned = firstHit.term.replace(/\s*\(.*?\)/g, '').trim();
  return cleaned || fallback;
}

export class Quarter {
  readonly vertex: Face;
  readonly stanceRefs: readonly [StanceId, StanceId, StanceId];
  readonly owner: Whole;
  readonly defaultRenderMode: RenderMode;

  readonly renderMode: Signal<RenderMode>;
  readonly languageOverride: Signal<Vocabulary[] | null>;
  readonly subContainers: Signal<Quarter[] | null>;

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

    this.renderMode = new Signal<RenderMode>(defaultRenderMode);
    this.languageOverride = new Signal<Vocabulary[] | null>(null);
    this.subContainers = new Signal<Quarter[] | null>(null);
  }

  effectiveLanguage(): readonly Vocabulary[] {
    const override = this.languageOverride.value;
    return override ?? this.owner.language.value;
  }

  cycleRenderMode(): void {
    const cur = this.renderMode.value;
    const idx = MODE_CYCLE.indexOf(cur);
    this.renderMode.value = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
  }

  resetRenderAndSubs(): void {
    this.renderMode.value = this.defaultRenderMode;
    const subs = this.subContainers.value;
    if (subs) for (const q of subs) q.resetRenderAndSubs();
  }

  clearLanguageOverride(): void {
    this.languageOverride.value = null;
  }

  mount(
    faceCell: HTMLElement,
    stanceCells: readonly [HTMLElement, HTMLElement, HTMLElement],
  ): () => void {
    const stances = this.stanceRefs.map(id => StanceRegistry.get(id)!) as readonly [Stance, Stance, Stance];

    createEffect(() => {
      const mode = this.renderMode.value;
      const vocab = this.effectiveLanguage();
      const overrideActive = this.languageOverride.value != null;

      if (!faceCell.isConnected) return;

      faceCell.className = `arena-cell face face-${this.vertex} mode-${mode}`;
      faceCell.replaceChildren();
      stanceCells.forEach(c => { if (c.isConnected) { c.replaceChildren(); c.className = `arena-cell stance mode-${mode}`; } });

      const controls = h('div', { className: 'quarter-controls' });
      controls.appendChild(charBtn('◐', 'cycle mode', () => this.cycleRenderMode()));
      controls.appendChild(charBtn('⟲', 'reset', () => this.resetRenderAndSubs()));
      if (overrideActive) {
        controls.appendChild(charBtn('×', 'clear language override', () => this.clearLanguageOverride()));
      }
      faceCell.appendChild(controls);

      const vertexLabel = termFor(vocab, this.vertex, this.vertex);
      const vertexBlock = h('div', { className: 'vertex' });
      vertexBlock.appendChild(h('span', { className: 'vertex-pole', textContent: this.vertex }));
      vertexBlock.appendChild(h('span', { className: 'vertex-term', textContent: vertexLabel }));
      faceCell.appendChild(vertexBlock);

      switch (mode) {
        case 'surrounding':
          stanceCells.forEach((cell, i) => renderStanceInto(cell, stances[i], vocab, 'normal'));
          break;

        case 'contained': {
          const nest = h('div', { className: 'stances-nested' });
          for (const s of stances) {
            const chip = h('div', { className: 'stance-chip' });
            chip.appendChild(h('span', { className: 'stance-id', textContent: String(s.id).padStart(2, '0') }));
            chip.appendChild(h('span', { className: 'stance-name', textContent: s.name }));
            chip.appendChild(h('span', { className: 'stance-eq', textContent: s.eq }));
            nest.appendChild(chip);
          }
          faceCell.appendChild(nest);
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

    return () => {};
  }
}

function charBtn(char: string, tooltip: string, onClick: () => void): HTMLElement {
  const b = h('button', { className: 'quarter-control-char', title: tooltip, textContent: char });
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

function renderStanceInto(cell: HTMLElement, s: Stance, vocab: readonly Vocabulary[], size: 'normal' | 'large'): void {
  cell.className = `arena-cell stance stance-${s.id} size-${size}`;
  cell.replaceChildren();
  const meta = h('div', { className: 'stance-meta' });
  meta.appendChild(h('span', { className: 'stance-id', textContent: String(s.id).padStart(2, '0') }));
  meta.appendChild(h('span', { className: 'stance-held', textContent: `held ${termFor(vocab, s.held, s.held)}` }));
  cell.appendChild(meta);
  cell.appendChild(h('div', { className: 'stance-name', textContent: s.name }));
  cell.appendChild(h('div', { className: 'stance-eq', textContent: s.eq }));
}

