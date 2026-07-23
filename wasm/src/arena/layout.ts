// wasm/ts/src/arena/layout.ts
//
// The arena's 4×4 geometry is separated from the object model so that
// alternate framings (seasonal, unit-circle, and others) are pure data —
// swapping a layout re-renders without touching Whole or Quarter identity.
//
// Coordinate system:  (row, col) with row 0 at the top, col 0 at the left.
//                     Center 2×2 = the 4 face vertices.
//                     Outer ring  = the 12 stance cells.
//
// The `outerRing` array is always given in **CCW zodiacal order starting
// from Aries**, so ring index i corresponds to stance-position i within
// the whole (index 0..2 = spring signs, 3..5 = summer, 6..8 = fall, 9..11 = winter).
// This holds regardless of which corner spring occupies — the layout only
// changes *where* each of those cells sits on the grid.

import { Face, StanceId, stancesFor } from './registry';

export type Coord = readonly [row: number, col: number];

export type LayoutName =
  | 'seasonal-ccw'      // bl=spring, br=summer, tr=fall, tl=winter  (the locked default)
  | 'unit-circle-ccw';  // tr=spring, tl=summer, bl=fall, br=winter  (math quadrants I..IV)

export type Direction = 'ccw' | 'cw';

export interface Layout {
  name:         LayoutName;
  direction:    Direction;
  /** Which grid cell holds each face vertex. */
  facePosition: Readonly<Record<Face, Coord>>;
  /** 12 outer cells, in CCW zodiacal order starting from Aries.
   *  outerRing[i] holds the stance at position i (see notes above). */
  outerRing:    ReadonlyArray<Coord>;
}

// ─── seasonal-ccw ────────────────────────────────────────────────
// bl=spring/U, br=summer/P, tr=fall/R, tl=winter/I.
// Aries starts at mid-left (row 2, col 0) and the ring sweeps CCW
// around the perimeter.
const SEASONAL_CCW: Layout = {
  name: 'seasonal-ccw',
  direction: 'ccw',
  facePosition: {
    U: [2, 1],  // spring   — BL of center
    P: [2, 2],  // summer   — BR of center
    R: [1, 2],  // fall     — TR of center
    I: [1, 1],  // winter   — TL of center
  },
  outerRing: [
    [2, 0], [3, 0], [3, 1],   // Aries, Taurus, Gemini      → face U
    [3, 2], [3, 3], [2, 3],   // Cancer, Leo, Virgo         → face P
    [1, 3], [0, 3], [0, 2],   // Libra, Scorpio, Sagittarius → face R
    [0, 1], [0, 0], [1, 0],   // Capricorn, Aquarius, Pisces → face I
  ],
};

// ─── unit-circle-ccw ─────────────────────────────────────────────
// tr=spring/U (Q1), tl=summer/P (Q2), bl=fall/R (Q3), br=winter/I (Q4).
// Aries starts at mid-right (row 1, col 3) — the 0° position of the
// standard unit circle — and the ring sweeps CCW through Q1→Q2→Q3→Q4.
const UNIT_CIRCLE_CCW: Layout = {
  name: 'unit-circle-ccw',
  direction: 'ccw',
  facePosition: {
    U: [1, 2],  // spring   — TR of center (Q1)
    P: [1, 1],  // summer   — TL of center (Q2)
    R: [2, 1],  // fall     — BL of center (Q3)
    I: [2, 2],  // winter   — BR of center (Q4)
  },
  outerRing: [
    [1, 3], [0, 3], [0, 2],   // Aries, Taurus, Gemini      → face U (Q1)
    [0, 1], [0, 0], [1, 0],   // Cancer, Leo, Virgo         → face P (Q2)
    [2, 0], [3, 0], [3, 1],   // Libra, Scorpio, Sagittarius → face R (Q3)
    [3, 2], [3, 3], [2, 3],   // Capricorn, Aquarius, Pisces → face I (Q4)
  ],
};

// Reverse (CW) variants: not populated yet. Two ways to model "reverse" —
// mirror the face-position map, or traverse the ring backward — and each
// has a different visual meaning. Left as an open type-hole to be filled
// when the semantics are pinned down.
export const LAYOUTS: Readonly<Record<LayoutName, Layout>> = {
  'seasonal-ccw':    SEASONAL_CCW,
  'unit-circle-ccw': UNIT_CIRCLE_CCW,
};

export const DEFAULT_LAYOUT: LayoutName = 'seasonal-ccw';

// ─── helpers ─────────────────────────────────────────────────────

/** The 3 outer-ring cells that visually surround a face's vertex,
 *  in CCW zodiacal order — i.e. matching stancesFor(face) by K4 id. */
export function surroundingCellsFor(layout: Layout, vertex: Face): readonly [Coord, Coord, Coord] {
  const stances = stancesFor(vertex);
  const cells: Coord[] = stances.map(s => {
    const idx = stancePositionOnRing(layout, s.id);
    return layout.outerRing[idx];
  });
  return cells as unknown as readonly [Coord, Coord, Coord];
}

/** Ring index (0..11) for a given stance id under a given layout.
 *  Invariant: face U → indices 0,1,2; P → 3,4,5; R → 6,7,8; I → 9,10,11.
 *  (Seasons are always ordered U→P→R→I in the ring because that IS the
 *  zodiacal order — spring → summer → fall → winter.) */
export function stancePositionOnRing(layout: Layout, id: StanceId): number {
  // Ring order: U-face stances first (ids 7,8,9), then P (1,2,3), then R (10,11,12), then I (4,5,6).
  // Face slot: 0 = U, 1 = P, 2 = R, 3 = I.
  const stance = stancesById.get(id)!;
  const faceSlot = FACE_RING_SLOT[stance.face];
  const withinFace = ORDER_WITHIN_FACE[stance.face].indexOf(id);
  return faceSlot * 3 + withinFace;
}

// Lazy cache of registry lookups so callers don't pay for a map walk each time.
import { StanceRegistry } from './registry';
const stancesById = StanceRegistry;

const FACE_RING_SLOT: Record<Face, number> = { U: 0, P: 1, R: 2, I: 3 };

// Within each face, ascending K4 id → ring position within the face.
const ORDER_WITHIN_FACE: Record<Face, readonly StanceId[]> = {
  U: [7, 8, 9],
  P: [1, 2, 3],
  R: [10, 11, 12],
  I: [4, 5, 6],
};
