// wasm/src/arena/registry.ts
//
// Single source of truth for the 12 K4 stances on the TypeScript side.
// The numbering here MUST match `Stance::facet_id` / `Stance::from_facet_id`
// in `rust/src/algebra.rs`, and the FACETS/STANCES enumerations in the four
// prompt harnesses. Ordering runs face-by-face (P, I, U, R); within a face,
// squared-numerator-over-ground first, then squared-numerator-over-product,
// then simple product/ratio.
//
// The `name` field uses the Paradox vocabulary (the polyglot parser default).
// The Rust engine's `Stance::equation_name()` returns the same set. Other
// vocabularies (Bridge, Controller) are handled by `parse_stance_from_name`
// on the Rust side; the UI reads and shows only this one.

export type Face     = 'P' | 'U' | 'I' | 'R';
export type StanceId = 1|2|3|4|5|6|7|8|9|10|11|12;

// The immutable geometry. `held` is the absent pole (the dropped coordinate).
// R/L/C/w are per-stance AC substrate defaults used by the Circuit Workbench;
// they are UI-side hints, not engine inputs.
export const STANCES_GEOMETRY = [
  { id:  1, eq: "P = U^2 / R", face: "P", held: "I", R:  20, L:  50, C: 0.05,  w:  5   },
  { id:  2, eq: "P = I^2 * R", face: "P", held: "U", R:  50, L:  20, C: 0.2,   w: 15   },
  { id:  3, eq: "P = U * I",   face: "P", held: "R", R:   5, L:  10, C: 0.1,   w: 10   },
  { id:  4, eq: "I = sqrt(P/R)", face: "I", held: "U", R:  15, L:   5, C: 0.3,   w: 12   },
  { id:  5, eq: "I = P / U",   face: "I", held: "R", R:  10, L:  80, C: 0.01,  w:  2   },
  { id:  6, eq: "I = U / R",   face: "I", held: "P", R:  30, L:  40, C: 0.05,  w:  1   },
  { id:  7, eq: "U = P / I",   face: "U", held: "R", R:  20, L:  60, C: 0.1,   w:  3   },
  { id:  8, eq: "U = I * R",   face: "U", held: "P", R:  80, L:  10, C: 0.05,  w:  4   },
  { id:  9, eq: "U = sqrt(P*R)", face: "U", held: "I", R:  40, L:  30, C: 0.02,  w:  1.5 },
  { id: 10, eq: "R = U / I",   face: "R", held: "P", R: 100, L: 150, C: 0.001, w:  0.5 },
  { id: 11, eq: "R = U^2 / P", face: "R", held: "I", R: 120, L: 200, C: 0.01,  w:  0.2 },
  { id: 12, eq: "R = P / I^2", face: "R", held: "U", R: 180, L:   5, C: 0.5,   w: 20   },
];

export interface Stance {
  id:       StanceId;
  name:     string;
  eq:       string;
  face:     Face;
  held:     Face;
  geometry: { R: number; L: number; C: number; w: number };
}

// Paradox-canonical display names. Matches Rust `Stance::spec_name(Paradox)`.
const NAMES: Record<StanceId, string> = {
   1: 'Leverage',
   2: 'Momentum',
   3: 'Synthesis',
   4: 'Resonance',
   5: 'Extraction',
   6: 'Ohmic',
   7: 'Tension',
   8: 'Architecture',
   9: 'Capacity',
  10: 'Impedance',
  11: 'Accounting',
  12: 'Brittleness',
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

export function stancesFor(face: Face): readonly [Stance, Stance, Stance] {
  const three: Stance[] = [];
  for (const s of StanceRegistry.values()) {
    if (s.face === face) three.push(s);
  }
  three.sort((a, b) => a.id - b.id);
  if (three.length !== 3) throw new Error(`Registry corrupt: face ${face} has ${three.length} stances`);
  return three as [Stance, Stance, Stance];
}

// Sanity: every face must have exactly 3 stances. Fails fast at load if not.
(() => {
  for (const f of ['P','U','I','R'] as Face[]) stancesFor(f);
})();

