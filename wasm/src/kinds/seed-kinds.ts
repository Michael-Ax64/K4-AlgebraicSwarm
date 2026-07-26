// wasm/src/kinds/seed-kinds.ts
//
// ============================================================================
// INITIAL KIND SEED — the app's shipping set of exchange shapes
// ============================================================================
//
// Cold-start seeding: when a World is created (either via the demonstration
// seed or later manually), it comes with this set of Kinds attached at
// scope='world'. Projects inherit them via the composed picker.
//
// The initial set covers:
//
//   ENGINE-DISPATCHED (4)
//     validator, bridge, controller, paradox
//     — key must match engine.dispatchable_kinds()
//     — template is empty; engine owns compilation
//     — engineMechanicsDoc points to the K4 prompt spec file
//
//   TEMPLATE-DISPATCHED (5)
//     chat, typology, domain-classification, border-spec, exploration
//     — templates carry the actual prompt
//     — no engine involvement in compilation
//
// The templates below are minimal placeholders. Real content lives in the
// K4 prompt files at wasm/prompts/ for engine Kinds, and each template-
// dispatched Kind's template is authored per-app; these are shipping
// defaults the operator can edit in the Kind's row.
//
// ─── SURGICAL-OP RULES ──────────────────────────────────────────────────────
//
// * When adding a new engine-dispatched Kind here, ALSO extend the Rust
//   engine's dispatchable_kinds() export. TS-side validation in the
//   registry will reject seeding otherwise.
// * When editing a template-dispatched Kind's default template, edit HERE
//   for cold-start; operator edits post-seed live in IndexedDB and are
//   preserved across app updates.
// * The `key` values are stable identifiers used in Ledger rows. Do NOT
//   rename them casually.
//
// ============================================================================

import { Kind } from './kinds-schema';

export interface SeedKind {
  key: string;
  alias: string;
  hint: string;
  family: string;
  dispatch: 'engine' | 'template';
  template?: string;
  engineMechanicsDoc?: string;
  requires: Kind['requires'];
}

export const INITIAL_KINDS: SeedKind[] = [

  // ─── ENGINE-DISPATCHED ─────────────────────────────────────────────────

  {
    key: 'validator',
    alias: 'Validator',
    hint: 'Gate an intent for structural coherence before it enters the manifold.',
    family: 'instrument',
    dispatch: 'engine',
    engineMechanicsDoc:
      'A Markov-blanket gate. Emits [STATE] GATE:... KA:... KB:... ROUTE:...\n' +
      'Sees Documents 0..N as one geometric object; checks debt-nouns, pointers,\n' +
      'cross-document misrouting, contamination. See prompts/K4-AlgebraicIntakeValidator.md.',
    requires: { view: true },
  },
  {
    key: 'bridge',
    alias: 'Bridge (Intent → Coordinate)',
    hint: 'Sweep the intent toward a phase-locked coordinate. Emits a SwarmPayload on lock.',
    family: 'instrument',
    dispatch: 'engine',
    engineMechanicsDoc:
      'A converging interior. Emits [STATE] PHASE:... LOCK:... RHO:... THETA:... PF:... Qf:...\n' +
      'Reads operator text directly (trusted by construction thanks to Validator upstream).\n' +
      'See prompts/K4-AlgebraicIntentBridge.md.',
    requires: { view: true },
  },
  {
    key: 'controller',
    alias: 'Controller (Swarm Cycle)',
    hint: 'Execute a controller cycle from a locked coordinate. Emits face-runner sub-calls and a PTR on cycle close.',
    family: 'instrument',
    dispatch: 'engine',
    engineMechanicsDoc:
      'A driver executing a locked coordinate. Emits [STATE] CYCLE:... SEQ:... plus stance,\n' +
      'plane, path, raise cap. Fires FaceRunnerPrompt sub-calls; commits PhaseTransitionRecord.\n' +
      'See prompts/K4-AlgebraicSwarmController.md.',
    requires: { view: true, lockedCoordinate: true },
  },
  {
    key: 'paradox',
    alias: 'Paradox Engine',
    hint: 'Enumerate adjacencies from an anchor. Holds structure open rather than resolving.',
    family: 'instrument',
    dispatch: 'engine',
    engineMechanicsDoc:
      'A diverging instrument. Emits [STATE] AT:... RUNG:... RECOGNIZED:... MODE:paradox.\n' +
      'Body may carry PossibilityMap (enumeration) or HeldParadoxes (interactive pause).\n' +
      'See prompts/K4-ParadoxEngine.md.',
    requires: { view: true, anchor: true },
  },

  // ─── TEMPLATE-DISPATCHED ───────────────────────────────────────────────

  {
    key: 'chat',
    alias: 'Chat',
    hint: 'Plain conversation. No harness, no header expected.',
    family: 'chat',
    dispatch: 'template',
    template:
      '# System\n' +
      'You are a helpful assistant. Respond to the user turn below.\n\n' +
      '# Attached Documents\n' +
      '{documents}\n\n' +
      '# Vocabulary Context\n' +
      '{vocabulary}\n\n' +
      '# User\n' +
      '{doc0}\n',
    requires: { view: true },
  },
  {
    key: 'typology',
    alias: 'Types & Relations',
    hint: 'Parse the target into recognized types with orders and relations.',
    family: 'analysis',
    dispatch: 'template',
    template:
      '# Task\n' +
      'Given the target material below, produce a typology: enumerate the recognizable\n' +
      'kinds, their orders (partial or total), and the relations between them.\n\n' +
      '# Target\n' +
      '{doc0}\n\n' +
      '# Attached Documents\n' +
      '{documents}\n\n' +
      '# Vocabulary Context\n' +
      '{vocabulary}\n',
    requires: { view: true },
  },
  {
    key: 'domain-classification',
    alias: 'Auto-Classify by Domain',
    hint: 'Sort content into recognized domain buckets.',
    family: 'analysis',
    dispatch: 'template',
    template:
      '# Task\n' +
      'Classify the target material into recognized domains. Name each domain, list\n' +
      'the material that belongs to it, and note the boundaries between them.\n\n' +
      '# Target\n' +
      '{doc0}\n\n' +
      '# Attached Documents\n' +
      '{documents}\n\n' +
      '# Vocabulary Context\n' +
      '{vocabulary}\n',
    requires: { view: true },
  },
  {
    key: 'border-spec',
    alias: 'Boundary Specification',
    hint: 'Produce a refined abstracted border spec — what cannot change.',
    family: 'analysis',
    dispatch: 'template',
    template:
      '# Task\n' +
      'Extract the invariant borders of the target: the constraints that MUST hold,\n' +
      'the things that CANNOT change. Name them precisely. Distinguish hard borders\n' +
      '(structurally load-bearing) from soft borders (preferences).\n\n' +
      '# Target\n' +
      '{doc0}\n\n' +
      '# Attached Documents\n' +
      '{documents}\n\n' +
      '# Vocabulary Context\n' +
      '{vocabulary}\n',
    requires: { view: true },
  },
  {
    key: 'exploration',
    alias: 'Open Exploration',
    hint: 'Loose exploration around the current material. Anything goes.',
    family: 'analysis',
    dispatch: 'template',
    template:
      '# Task\n' +
      'Explore the target material openly. Follow the interesting threads. Note\n' +
      'what surprised you, what raised questions, what connections came to mind.\n' +
      'This is not for producing a deliverable; it is for opening the space.\n\n' +
      '# Target\n' +
      '{doc0}\n\n' +
      '# Attached Documents\n' +
      '{documents}\n\n' +
      '# Vocabulary Context\n' +
      '{vocabulary}\n',
    requires: { view: true },
  },
];
