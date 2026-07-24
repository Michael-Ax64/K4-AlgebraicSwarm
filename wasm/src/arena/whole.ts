// wasm/src/arena/whole.ts

import { createEffect, Signal } from '../reactive';
import { Quarter, RenderMode, termFor } from './quarter';
import { Face, StanceRegistry, Stance } from './registry';
import { LAYOUTS, LayoutName, DEFAULT_LAYOUT, Layout } from './layout';
import type { Vocabulary } from '../ledger/schema';
import { vocabGrid, selectedLanguageId, languagesGrid } from '../ledger/grid-state';
import { h } from '../dom';

export type ViewMode = 'spatial' | 'typographic' | 'data-grid';
export type SortTopology = 'canonical' | 'face-grouped' | 'tension' | 'braid';

export interface StanceOverlay {
  tension?: string;
  highlight?: boolean;
}

export interface WholeInit {
  id:      string;
  name:    string;
  languageId: string;
  defaults?: Partial<Record<Face, RenderMode>>;
  layout?: LayoutName;
  viewMode?: ViewMode;
  sortTopology?: SortTopology;
  hideControls?: boolean;
  overlays?: Record<number, StanceOverlay>;
  onStanceClick?: (stance: Stance) => void;
}

const DEFAULT_MODE: RenderMode = 'surrounding';

/**
 * Translates abstract K4 equation strings (e.g. "P = U^2 / R") 
 * into live domain nouns based on the active Vocabulary dictionary.
 */
export function translateEquation(eq: string, vocab: readonly Vocabulary[]): string {
    const cleanTerm = (face: any) => termFor(vocab, face, face).replace(/\s+/g, '');
    const p = cleanTerm('P');
    const u = cleanTerm('U');
    const i = cleanTerm('I');
    const r = cleanTerm('R');

    return eq
        .replace(/\bP\b/g, p)
        .replace(/\bU\b/g, u)
        .replace(/\bI\b/g, i)
        .replace(/\bR\b/g, r);
}

export class Whole {
  readonly id:   string;
  readonly name: string;
  readonly languageId: string;

  readonly language:  Signal<Vocabulary[]>;
  readonly quarters:  readonly [Quarter, Quarter, Quarter, Quarter];
  
  readonly layoutName: Signal<LayoutName>;
  readonly viewMode: Signal<ViewMode>;
  readonly sortTopology: Signal<SortTopology>;
  
  readonly typoCols: Signal<number>;
  readonly typoFlow: Signal<'row' | 'column'>;
  
  readonly hideControls: boolean;
  readonly overlays: Signal<Record<number, StanceOverlay>>;
  readonly onStanceClick?: (stance: Stance) => void;

  constructor(init: WholeInit) {
    this.id = init.id;
    this.name = init.name;
    this.languageId = init.languageId;

    this.language   = new Signal<Vocabulary[]>([]);
    this.layoutName = new Signal<LayoutName>(init.layout ?? DEFAULT_LAYOUT);
    
    this.viewMode = new Signal<ViewMode>(init.viewMode ?? 'spatial');
    this.sortTopology = new Signal<SortTopology>(init.sortTopology ?? 'canonical');
    
    this.typoCols = new Signal<number>(3);
    this.typoFlow = new Signal<'row'|'column'>('row');

    this.hideControls = init.hideControls ?? false;
    this.overlays = new Signal<Record<number, StanceOverlay>>(init.overlays ?? {});
    this.onStanceClick = init.onStanceClick;

    createEffect(() => { this.language.value = vocabGrid.value; });

    const defaults = init.defaults ?? {};
    this.quarters = (['P','U','I','R'] as Face[]).map(face =>
      new Quarter(face, defaults[face] ?? DEFAULT_MODE, this)
    ) as unknown as readonly [Quarter, Quarter, Quarter, Quarter];
  }

  quarterFor(face: Face): Quarter {
    const q = this.quarters.find(q => q.vertex === face);
    if (!q) throw new Error(`Quarter for face ${face} missing`);
    return q;
  }

  mount(container: HTMLElement): () => void {
    container.classList.add('whole');
    container.replaceChildren();

    const perspective = h('div', { className: 'whole-perspective' });
    const tabbar      = h('div', { className: 'whole-tabbar' });
    const body        = h('div', { className: 'whole-body' });
    container.append(perspective, tabbar, body);

    // ─── 1. Perspective Controls ─────────
    createEffect(() => {
      if (!perspective.isConnected) return;
      if (this.hideControls) { perspective.style.display = 'none'; return; }
      perspective.replaceChildren();

      const curLayout = this.layoutName.value;
      const curSort   = this.sortTopology.value;
      const vMode     = this.viewMode.value;
      const curLang   = selectedLanguageId.value;

      if (vMode === 'spatial') {
          const layoutSel = h('select', { className: 'perspective-select' });
          for (const name of Object.keys(LAYOUTS) as LayoutName[]) {
            layoutSel.appendChild(h('option', { value: name, textContent: name, selected: name === curLayout }));
          }
          layoutSel.addEventListener('change', () => { this.layoutName.value = layoutSel.value as LayoutName; });
          perspective.append(h('span', { className: 'perspective-label', textContent: 'layout' }), layoutSel);
      } else {
          const sortSel = h('select', { className: 'perspective-select' });
          for (const name of ['canonical', 'face-grouped', 'tension', 'braid'] as SortTopology[]) {
            sortSel.appendChild(h('option', { value: name, textContent: name, selected: name === curSort }));
          }
          sortSel.addEventListener('change', () => { this.sortTopology.value = sortSel.value as SortTopology; });
          perspective.append(h('span', { className: 'perspective-label', textContent: 'order by' }), sortSel);
      }

      if (vMode === 'typographic') {
          const colsSel = h('select', { className: 'perspective-select' });
          [1, 2, 3, 4, 6].forEach(c => colsSel.appendChild(h('option', { value: c.toString(), textContent: `${c} Cols`, selected: c === this.typoCols.value })));
          colsSel.addEventListener('change', () => this.typoCols.value = parseInt(colsSel.value));

          const flowSel = h('select', { className: 'perspective-select' });
          ['row', 'column'].forEach(f => flowSel.appendChild(h('option', { value: f, textContent: f, selected: f === this.typoFlow.value })));
          flowSel.addEventListener('change', () => this.typoFlow.value = flowSel.value as 'row'|'column');

          perspective.append(h('span', { className: 'perspective-label', textContent: 'grid' }), colsSel, flowSel);
      }

      const langSel = h('select', { className: 'perspective-select' });
      for (const lv of languagesGrid.value) {
        langSel.appendChild(h('option', { value: lv.id, textContent: lv.name, selected: lv.id === curLang }));
      }
      langSel.addEventListener('change', () => { selectedLanguageId.value = langSel.value; });

      perspective.append(
        h('span', { className: 'perspective-label', textContent: 'language' }),
        langSel,
        h('span', { className: 'perspective-name', textContent: this.name })
      );
    });

    // ─── 2. ViewMode Tabs ────
    createEffect(() => {
      if (!tabbar.isConnected) return;
      if (this.hideControls) { tabbar.style.display = 'none'; return; }
      const active = this.viewMode.value;
      tabbar.replaceChildren();
      const tabs: readonly { id: ViewMode; label: string }[] = [
        { id: 'spatial',     label: 'Spatial Grid' },
        { id: 'typographic', label: 'Typographic' },
        { id: 'data-grid',   label: 'Data Grid' },
      ];
      for (const t of tabs) {
        const btn = h('button', { className: `whole-tab ${t.id === active ? 'active' : ''}`, textContent: t.label });
        btn.addEventListener('click', () => { this.viewMode.value = t.id; });
        tabbar.appendChild(btn);
      }
    });

    // ─── 3. Body Switcher ────
    createEffect(() => {
      if (!body.isConnected) return;
      body.replaceChildren();
      switch (this.viewMode.value) {
        case 'spatial':     this.mountSpatialTab(body); break;
        case 'typographic': this.mountTypographicTab(body); break;
        case 'data-grid':   this.mountDataGridTab(body); break;
      }
    });

    return () => container.replaceChildren();
  }

  private mountSpatialTab(body: HTMLElement): void {
    createEffect(() => {
      if (!body.isConnected) return;
      const layout: Layout = LAYOUTS[this.layoutName.value];
      body.replaceChildren();

      const grid = h('div', { className: 'arena-grid' });
      const cellByCoord = new Map<string, HTMLElement>();
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const cell = h('div', { className: 'arena-cell empty' });
          cellByCoord.set(`${r},${c}`, cell);
          grid.appendChild(cell);
        }
      }
      body.appendChild(grid);

      for (const q of this.quarters) {
        const [fr, fc] = layout.facePosition[q.vertex];
        const faceCell = cellByCoord.get(`${fr},${fc}`)!;
        const surrounding = surroundingCells(layout, q.vertex).map(([r, c]) => cellByCoord.get(`${r},${c}`)!) as [HTMLElement, HTMLElement, HTMLElement];
        q.mount(faceCell, surrounding);
      }
    });
  }

  private mountTypographicTab(body: HTMLElement): void {
    createEffect(() => {
      if (!body.isConnected) return;
      body.replaceChildren();
      
      const vocab = this.language.value;
      const overlays = this.overlays.value;
      const cols = this.typoCols.value;
      const flow = this.typoFlow.value;
      
      const getGridStyle = (itemCount: number) => {
          if (flow === 'row') {
              return `display: grid; grid-template-columns: repeat(${cols}, 1fr); grid-auto-flow: row; gap: 12px;`;
          } else {
              const rows = Math.ceil(itemCount / cols);
              return `display: grid; grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, auto); grid-auto-flow: column; gap: 12px;`;
          }
      };

      const renderCard = (s: Stance) => {
          const over = overlays[s.id as number] || {};
          const translatedEq = translateEquation(s.eq, vocab);
          const card = h('div', { className: `paradox-card ${over.highlight ? 'highlight' : ''}` });
          
          card.innerHTML = `
              <div class="paradox-name"><span style="color:var(--text-muted);font-size:0.8em">#${String(s.id).padStart(2, '0')}</span> ${s.name}</div>
              
              <!-- LINE 1: Normal Raw Formula -->
              <div style="font-family:var(--font-mono); color:var(--text-primary); font-size:0.9rem; font-weight:bold; margin-top:6px; margin-bottom:3px;">
                  ${s.eq}
              </div>

              <!-- LINE 2: Simple Domain Translation in Words -->
              <div style="font-family:var(--font-sans); color:var(--role-bridge); font-size:0.85rem; font-weight:600; margin-bottom:8px;">
                  ${translatedEq}
              </div>

              <!-- LINE 3: Fuller Details & Metadata -->
              <div class="paradox-meta" style="border-top:1px dashed var(--border-subtle); padding-top:6px; font-size:0.75rem; color:var(--text-muted);">
                  Home: <strong style="color:var(--text-secondary)">${termFor(vocab, s.face, s.face)}</strong><br/>
                  Absent: <strong style="color:var(--text-secondary)">${termFor(vocab, s.held, s.held)}</strong>
              </div>

              ${over.tension ? `<div class="paradox-tension" style="margin-top:8px;">${over.tension}</div>` : ''}
          `;
          
          if (this.onStanceClick) {
              card.style.cursor = 'pointer';
              card.addEventListener('click', () => this.onStanceClick!(s));
          }
          return card;
      };

      const wrapper = h('div', { className: 'paradox-grid' });
      
      if (this.sortTopology.value === 'face-grouped') {
          for (const face of ['P', 'U', 'I', 'R'] as Face[]) {
              const faceStances = Array.from(StanceRegistry.values()).filter(s => s.face === face).sort((a,b) => a.id - b.id);
              if (faceStances.length === 0) continue;
              wrapper.appendChild(h('div', { className: 'paradox-face-header', textContent: `FACE: ${termFor(vocab, face, face)} (${face})` }));
              const row = h('div', { style: getGridStyle(faceStances.length) });
              for (const s of faceStances) row.appendChild(renderCard(s));
              wrapper.appendChild(row);
          }
      } else {
          const sorted = this.getSortedStances();
          const row = h('div', { style: getGridStyle(sorted.length) });
          for (const s of sorted) row.appendChild(renderCard(s));
          wrapper.appendChild(row);
      }
      
      body.appendChild(wrapper);
    });
  }

  private mountDataGridTab(body: HTMLElement): void {
    createEffect(() => {
      if (!body.isConnected) return;
      body.replaceChildren();
      
      const table = h('table', { className: 'numbers-table' });
      const thead = h('thead');
      const trh = h('tr');
      for (const headerText of ['#', 'name', 'eq', 'translated', 'face', 'held', 'R', 'L', 'C', 'ω']) {
        trh.appendChild(h('th', { textContent: headerText }));
      }
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = h('tbody');
      const vocab = this.language.value;
      const sorted = this.getSortedStances();

      for (const s of sorted) {
        const translatedEq = translateEquation(s.eq, vocab);
        const tr = h('tr');
        tr.appendChild(h('td', { className: 'num-id',   textContent: String(s.id).padStart(2, '0') }));
        tr.appendChild(h('td', { className: 'num-name', textContent: s.name }));
        tr.appendChild(h('td', { className: 'num-eq',   textContent: s.eq }));
        tr.appendChild(h('td', { className: 'num-eq',   style: 'color:var(--role-bridge); font-weight:600;', textContent: translatedEq }));
        tr.appendChild(h('td', { className: 'num-face', textContent: termFor(vocab, s.face, s.face) }));
        tr.appendChild(h('td', { className: 'num-held', textContent: termFor(vocab, s.held, s.held) }));
        tr.appendChild(h('td', { className: 'num',      textContent: String(s.geometry.R) }));
        tr.appendChild(h('td', { className: 'num',      textContent: String(s.geometry.L) }));
        tr.appendChild(h('td', { className: 'num',      textContent: String(s.geometry.C) }));
        tr.appendChild(h('td', { className: 'num',      textContent: String(s.geometry.w) }));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      body.appendChild(table);
    });
  }

  private getSortedStances(): Stance[] {
      const stances = Array.from(StanceRegistry.values());
      const sort = this.sortTopology.value;
      
      if (sort === 'canonical') {
          stances.sort((a,b) => a.id - b.id);
      } else if (sort === 'face-grouped') {
          const order: Record<string, number> = { 'P': 1, 'U': 2, 'I': 3, 'R': 4 };
          stances.sort((a,b) => order[a.face] - order[b.face] || a.id - b.id);
      } else if (sort === 'tension') {
          stances.sort((a,b) => b.geometry.w - a.geometry.w);
      } else if (sort === 'braid') {
          const s1 = StanceRegistry.get(1)!;
          const isAdjacent = (s: Stance) => (s.face === s1.face && s.held !== s1.held) || (s.held === s1.held && s.face !== s1.face);
          stances.sort((a,b) => {
              const aAdj = a.id === s1.id ? -1 : (isAdjacent(a) ? 0 : 1);
              const bAdj = b.id === s1.id ? -1 : (isAdjacent(b) ? 0 : 1);
              return aAdj - bAdj || a.id - b.id;
          });
      }
      return stances;
  }
}

import { surroundingCellsFor as surroundingCells } from './layout';
export { surroundingCells };

