// wasm/src/screens/arena-state.ts

import { Signal } from '../reactive';
import { Whole, StanceOverlay, ViewMode, SortTopology } from '../arena/whole';
import { Face, StanceId } from '../arena/registry';
import { LayoutName, DEFAULT_LAYOUT } from '../arena/layout';
import { registerWorldFrame } from '../ledger/world-frame-state';

export type ArenaNavMode = 'top' | 'sub-of' | 'super-of';

export interface ArenaPathNode {
  languageId: string;
  face?: Face;
  stance?: StanceId;
}

export const arenaCache = new Map<string, Whole>();

export function getArenaPathKey(path: ArenaPathNode[]): string {
  return path.map(p => `${p.languageId}${p.face ? `/${p.face}` : ''}${p.stance ? `/${p.stance}` : ''}`).join('::');
}

export const currentArenaPath = new Signal<ArenaPathNode[]>([]);
export const activeWhole = new Signal<Whole | null>(null);

// ─── TOP-LEVEL ARENA TAB SIGNALS ─────────────────────────────────
export const activeArenaTab = new Signal<ViewMode>('spatial');
export const activeArenaLayout = new Signal<LayoutName>(DEFAULT_LAYOUT);
export const activeArenaSort = new Signal<SortTopology>('canonical');

export interface ArenaFrameScratch {
  tab: ViewMode;
  layout: LayoutName;
  sort: SortTopology;
}

// ─── IoC FRAME ADAPTER REGISTRATION ──────────────────────────────
registerWorldFrame('arena', {
  getWorldState: (): ArenaFrameScratch => ({
    tab: activeArenaTab.peek(),
    layout: activeArenaLayout.peek(),
    sort: activeArenaSort.peek(),
  }),
  setWorldState: (raw: unknown) => {
    const state = raw as Partial<ArenaFrameScratch>;
    if (state?.tab) activeArenaTab.value = state.tab;
    if (state?.layout) activeArenaLayout.value = state.layout;
    if (state?.sort) activeArenaSort.value = state.sort;
  }
});

// ───  LIVE TENSION OVERLAYS ───────────────────────────────────────

export const stanceOverlays = new Signal<Record<number, StanceOverlay>>({});

export function updateStanceTensionsFromJSON(jsonText: string): void {
  try {
    const clean = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const startIdx = clean.indexOf('{');
    if (startIdx === -1) return;
    const parsed = JSON.parse(clean.substring(startIdx));
    
    if (Array.isArray(parsed.stances)) {
      const newOverlays: Record<number, StanceOverlay> = {};
      parsed.stances.forEach((s: any) => {
        if (s.id) {
          newOverlays[s.id] = { 
            instance: s.instance,
            concern: s.concern,
            tension: s.tension, 
            example: s.example,
            highlight: true 
          };
        }
      });
      stanceOverlays.value = newOverlays;
    }
  } catch (err) {
    console.warn('[Arena ETL] Failed to parse stance JSON for overlays:', err);
  }
}

