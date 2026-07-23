// wasm/src/arena/arena-state.ts

import { Signal } from '../reactive';
import { Whole } from './whole';
import { Face, StanceId } from './registry';

export type ArenaNavMode = 'top' | 'sub-of' | 'super-of';

export interface ArenaPathNode {
    levelId: string;
    face?: Face;
    stance?: StanceId;
}

export const arenaCache = new Map<string, Whole>();

export function getArenaPathKey(path: ArenaPathNode[]): string {
    return path.map(p => `${p.levelId}${p.face ? `/${p.face}` : ''}${p.stance ? `/${p.stance}` : ''}`).join('::');
}

export const currentArenaPath = new Signal<ArenaPathNode[]>([]);
export const activeWhole = new Signal<Whole | null>(null);
