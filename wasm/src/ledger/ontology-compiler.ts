// wasm/ts/src/ledger/ontology-compiler.ts

import { World, Vocabulary, CircuitState, K4Type } from './schema';
import { vfsDb } from './fs';
import { callBuiltInAPI } from '../llm-client';

export const STANCES_GEOMETRY = [
  { id: 1, eq: "P = U * I", face: "P", held: "R", R: 5, L: 10, C: 0.1, w: 10 },
  { id: 2, eq: "P = U^2 / R", face: "P", held: "I", R: 20, L: 50, C: 0.05, w: 5 },
  { id: 3, eq: "P = I^2 * R", face: "P", held: "U", R: 50, L: 20, C: 0.2, w: 15 },
  { id: 4, eq: "I = P / U", face: "I", held: "R", R: 10, L: 80, C: 0.01, w: 2 },
  { id: 5, eq: "I = U / R", face: "I", held: "P", R: 30, L: 40, C: 0.05, w: 1 },
  { id: 6, eq: "I = sqrt(P/R)", face: "I", held: "U", R: 15, L: 5, C: 0.3, w: 12 },
  { id: 7, eq: "U = P / I", face: "U", held: "R", R: 20, L: 60, C: 0.1, w: 3 },
  { id: 8, eq: "U = I * R", face: "U", held: "P", R: 80, L: 10, C: 0.05, w: 4 },
  { id: 9, eq: "U = sqrt(P*R)", face: "U", held: "I", R: 40, L: 30, C: 0.02, w: 1.5 },
  { id: 10, eq: "R = U / I", face: "R", held: "P", R: 100, L: 150, C: 0.001, w: 0.5 },
  { id: 11, eq: "R = U^2 / P", face: "R", held: "I", R: 120, L: 200, C: 0.01, w: 0.2 },
  { id: 12, eq: "R = P / I^2", face: "R", held: "U", R: 180, L: 5, C: 0.5, w: 20 },
];

// ============================================================================
// 1. THE 12-FOLD ONTOLOGY COMPILER
// ============================================================================

export function buildOntologyPrompt(vocab: Vocabulary[]): string {
  const p = vocab.find(v => v.k4Type === 'P')?.term || "Drive/Power";
  const u = vocab.find(v => v.k4Type === 'U')?.term || "Structure/Plan";
  const i = vocab.find(v => v.k4Type === 'I')?.term || "Flow/Current";
  const r = vocab.find(v => v.k4Type === 'R')?.term || "Friction/Ground";

  return `You are the K4 Ontology Compiler. Unfold this domain's possibility space into the 12 algebraic stances.
Domain Nouns mapped to Poles:
- P (Fire / Actualization): "${p}"
- U (Air / Blueprint): "${u}"
- I (Water / Relational Flow): "${i}"
- R (Earth / Material Constraint): "${r}"

For each of the 12 equations, return a JSON object with:
1. "id": Integer 1 through 12.
2. "name": A concise name for this situation/dysfunction in the domain.
3. "diagnosticVocab": Array of 5 jargon terms people use in this domain when in this state.
4. "rewardQuestion": A diagnostic question probing the tension of the equation using the specific domain nouns.

Example for Equation 10 (R = U / I, Impedance/Analysis Paralysis):
"Why is this perfect [U] taking so much effort [R] to start, and what is blocking my ability to establish [I]?"

Return STRICTLY a JSON object matching this schema:
{ "stances": [ { "id": 1, "name": "...", "diagnosticVocab": ["..."], "rewardQuestion": "..." } ] }`;
}

export async function parseAndSaveOntology(levelId: string, jsonResponse: string): Promise<void> {
  let parsed;
  try {
    parsed = JSON.parse(jsonResponse);
  } catch (e) {
    const clean = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(clean);
  }

  for (const geom of STANCES_GEOMETRY) {
    const semanticData = parsed.stances.find((s: any) => s.id === geom.id);
    if (!semanticData) continue;

    const circuit: CircuitState = {
      id: crypto.randomUUID(),
      levelId,
      name: `${geom.id}. ${semanticData.name}`,
      activeFace: geom.face as K4Type,
      heldAbsentVar: geom.held as K4Type,
      resistanceR: geom.R,
      inductanceL: geom.L,
      capacitanceC: geom.C,
      drivingOmega: geom.w,
      currentCycle: 1,
      diagnosticVocab: semanticData.diagnosticVocab,
      rewardQuestion: semanticData.rewardQuestion
    };

    await vfsDb.upsertCircuitState(circuit);
  }
}

export async function compileOntology(levelId: string, world: World, vocab: Vocabulary[]): Promise<void> {
  const prompt = buildOntologyPrompt(vocab);
  const jsonResponse = await callBuiltInAPI(world, prompt, true);
  await parseAndSaveOntology(levelId, jsonResponse);
}

// ============================================================================
// CARDINALITY TEST-CYCLE (AUTO-MAPPER)
// ============================================================================

export interface AutoMapResult {
  anchor: { term: string; pole: K4Type; reason: string };
  contestedSwap: { termA: string; termB: string };
  sweepAudit: {
    sweep1_Linear: string;
    sweep2_Leverage: string;
    sweep3_Friction: string;
  };
  resolution: string;
  finalMapping: Record<K4Type, string>;
}

export async function autoMapDomain(world: World, rawTerms: string[]): Promise<AutoMapResult> {
  if (world.apiProvider === 'manual') {
    throw new Error("Auto-Map via Algebra requires an automated API connection. Switch to OpenAI, Custom (Local), or Auto in Settings.");
  }

  const prompt = `
You are the K4 Topological Sorter. 
The user has provided 4 raw domain terms: [${rawTerms.join(', ')}].
You must map these to the 4 K4 poles (P, U, I, R) by running the Cardinality Test-Cycle.

EXECUTE THIS EXACT ALGORITHM:
1. ANCHOR: Select the term most unambiguously Active/Asserting (P) or Reactive/Asserting (R). Fix it.
2. AXES: Score the remaining three. 
3. CONTESTED SWAP: By the structural theorem, fixing the anchor leaves exactly two contested decisions (a plausible swap). Identify the two terms whose pole assignments (U vs I) are ambiguous.
4. THE 3 ALGEBRAIC SWEEPS: You must test the contested swap by substituting the nouns into the equations grouped by 'x + [0, 3, 6, 9]' for x from 1 to 3.
   - Sweep 1 (Linear/Relational - Eqs 1,4,7,10): e.g., P = U * I, R = U / I. Does the math hold directly without compounding?
   - Sweep 2 (Leverage/Structure - Eqs 2,5,8,11): e.g., P = U^2 / R, R = U^2 / P. If I square [U] without [I], does it create leverage (P) or suffocation (R)?
   - Sweep 3 (Momentum/Friction - Eqs 3,6,9,12): e.g., P = I^2 * R, R = P / I^2. If I square [I] against [R], does it grind out actualization (P) through sheer heat?
5. RESOLUTION: Which configuration survived the 3 sweeps without breaking the semantic reality of the domain?

Return STRICTLY a JSON object matching this schema:
{
  "anchor": { "term": "...", "pole": "P|U|I|R", "reason": "..." },
  "contestedSwap": { "termA": "...", "termB": "..." },
  "sweepAudit": {
    "sweep1_Linear": "...",
    "sweep2_Leverage": "...",
    "sweep3_Friction": "..."
  },
  "resolution": "...",
  "finalMapping": { "P": "...", "U": "...", "I": "...", "R": "..." }
}
`;

  const jsonResponse = await callBuiltInAPI(world, prompt, true);
  
  let parsed: AutoMapResult;
  try {
    parsed = JSON.parse(jsonResponse);
  } catch (e) {
    const clean = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(clean);
  }
  
  return parsed;
}
