// wasm/ts/src/arena/whole.ts

// A Whole is a K4 Circuit. It:
//   - instantiates its 4 Quarters at construction (one per face)
//   - sets each Quarter's initial render mode
//   - exposes a Signal<Vocabulary[]> that all its Quarters inherit from
//   - hosts the tabs (Arena, Numbers, …) and the perspective controls
//     (layout switcher + level/vocabulary switcher) at the top
//
// This module owns only the arena screen for a Whole. The outer "screens"
// framework (chat / arena / log / ledger, with `,` and `.` history) sits
// above and calls `whole.mount(container)`.

import { createEffect, Signal } from '../reactive';
import { Quarter, RenderMode } from './quarter';
import { Face, StanceRegistry, Stance } from './registry';
import { LAYOUTS, LayoutName, DEFAULT_LAYOUT, Layout, Coord } from './layout';
import type { Vocabulary } from '../ledger/schema';
import { vocabGrid, selectedLevelId, levelsGrid } from '../ledger/grid-state';

export type WholeTab = 'arena' | 'numbers';   // more later: 'braid' | 'trace' | …

export interface WholeInit {
  id:      string;
  name:    string;
  levelId: string;                                            // sources vocabulary
  defaults?: Partial<Record<Face, RenderMode>>;               // per-Quarter initial mode
  layout?: LayoutName;                                        // initial layout
}

const DEFAULT_MODE: RenderMode = 'surrounding';

export class Whole {
  readonly id:   string;
  readonly name: string;
  readonly levelId: string;

  readonly language:  Signal<Vocabulary[]>;
  readonly quarters:  readonly [Quarter, Quarter, Quarter, Quarter];
  readonly activeTab: Signal<WholeTab>;
  readonly layoutName: Signal<LayoutName>;

  constructor(init: WholeInit) {
    this.id = init.id;
    this.name = init.name;
    this.levelId = init.levelId;

    this.language   = new Signal<Vocabulary[]>([]);
    this.activeTab  = new Signal<WholeTab>('arena');
    this.layoutName = new Signal<LayoutName>(init.layout ?? DEFAULT_LAYOUT);

    // Keep language in sync with the app-level vocab grid, filtered to this
    // Whole's Level. Ledger edits to vocabulary ripple into this Signal,
    // then into all four Quarters that read it.
    createEffect(() => {
      const all = vocabGrid.value;
      // vocabGrid is already scoped to selectedLevelId in grid-state.ts.
      // For a Whole whose levelId != selectedLevelId we'd need an async
      // fetch; for now we assume the active Whole is the selected level.
      this.language.value = all;
    });

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

  /** Mount the Whole into a container. Returns teardown. */
  mount(container: HTMLElement): () => void {
    container.classList.add('whole');
    container.replaceChildren();

    const perspective = el('div', { className: 'whole-perspective' });
    const tabbar      = el('div', { className: 'whole-tabbar' });
    const body        = el('div', { className: 'whole-body' });
    container.append(perspective, tabbar, body);

    // ─── perspective controls (top of the Whole) ────────────────
    // Layout + Level are two perspectives. Both re-render without
    // touching object identity — only the render pipeline reads them.
    createEffect(() => {
      if (!perspective.isConnected) return;
      const curLayout = this.layoutName.value;
      const levels    = levelsGrid.value;
      const curLevel  = selectedLevelId.value;

      perspective.replaceChildren();

      const layoutSel = el('select', { className: 'perspective-select' });
      for (const name of Object.keys(LAYOUTS) as LayoutName[]) {
        const opt = el('option', { value: name, textContent: name, selected: name === curLayout });
        layoutSel.appendChild(opt);
      }
      layoutSel.addEventListener('change', () => {
        this.layoutName.value = layoutSel.value as LayoutName;
      });

      const levelSel = el('select', { className: 'perspective-select' });
      for (const lv of levels) {
        levelSel.appendChild(el('option', { value: lv.id, textContent: lv.name, selected: lv.id === curLevel }));
      }
      levelSel.addEventListener('change', () => {
        selectedLevelId.value = levelSel.value;
      });

      perspective.append(
        el('span', { className: 'perspective-label', textContent: 'layout' }),
        layoutSel,
        el('span', { className: 'perspective-label', textContent: 'language' }),
        levelSel,
        el('span', { className: 'perspective-name', textContent: this.name }),
      );
    });

    // ─── tab bar ────────────────────────────────────────────────
    createEffect(() => {
      if (!tabbar.isConnected) return;
      const active = this.activeTab.value;
      tabbar.replaceChildren();
      const tabs: readonly { id: WholeTab; label: string }[] = [
        { id: 'arena',   label: 'arena'   },
        { id: 'numbers', label: 'numbers' },
      ];
      for (const t of tabs) {
        const btn = el('button', {
          className: `whole-tab ${t.id === active ? 'active' : ''}`,
          textContent: t.label,
        });
        btn.addEventListener('click', () => { this.activeTab.value = t.id; });
        tabbar.appendChild(btn);
      }
    });

    // ─── body: swap by active tab ───────────────────────────────
    createEffect(() => {
      if (!body.isConnected) return;
      const tab = this.activeTab.value;
      body.replaceChildren();
      switch (tab) {
        case 'arena':   this.mountArenaTab(body); break;
        case 'numbers': this.mountNumbersTab(body); break;
      }
    });

    return () => container.replaceChildren();
  }

  // ─── Arena tab: 4×4 grid, each Quarter fills 4 cells ──────────
  private mountArenaTab(body: HTMLElement): void {
    createEffect(() => {
      if (!body.isConnected) return;
      const layout: Layout = LAYOUTS[this.layoutName.value];
      body.replaceChildren();

      const grid = el('div', { className: 'arena-grid' });
      // Build all 16 cells, keyed by "r,c". Face cells and stance cells get their
      // classes and content from Quarter.mount(); empty non-arena cells stay blank
      // (there are none in a 4×4 with 4 faces + 12 signs, but future layouts might).
      const cellByCoord = new Map<string, HTMLElement>();
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const cell = el('div', { className: 'arena-cell empty' });
          cell.dataset.rc = `${r},${c}`;
          cellByCoord.set(`${r},${c}`, cell);
          grid.appendChild(cell);
        }
      }
      body.appendChild(grid);

      // Hand each Quarter its 4 DOM cells.
      for (const q of this.quarters) {
        const [fr, fc] = layout.facePosition[q.vertex];
        const faceCell = cellByCoord.get(`${fr},${fc}`)!;
        const surrounding = surroundingCells(layout, q.vertex).map(([r, c]) =>
          cellByCoord.get(`${r},${c}`)!
        ) as [HTMLElement, HTMLElement, HTMLElement];
        q.mount(faceCell, surrounding);
      }
    });
  }

  // ─── Numbers tab: the same 12 stances, numeric render ─────────
  private mountNumbersTab(body: HTMLElement): void {
    createEffect(() => {
      if (!body.isConnected) return;
      body.replaceChildren();
      const table = el('table', { className: 'numbers-table' });
      const thead = el('thead');
      const trh = el('tr');
      for (const h of ['#', 'name', 'eq', 'face', 'held', 'R', 'L', 'C', 'ω']) {
        trh.appendChild(el('th', { textContent: h }));
      }
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = el('tbody');
      const rows: Stance[] = [];
      for (const s of StanceRegistry.values()) rows.push(s);
      rows.sort((a, b) => a.id - b.id);
      for (const s of rows) {
        const tr = el('tr');
        tr.appendChild(el('td', { className: 'num-id',   textContent: String(s.id).padStart(2, '0') }));
        tr.appendChild(el('td', { className: 'num-name', textContent: s.name }));
        tr.appendChild(el('td', { className: 'num-eq',   textContent: s.eq }));
        tr.appendChild(el('td', { className: 'num-face', textContent: s.face }));
        tr.appendChild(el('td', { className: 'num-held', textContent: s.held }));
        tr.appendChild(el('td', { className: 'num',      textContent: String(s.geometry.R) }));
        tr.appendChild(el('td', { className: 'num',      textContent: String(s.geometry.L) }));
        tr.appendChild(el('td', { className: 'num',      textContent: String(s.geometry.C) }));
        tr.appendChild(el('td', { className: 'num',      textContent: String(s.geometry.w) }));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      body.appendChild(table);
    });
  }
}

// Re-export the layout helper so callers of Whole don't need to import layout.ts too.
import { surroundingCellsFor as surroundingCells } from './layout';
export { surroundingCells };

// Local DOM helper (matches ledger-ui.ts style).
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { dataset?: Record<string, string> } = {},
  children: (string | Node)[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'dataset' && value) {
      for (const [dk, dv] of Object.entries(value)) element.dataset[dk] = dv as string;
    } else {
      (element as any)[key] = value;
    }
  }
  for (const child of children) {
    element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}
