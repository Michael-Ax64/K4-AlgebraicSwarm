// wasm/ts/src/arena/registry.ts

// The single source of truth for the 12 K4 stances.
// Wholes and Quarters hold only StanceId references; content flows from here.
// Numbers (R, L, C, ω) come straight from STANCES_GEOMETRY in the ontology
// compiler — kept in sync at import, not duplicated.

import { STANCES_GEOMETRY } from '../ledger/ontology-compiler';

export type Face     = 'P' | 'U' | 'I' | 'R';
export type StanceId = 1|2|3|4|5|6|7|8|9|10|11|12;

export interface Stance {
  id:       StanceId;
  name:     string;      // canonical K4 name (Paradox-table default; other roles rename)
  eq:       string;      // human-readable equation
  face:     Face;        // the pole this stance solves for
  held:     Face;        // the pole bracketed out (AbsentVar)
  geometry: { R: number; L: number; C: number; w: number };
}

// K4-canonical names paired with the numeric geometry.
// Names match the ParadoxEngine table (first-hit default in stance_names.rs).
// If you want role-flavored names on a per-view basis, thread a `SpecRole`
// argument through the renderer — the underlying (id, face, held) is invariant.
const NAMES: Record<StanceId, string> = {
  1: 'Synthesis',
  2: 'Leverage',
  3: 'Momentum',
  4: 'Diffusion',
  5: 'Conductance',
  6: 'Root Draw',
  7: 'Voltage',
  8: "Ohm's",
  9: 'Realization',
  10: 'Impedance',
  11: 'Accounting',
  12: 'Friction',
};

// Freeze the map at module load so downstream code can rely on identity.
export const StanceRegistry: ReadonlyMap<StanceId, Stance> = new Map(
  STANCES_GEOMETRY.map(g => {
    const id = g.id as StanceId;
    const stance: Stance = {
      id,
      name:     NAMES[id],
      eq:       g.eq,
      face:     g.face  as Face,
      held:     g.held  as Face,
      geometry: { R: g.R, L: g.L, C: g.C, w: g.w },
    };
    return [id, stance] as const;
  })
);

// The 3 stances on a face, in ascending K4-id order.
// Callers wanting arena-CCW order should use the layout's outerRing, not this.
export function stancesFor(face: Face): readonly [Stance, Stance, Stance] {
  const three: Stance[] = [];
  for (const s of StanceRegistry.values()) {
    if (s.face === face) three.push(s);
  }
  three.sort((a, b) => a.id - b.id);
  if (three.length !== 3) throw new Error(`Registry corrupt: face ${face} has ${three.length} stances`);
  return three as [Stance, Stance, Stance];
}

// Sanity — every face has exactly 3 stances. Runs at module load.
(() => {
  for (const f of ['P','U','I','R'] as Face[]) stancesFor(f);
})();
