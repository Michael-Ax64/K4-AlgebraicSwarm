// wasm/src/ledger/seed-data.ts
//
// ============================================================================
// SEED ONTOLOGY — the demonstration a new user cold-starts with
// ============================================================================
//
// The demonstration set. On cold-start (empty DB) `seed.ts` walks this and
// populates Worlds, Projects, Views, Languages, Vocabularies, Documents,
// initial ViewLangSelections, and Circuits.
//
// Two roles here:
//
//   1. THE EXEMPLAR — "Cartography" World. Focused, single-project, two Views.
//      Deliberately structured to TEACH the new tier: it shows the
//      World→Project→View hierarchy, uses Documents at both World and Project
//      scope, uses Languages at both World and View scope, and has one View
//      that starts with doc0 populated (to show doc0 as first-class state).
//
//   2. THE LEGACY SET — Worlds 0-6 carried over from the prior seed.
//      Each old World is wrapped in a single "Main Project" so it fits the
//      new tier without semantic change; Views and Circuits carry over
//      structurally intact. This preserves the existing demonstrations
//      (General Agency, SWE, Quantum, Baryonic, Relationships, Career, GTM)
//      so a user landing fresh sees the full domain variety, not just maps.
//
// ─── SURGICAL-OP RULES ──────────────────────────────────────────────────────
//
// * When adding a demo World, decide first: EXEMPLAR (teaches structure) or
//   DOMAIN (shows a K4 mapping in the wild). Different roles, different
//   authoring standards.
// * DOMAIN Worlds may seed Circuits — the legacy set uses them to demonstrate
//   the 12-stance mapping. This is fine as demonstration data; do NOT let
//   this pattern lock the Circuit shape when the Circuits-as-project-identity
//   conversation happens. The stored shape is the LEGACY shape, retained.
// * EXEMPLAR Worlds should keep Circuit seeding minimal or absent — they
//   teach the new tier, and the Circuit shape is in flux.
// * Every Document should have a REASON its A/P/U/I/R defaults are set the
//   way they are. Comment the reason inline. Blanket-setting `defaultA=true`
//   on every doc teaches nothing.
// * Do NOT seed ViewDocOverrides in cold-start. Overrides are opinions; new
//   users form their own. Leaving the seed clean lets them see inheritance
//   work before they start overriding.
// * When an old-shape View used a single `languageId`, it becomes a single
//   entry in `activeLanguageIds`. Multi-language selection is a new-user
//   discovery, not a seeded expectation.
//
// ============================================================================

import { K4Type, ElementRole } from './schema';

// ─── SEED-SIDE TYPES ────────────────────────────────────────────────────────
// Structural nesting for the seeder. NOT the persisted schema — it's shaped
// for hierarchical authoring, then flattened by seed.ts on write.

interface SeedVocab {
  term: string;
  k4Type: K4Type;
  role: ElementRole;
  description?: string;
}

interface SeedLanguage {
  id: string;
  name: string;
  description?: string;
  vocabularies: SeedVocab[];
}

interface SeedDocument {
  id: string;
  name: string;
  content: string;
  defaultA?: boolean;
  defaultP?: boolean;
  defaultU?: boolean;
  defaultI?: boolean;
  defaultR?: boolean;
  kind?: 'source' | 'derived';
}

interface SeedCircuit {
  id: string;
  name: string;
  activeFace: K4Type;
  heldAbsentVar: K4Type;
  omega: number;
  r: number;
  l: number;
  c: number;
  diagnosticVocab: string[];
  rewardQuestion: string;
}

interface SeedView {
  id: string;
  name: string;
  description?: string;
  doc0?: string;
  innateOmega: number;
  innateR: number;
  innateL: number;
  innateC: number;

  // Optional per-View Languages.
  languages?: SeedLanguage[];
  // Which Languages (by id, from any scope in the inheritance chain) are
  // ticked active on this View at cold-start.
  activeLanguageIds?: string[];
  // Legacy Circuits attached to this View.
  circuits?: SeedCircuit[];
}

interface SeedProject {
  id: string;
  name: string;
  description: string;
  languages?: SeedLanguage[];
  documents?: SeedDocument[];
  views: SeedView[];
}

interface SeedWorld {
  id: string;
  name: string;
  description: string;
  languages?: SeedLanguage[];
  documents?: SeedDocument[];
  projects?: SeedProject[];
}

interface SeedOntology {
  worlds: SeedWorld[];
}

// ─── CIRCUIT BUILDER HELPERS ────────────────────────────────────────────────
// Every 12-Circuit set follows the same K4 face/held pattern. Building the
// standard 12 by hand for each old World would be 12×7=84 rows of near-copy;
// instead we template the geometry once and let each World supply its
// domain-specific vocab and question set.

const CIRCUIT_GEOMETRY: Array<{
  idx: number;
  activeFace: K4Type;
  heldAbsentVar: K4Type;
  omega: number;
  r: number; l: number; c: number;
}> = [
  { idx: 1,  activeFace: 'P', heldAbsentVar: 'R', omega: 10,  r: 5,   l: 10,  c: 0.1 },
  { idx: 2,  activeFace: 'P', heldAbsentVar: 'I', omega: 5,   r: 20,  l: 50,  c: 0.05 },
  { idx: 3,  activeFace: 'P', heldAbsentVar: 'U', omega: 15,  r: 50,  l: 20,  c: 0.2 },
  { idx: 4,  activeFace: 'I', heldAbsentVar: 'R', omega: 2,   r: 10,  l: 80,  c: 0.01 },
  { idx: 5,  activeFace: 'I', heldAbsentVar: 'P', omega: 1,   r: 30,  l: 40,  c: 0.05 },
  { idx: 6,  activeFace: 'I', heldAbsentVar: 'U', omega: 12,  r: 15,  l: 5,   c: 0.3 },
  { idx: 7,  activeFace: 'U', heldAbsentVar: 'R', omega: 3,   r: 20,  l: 60,  c: 0.1 },
  { idx: 8,  activeFace: 'U', heldAbsentVar: 'P', omega: 4,   r: 80,  l: 10,  c: 0.05 },
  { idx: 9,  activeFace: 'U', heldAbsentVar: 'I', omega: 1.5, r: 40,  l: 30,  c: 0.02 },
  { idx: 10, activeFace: 'R', heldAbsentVar: 'P', omega: 0.5, r: 100, l: 150, c: 0.001 },
  { idx: 11, activeFace: 'R', heldAbsentVar: 'I', omega: 0.2, r: 120, l: 200, c: 0.01 },
  { idx: 12, activeFace: 'R', heldAbsentVar: 'U', omega: 20,  r: 180, l: 5,   c: 0.5 },
];

// Names of each stance in K4 geometry — used to label Circuit rows.
const STANCE_LABELS: Record<number, string> = {
  1: 'Synthesis', 2: 'Leverage', 3: 'Momentum',
  4: 'Extraction', 5: 'Ohmic', 6: 'Resonant',
  7: 'Articulation', 8: 'Grounding', 9: 'Capacity',
  10: 'Impedance', 11: 'Accounting', 12: 'Brittleness',
};

/**
 * Build a full 12-Circuit set from a domain vocabulary map keyed by index.
 * Missing indices are skipped (some legacy Worlds only had a subset).
 */
function buildCircuits(
  viewIdPrefix: string,
  domain: Partial<Record<number, { name: string; diagnosticVocab: string[]; rewardQuestion: string }>>
): SeedCircuit[] {
  const out: SeedCircuit[] = [];
  for (const g of CIRCUIT_GEOMETRY) {
    const d = domain[g.idx];
    if (!d) continue;
    out.push({
      id: `${viewIdPrefix}-circ-${g.idx}`,
      name: `${g.idx}. ${d.name} (${STANCE_LABELS[g.idx]})`,
      activeFace: g.activeFace,
      heldAbsentVar: g.heldAbsentVar,
      omega: g.omega, r: g.r, l: g.l, c: g.c,
      diagnosticVocab: d.diagnosticVocab,
      rewardQuestion: d.rewardQuestion,
    });
  }
  return out;
}

// ─── THE SEED ───────────────────────────────────────────────────────────────

export const SEED_ONTOLOGY: SeedOntology = {
  worlds: [

    // ────────────────────────────────────────────────────────────────────────
    // WORLD ─ Cartography (EXEMPLAR)
    // Teaches the new tier structure by example. Not a domain demonstration.
    // "I want a map" — the simpleton example from the specification pass.
    // ────────────────────────────────────────────────────────────────────────
    {
      id: 'world-cartography-001',
      name: 'Cartography',
      description:
        'Making maps: navigating from vague intent to a rendered artifact. ' +
        'Demonstrates the World→Project→View tier and the composable-resource pattern.',

      // World-scope Language: cartography-general terms.
      languages: [
        {
          id: 'lang-carto-general-001',
          name: 'Cartography (general)',
          description: 'Base vocabulary for map-making across projects.',
          vocabularies: [
            { term: 'Purpose / Question', k4Type: 'P', role: 'SPEC',
              description: 'What the map is for.' },
            { term: 'Legend / Schema', k4Type: 'U', role: 'SPEC',
              description: 'How the map encodes what it shows.' },
            { term: 'Trails / Routing', k4Type: 'I', role: 'MATERIAL',
              description: 'Flow across the surface — paths, sequences.' },
            { term: 'Terrain / Constraints', k4Type: 'R', role: 'SPEC',
              description: 'What the ground actually admits.' },
          ],
        },
      ],

      // World-scope Documents: reference material that any Project may use.
      documents: [
        {
          id: 'doc-carto-conventions-001',
          name: 'Map-making conventions.md',
          content:
            '# Map-making conventions\n\n' +
            'A map answers ONE question. If it answers many, it is an atlas.\n' +
            'A map has a legend. If you cannot decode the marks, it is decoration.\n' +
            'A map respects the terrain. If it shows what is not there, it is a plan, not a map.\n',
          defaultA: true,
          // Reason: conventions are broad guidance — every face benefits.
        },
        {
          id: 'doc-carto-terrain-facts-001',
          name: 'Regional terrain facts.md',
          content:
            '# Regional terrain facts\n\n' +
            '- The Elbe valley floor sits ~90m ASL.\n' +
            '- Muldental has active flood risk zones on the northern edge.\n' +
            '- Colditz forest covers the southeast quadrant.\n',
          defaultR: true,
          // Reason: constraint / ground-truth material — the R face's home.
          // U (structure) and P (purpose) do not need this; I (flow) benefits
          // only when routing decisions depend on it. Left off both to keep
          // the demonstration crisp.
        },
      ],

      projects: [
        {
          id: 'proj-carto-imap-001',
          name: 'I want a map',
          description:
            'The exemplar Project: user has a vague intent, wants to arrive at ' +
            'a rendered map. Two Views navigate this same Project at different ' +
            'coordinates — one to refine the question, one to compose the artifact.',

          // Project-scope Document: pictures the user attached.
          documents: [
            {
              id: 'doc-imap-mood-001',
              name: 'What I had in mind (mood pieces).md',
              content:
                '# What I had in mind\n\n' +
                'Something between a Tolkien fold-out and a modern trail sign.\n' +
                'Warm colors, hand-labeled feel, but readable at a glance.\n' +
                'Should fit on one page if printed at A3.\n',
              defaultA: true,
              // Reason: mood-board — every face benefits from knowing target aesthetic.
            },
          ],

          views: [
            {
              id: 'view-imap-exploratory-001',
              name: 'Exploratory',
              description:
                'Initial arena to navigate questions. Fast, low-momentum tuning ' +
                '— refine the intent by moving through the manifold.',
              doc0:
                'I want to make a map. Something between a hand-drawn fantasy ' +
                'illustration and a real trail map. Not sure of the region yet ' +
                '— maybe somewhere I hike.',
              innateOmega: 10,
              innateR: 5,
              innateL: 10,
              innateC: 0.1,
              activeLanguageIds: ['lang-carto-general-001'],
            },
            {
              id: 'view-imap-composition-001',
              name: 'Composition',
              description:
                'The Project rotated toward artifact assembly. Slower pacing, ' +
                'more legacy momentum — you\'ve committed to a direction and ' +
                'are now laying things out.',
              doc0: '',
              innateOmega: 1,
              innateR: 30,
              innateL: 80,
              innateC: 0.05,
              activeLanguageIds: ['lang-carto-general-001', 'lang-imap-composition-001'],
              languages: [
                {
                  id: 'lang-imap-composition-001',
                  name: 'Rendering (View-local)',
                  description:
                    'Composition-specific vocabulary. Only relevant to this View.',
                  vocabularies: [
                    { term: 'Target Artifact', k4Type: 'P', role: 'MATERIAL',
                      description: 'The map file being produced.' },
                    { term: 'Layer Stack', k4Type: 'U', role: 'SPEC',
                      description: 'Ordering of visual layers.' },
                    { term: 'Rendering Pipeline', k4Type: 'I', role: 'MATERIAL',
                      description: 'How pieces flow through to output.' },
                    { term: 'Output Constraints', k4Type: 'R', role: 'SPEC',
                      description: 'Format, size, print vs screen.' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ────────────────────────────────────────────────────────────────────────
    // WORLD ─ General Agency (LEGACY)
    // The baseline everyday-psychology mapping. Full 12-circuit demonstration.
    // ────────────────────────────────────────────────────────────────────────
    {
      id: 'world-general-001',
      name: 'World 0: General Agency (Baseline)',
      description:
        'The universal semantic mapping for everyday human psychology, ' +
        'problem-solving, and task execution.',
      languages: [
        {
          id: 'lang-gen-001',
          name: 'Everyday Execution Lexicon',
          vocabularies: [
            { term: 'Intent / Goal', k4Type: 'P', role: 'SPEC',
              description: 'The immediate desire or drive to act.' },
            { term: 'Plan / Method', k4Type: 'U', role: 'SPEC',
              description: 'The structure, steps, or framework chosen.' },
            { term: 'Process / Attention', k4Type: 'I', role: 'MATERIAL',
              description: 'The active flow of doing.' },
            { term: 'Constraint / Reality', k4Type: 'R', role: 'SPEC',
              description: 'Time, energy, physical limits.' },
          ],
        },
      ],
      projects: [{
        id: 'proj-gen-main-001',
        name: 'Main',
        description: 'The default Project scope for baseline execution work.',
        views: [{
          id: 'view-gen-001',
          name: 'Daily Task Execution',
          description: 'Baseline parameters for standard work.',
          innateOmega: 2.0, innateR: 20, innateL: 30, innateC: 0.1,
          activeLanguageIds: ['lang-gen-001'],
          circuits: buildCircuits('view-gen-001', {
            1:  { name: 'Flow State',              diagnosticVocab: ['Immersion','Execution','Synchrony','Zone','Effortless'],
                  rewardQuestion: 'How do I channel my plan and my energy into immediate results right now without worrying about constraints?' },
            2:  { name: 'Work Smart',              diagnosticVocab: ['Automation','Delegation','Systems','Multiplier','Scale'],
                  rewardQuestion: 'How can I design a system that achieves the goal despite my limited resources, minimizing the daily grind?' },
            3:  { name: 'Brute Force',             diagnosticVocab: ['Willpower','Grind','Pushing through','Sweat','Hustle'],
                  rewardQuestion: 'How do I push through this obstacle using sheer willpower, even if I lack a clear plan?' },
            4:  { name: 'Following the Script',   diagnosticVocab: ['Checklist','Procedure','Compliance','Algorithm'],
                  rewardQuestion: 'What is the exact next step the blueprint dictates to maintain progress?' },
            5:  { name: 'Daily Routine',           diagnosticVocab: ['Maintenance','Habit','Pacing','Sustainability'],
                  rewardQuestion: 'What is the sustainable, everyday routine given the rules I have to follow and my energy limits?' },
            6:  { name: 'Intuitive Improv',        diagnosticVocab: ['Adaptation','Feel','Navigating','Flowing around'],
                  rewardQuestion: 'How do I adapt on the fly to keep moving toward what I want, dodging what\'s immediately in front of me?' },
            7:  { name: 'Sense-Making',            diagnosticVocab: ['Retrospective','Theory','Naming','Pattern recognition'],
                  rewardQuestion: 'What is the actual strategy I seem to be following, based on where I want to go and what I\'m doing?' },
            8:  { name: 'Learning the Hard Way',  diagnosticVocab: ['Boundaries','Lessons','Hard rules','Scar tissue'],
                  rewardQuestion: 'What strict boundary or rule do I need to set based on the hard physical lesson I just learned?' },
            9:  { name: 'Realistic Scoping',       diagnosticVocab: ['Sober blueprint','Budgeting','Scoping','Trade-offs'],
                  rewardQuestion: 'What is a realistic blueprint that balances my ultimate ambition with the hard constraints of my resources?' },
            10: { name: 'Analysis Paralysis',      diagnosticVocab: ['Stuck','Overthinking','Procrastination','Guilt'],
                  rewardQuestion: 'Why is this perfect plan taking so much effort to start, and what is blocking my ability to just act?' },
            11: { name: 'Bureaucratic Bloat',      diagnosticVocab: ['Red tape','Perfectionism','Over-engineering','Waste'],
                  rewardQuestion: 'How much \'reality-tax\' is this overly complicated planning costing me, relative to the simple thing I\'m trying to achieve?' },
            12: { name: 'Burnout',                 diagnosticVocab: ['Exhaustion','Fracture','Toll','Unsustainable'],
                  rewardQuestion: 'How much physical and mental toll is it taking on me to chase this massive dream with such chaotic, unstructured effort?' },
          }),
        }],
      }],
    },

    // ────────────────────────────────────────────────────────────────────────
    // WORLD ─ Software Engineering (LEGACY)
    // Two Views at different scales. Full 12-circuit set on the Sprint View.
    // ────────────────────────────────────────────────────────────────────────
    {
      id: 'world-devops-001',
      name: 'World 1: Software Engineering (DevOps)',
      description: 'A distributed coherence mapping codebase architecture up to organizational runway.',
      languages: [
        {
          id: 'lang-dev-001',
          name: 'L0: Sprint / PR Level',
          vocabularies: [
            { term: 'Feature Ticket / Urgency', k4Type: 'P', role: 'SPEC',
              description: 'The generative drive initiating code.' },
            { term: 'Design Patterns / Architecture', k4Type: 'U', role: 'SPEC',
              description: 'The structural potential and typing.' },
            { term: 'Pull Request / CI-CD', k4Type: 'I', role: 'MATERIAL',
              description: 'The relational flow of code integration.' },
            { term: 'Technical Debt / Legacy Code', k4Type: 'R', role: 'SPEC',
              description: 'The unyielding ground and friction.' },
          ],
        },
        {
          id: 'lang-dev-002',
          name: 'L1: Organization / Runway',
          vocabularies: [
            { term: 'Market Deadline / Burn Rate', k4Type: 'P', role: 'SPEC' },
            { term: 'Org Chart / Agile Framework', k4Type: 'U', role: 'SPEC' },
            { term: 'Cross-Team Communication', k4Type: 'I', role: 'MATERIAL' },
            { term: 'Payroll / Server Costs', k4Type: 'R', role: 'SPEC' },
          ],
        },
      ],
      projects: [{
        id: 'proj-dev-main-001',
        name: 'Main',
        description: 'Default Project for engineering work — sprint and quarterly views.',
        views: [
          {
            id: 'view-dev-001',
            name: 'Sprint Execution Lens',
            description: 'High velocity execution tracking.',
            innateOmega: 10, innateR: 20, innateL: 50, innateC: 0.05,
            activeLanguageIds: ['lang-dev-001'],
            circuits: buildCircuits('view-dev-001', {
              1:  { name: 'The God-Tier Sprint',        diagnosticVocab: ['Ship it','Green builds','Zone','Feature complete'],
                    rewardQuestion: 'How do we deploy this feature using our current architecture and pipelines, completely ignoring technical debt for now?' },
              2:  { name: 'The 10x Automation',         diagnosticVocab: ['DevOps magic','Scripts','Tooling','Infrastructure as Code'],
                    rewardQuestion: 'How can we design a structural pattern that ships this feature despite legacy debt, bypassing the need for manual PR reviews?' },
              3:  { name: 'Crunch Time',                diagnosticVocab: ['Hotfix','Weekend work','Brute force','Duct tape'],
                    rewardQuestion: 'How do we push this hotfix through the CI/CD pipeline and legacy friction using sheer developer hours, without any architectural plan?' },
              4:  { name: 'Ticket Execution',           diagnosticVocab: ['Story execution','Coding to spec','Implementation'],
                    rewardQuestion: 'What is the exact next PR or commit we need to merge to implement this feature ticket according to the architectural spec?' },
              5:  { name: 'Maintenance Mode',           diagnosticVocab: ['Refactoring','Dependency updates','Chore','Linting'],
                    rewardQuestion: 'What is a sustainable CI/CD throughput given our strict architectural rules and the weight of our legacy technical debt?' },
              6:  { name: 'Agile Improv',               diagnosticVocab: ['Hacking','Unblocked','Workaround','Moving fast'],
                    rewardQuestion: 'How do we keep PRs flowing and adapting on the fly to ship this feature, dodging legacy debt without waiting for a formal architecture?' },
              7:  { name: 'Post-Mortem / Retro',        diagnosticVocab: ['Docs','UML','Whiteboarding','Agile Retro'],
                    rewardQuestion: 'What is the actual design pattern we are implicitly building, based on the tickets we are shipping and the PRs we are merging?' },
              8:  { name: 'Incident Response',          diagnosticVocab: ['Post-incident review','Linter rules','CI guards'],
                    rewardQuestion: 'What strict architectural rule or CI guardrail do we need to set based on the legacy debt we just collided with during that PR merge?' },
              9:  { name: 'Sprint Planning',            diagnosticVocab: ['Story points','Scoping','Backlog grooming','Trade-offs'],
                    rewardQuestion: 'What is a realistic software architecture that balances our product roadmap ambitions with the hard constraints of our technical debt?' },
              10: { name: 'Architecture Astronauts',    diagnosticVocab: ['Over-engineering','Bikeshedding','Analysis paralysis'],
                    rewardQuestion: 'Why is this perfect microservices architecture taking so long to actually write, and what legacy debt is blocking our PRs from merging?' },
              11: { name: 'Enterprise Process',         diagnosticVocab: ['Red tape','Approval hell','Overhead','Process tax'],
                    rewardQuestion: 'How much \'process-tax\' and legacy friction is this overly complicated architecture costing us, relative to the simple feature ticket we\'re trying to ship?' },
              12: { name: 'Developer Burnout',          diagnosticVocab: ['Outage','PagerDuty fatigue','Attrition','Fragile tests'],
                    rewardQuestion: 'How much physical toll and server cost is it taking to chase these massive feature tickets with chaotic, unreviewed PRs and zero design patterns?' },
            }),
          },
          {
            id: 'view-dev-002',
            name: 'Quarterly Planning Lens',
            description: 'Macro organization flow.',
            innateOmega: 0.5, innateR: 100, innateL: 200, innateC: 0.01,
            activeLanguageIds: ['lang-dev-002'],
            // No Circuits seeded here — the Quarterly View demonstrates the
            // "View without preset stances" pattern (they'd be authored later).
          },
        ],
      }],
    },

    // ────────────────────────────────────────────────────────────────────────
    // WORLD ─ Standard Model / Quantum (LEGACY)
    // ────────────────────────────────────────────────────────────────────────
    {
      id: 'world-quantum-001',
      name: 'World 2: Standard Model & Quantum Mechanics',
      description: 'The K4 topology applied to subatomic physics.',
      languages: [{
        id: 'lang-quant-001',
        name: 'Particle Substrate',
        vocabularies: [
          { term: 'Mass / The Ledger', k4Type: 'P', role: 'SPEC', description: 'Gravity/Baryons.' },
          { term: 'Photon / Structural Potential', k4Type: 'U', role: 'SPEC', description: 'U(1) gauge field.' },
          { term: 'Weak Bosons / Relational Current', k4Type: 'I', role: 'MATERIAL', description: 'SU(2) gauge field.' },
          { term: 'Gluons / Material Confinement', k4Type: 'R', role: 'SPEC', description: 'SU(3) gauge field.' },
        ],
      }],
      projects: [{
        id: 'proj-quant-main-001',
        name: 'Main',
        description: 'Default Project scope for physics demonstrations.',
        views: [{
          id: 'view-quant-001',
          name: 'Quantum Field Monitor',
          innateOmega: 100, innateR: 5, innateL: 10, innateC: 0.001,
          activeLanguageIds: ['lang-quant-001'],
          circuits: buildCircuits('view-quant-001', {
            1:  { name: 'The .observe() Collapse',   diagnosticVocab: ['Born Rule','Wavefunction Collapse','Decoherence'],
                  rewardQuestion: 'How do the uncollapsed state vectors instantaneously burn their phase to drop a strictly positive real scalar into the Read-Only Ledger?' },
            2:  { name: 'The Higgs Mechanism',       diagnosticVocab: ['Symmetry Breaking','Yukawa Coupling','Mass Generation'],
                  rewardQuestion: 'How does the structural blueprint of the vacuum leverage against material resistance to assign invariant mass without any transit interval?' },
            3:  { name: 'The Landauer Tax',          diagnosticVocab: ['Information Erasure','Thermodynamic Cost','Irreversibility'],
                  rewardQuestion: 'How much thermodynamic mass-energy is exhausted by forcing the complex phase to irreversibly cross the confining material boundary?' },
            5:  { name: 'Flavor Mixing',              diagnosticVocab: ['CKM Matrix','Flavor Eigenstates','CP Violation'],
                  rewardQuestion: 'What is the exact 90-degree relational rotation required to map the committed mass basis into an interactable gauge structure?' },
            6:  { name: 'Weak Measurement',           diagnosticVocab: ['Non-destructive Measurement','Phase Preservation'],
                  rewardQuestion: 'How do we rotate the uncollapsed phase to extract information without triggering the thermodynamic threshold that forces a collapse?' },
            4:  { name: 'Mass Eigenstate',            diagnosticVocab: ['Free Dirac Equation','Stationary State','Superposition'],
                  rewardQuestion: 'How does the particle maintain steady-state propagation through the vacuum structure while confined by its own material boundary?' },
            7:  { name: 'U(1) Gauge Field',           diagnosticVocab: ['Electromagnetism','Photon','Zero Impedance'],
                  rewardQuestion: 'What is the pure structural potential difference established between the accumulated mass and the relational current?' },
            8:  { name: 'Asymptotic Freedom',         diagnosticVocab: ['Confinement','Color Charge','Strong Force Mesh'],
                  rewardQuestion: 'What absolute spatial boundary emerges from the interaction of the quark flows pulling against the unyielding gluon mesh?' },
            9:  { name: 'Holographic Bound',          diagnosticVocab: ['Bekenstein Bound','Markov Blanket','Information Entropy'],
                  rewardQuestion: 'What is the maximum structural capacity of the boundary surface, given the mass and energy confined within its radius?' },
            10: { name: 'Planck Scale Wall',          diagnosticVocab: ['Tangent Divergence','Infinities','Quantum Gravity Failure'],
                  rewardQuestion: 'Why is the coordinate system breaking down into mathematical infinities when we try to force a macroscopic blueprint past the quantum boundary?' },
            11: { name: 'Renormalization',            diagnosticVocab: ['Running Coupling','Cutoff Scale','Mathematical Patch'],
                  rewardQuestion: 'How much artificial mathematical resistance must we subtract from the equations to prevent the structure from blowing up relative to its bare mass?' },
            12: { name: 'Black Hole Collapse',        diagnosticVocab: ['Event Horizon','Singularity','Information Paradox'],
                  rewardQuestion: 'How catastrophic is the geometric curvature when the massive Ledger accumulation completely overwhelms the local thermodynamic bandwidth?' },
          }),
        }],
      }],
    },

    // ────────────────────────────────────────────────────────────────────────
    // WORLD ─ Macroscopic Baryonic Matter (LEGACY)
    // ────────────────────────────────────────────────────────────────────────
    {
      id: 'world-baryonic-001',
      name: 'World 3: Macroscopic Baryonic Matter',
      description: 'Classical thermodynamics and mechanical engineering.',
      languages: [{
        id: 'lang-baryonic-001',
        name: 'Classical Physics',
        vocabularies: [
          { term: 'Work / Kinetic Energy', k4Type: 'P', role: 'SPEC' },
          { term: 'State Equations / Kinematics', k4Type: 'U', role: 'SPEC' },
          { term: 'Heat Transfer / Fluid Flow', k4Type: 'I', role: 'MATERIAL' },
          { term: 'Mass / Friction / Gravity', k4Type: 'R', role: 'SPEC' },
        ],
      }],
      projects: [{
        id: 'proj-baryonic-main-001',
        name: 'Main',
        description: 'Default Project scope for classical-mechanics demonstrations.',
        views: [{
          id: 'view-baryonic-001',
          name: 'Classical Mechanics Sandbox',
          innateOmega: 5.0, innateR: 40, innateL: 60, innateC: 0.1,
          activeLanguageIds: ['lang-baryonic-001'],
          circuits: buildCircuits('view-baryonic-001', {
            1:  { name: 'The Ideal Engine',       diagnosticVocab: ['Carnot Efficiency','Isentropic','Ideal Gas'],
                  rewardQuestion: 'How much macroscopic work can we extract directly from the pressure and heat flow, assuming a frictionless environment?' },
            2:  { name: 'Mechanical Advantage',   diagnosticVocab: ['Simple Machines','Gears','Torque'],
                  rewardQuestion: 'How can we use classical geometry to multiply force against this massive gravitational load, without relying on velocity?' },
            3:  { name: 'Joule Heating',          diagnosticVocab: ['Aerodynamic Drag','Kinetic Heating','Braking'],
                  rewardQuestion: 'How much kinetic energy is violently dissipating into heat as this high-velocity flow collides with the material surface?' },
            5:  { name: 'Pressure Gradient',      diagnosticVocab: ['Convection','Thermodynamic Drive','Current'],
                  rewardQuestion: 'What is the exact volume of flow generated by the engine\'s power output pushing through the pipeline\'s geometry?' },
            6:  { name: 'Wave Propagation',       diagnosticVocab: ['Sound Waves','Harmonic Oscillator','Acoustics'],
                  rewardQuestion: 'How does the kinetic energy bounce perfectly off the material tension to propagate a wave through the medium?' },
            4:  { name: 'Terminal Velocity',      diagnosticVocab: ['Steady State','Viscosity','Equilibrium'],
                  rewardQuestion: 'What is the steady, sustainable velocity of the object falling through the fluid once gravity perfectly balances the aerodynamic drag?' },
            7:  { name: 'Kinematic Description',  diagnosticVocab: ['Trajectories','Equations of Motion','Calculus'],
                  rewardQuestion: 'What is the mathematical equation of state that perfectly describes the relationship between the applied work and the resulting motion?' },
            8:  { name: 'Material Stress',        diagnosticVocab: ['Hooke\'s Law','Strain','Deformation'],
                  rewardQuestion: 'What strict geometric deformation is forced upon the structure by the continuous flow of traffic grinding against its mass?' },
            9:  { name: 'Potential Energy',       diagnosticVocab: ['Gravitational Potential','Elastic Energy','Battery'],
                  rewardQuestion: 'What is the total stored capacity of this structure based on the mechanical work done to lift its mass against gravity?' },
            10: { name: 'Static Friction',        diagnosticVocab: ['Activation Energy','Inertia','Stiction'],
                  rewardQuestion: 'Why is this perfectly modeled chemical reaction refusing to start, and what activation barrier is blocking the flow?' },
            11: { name: 'Entropic Decay',         diagnosticVocab: ['Second Law','Waste Heat','Degradation'],
                  rewardQuestion: 'How much thermodynamic waste and parasitic friction is generated by maintaining this overly complex mechanical architecture?' },
            12: { name: 'Material Fracture',      diagnosticVocab: ['Snapping','Turbulence','Catastrophic Failure'],
                  rewardQuestion: 'How catastrophic is the structural fracture when hurricane-force kinetic winds overwhelm the material integrity of the bridge?' },
          }),
        }],
      }],
    },

    // ────────────────────────────────────────────────────────────────────────
    // WORLD ─ Intimate Relationships (LEGACY)
    // ────────────────────────────────────────────────────────────────────────
    {
      id: 'world-personal-001',
      name: 'World 4: Intimate Relationships',
      description: 'The thermodynamics of human connection.',
      languages: [{
        id: 'lang-rel-001',
        name: 'Attachment Theory',
        vocabularies: [
          { term: 'Passion / Vulnerability', k4Type: 'P', role: 'SPEC' },
          { term: 'Boundaries / Expectations', k4Type: 'U', role: 'SPEC' },
          { term: 'Communication / Affection', k4Type: 'I', role: 'MATERIAL' },
          { term: 'Baggage / Insecurity', k4Type: 'R', role: 'SPEC' },
        ],
      }],
      projects: [{
        id: 'proj-rel-main-001',
        name: 'Main',
        description: 'Default Project scope for relationship-dynamics demonstrations.',
        views: [{
          id: 'view-rel-001',
          name: 'Couples Therapy Lens',
          innateOmega: 1.0, innateR: 40, innateL: 50, innateC: 0.2,
          activeLanguageIds: ['lang-rel-001'],
          circuits: buildCircuits('view-rel-001', {
            1:  { name: 'Secure Attachment',        diagnosticVocab: ['Trust','Deep Connection','Partnership'],
                  rewardQuestion: 'How do we generate deep passion directly from our clear boundaries and open communication, ignoring past baggage?' },
            2:  { name: 'The Strategic Match',      diagnosticVocab: ['On Paper','Compatibility','Guarded'],
                  rewardQuestion: 'How can we build a partnership based on structured expectations that mitigate insecurities, even if daily affection is low?' },
            3:  { name: 'Trauma Bonding',           diagnosticVocab: ['Toxic Passion','Rollercoaster','Chaos'],
                  rewardQuestion: 'How much intense communication are we throwing at our baggage to force passion, ignoring boundaries?' },
            5:  { name: 'Duty Dating',              diagnosticVocab: ['Obligation','Routine','Dry'],
                  rewardQuestion: 'What is the exact communication required to satisfy expectations without taking on emotional risk?' },
            6:  { name: 'The Honeymoon Phase',      diagnosticVocab: ['Infatuation','Chemistry','Blind spot'],
                  rewardQuestion: 'How do we keep affection flowing by focusing purely on desire and ignoring long-term expectations?' },
            4:  { name: 'The Roommate Phase',       diagnosticVocab: ['Coexisting','Comfortable','Stable'],
                  rewardQuestion: 'What is a comfortable flow of interaction given our rules and stressors, even if the passion is asleep?' },
            7:  { name: '"What are we?"',           diagnosticVocab: ['DTR','Labeling','Defining'],
                  rewardQuestion: 'What is the actual label we need to put on this dynamic, based on the vulnerability and communication we share?' },
            8:  { name: 'Setting Hard Boundaries',  diagnosticVocab: ['Dealbreakers','Self-respect','Walls'],
                  rewardQuestion: 'What strict boundary must I set right now based on the painful behavior I just experienced?' },
            9:  { name: 'Guarded Dating',           diagnosticVocab: ['Protecting peace','Moving slow','Vetting'],
                  rewardQuestion: 'What is a realistic set of expectations that balances my desire with the need to protect against past baggage?' },
            10: { name: 'Avoidant Attachment',      diagnosticVocab: ['Pulling away','Ghosting','Suffocated'],
                  rewardQuestion: 'Why are these heavy expectations creating internal friction that blocks my ability to show affection?' },
            11: { name: 'The Over-Analyzer',        diagnosticVocab: ['Self-sabotage','Projecting','Insecure'],
                  rewardQuestion: 'How much emotional exhaustion is this list of \'perfect partner\' expectations costing us?' },
            12: { name: 'Anxious Attachment',       diagnosticVocab: ['Clingy','Desperate','Panic'],
                  rewardQuestion: 'How much damage am I taking pouring vulnerability into a connection with zero communication and no boundaries?' },
          }),
        }],
      }],
    },

    // ────────────────────────────────────────────────────────────────────────
    // WORLD ─ Career / Professional (LEGACY, partial stance set)
    // ────────────────────────────────────────────────────────────────────────
    {
      id: 'world-professional-001',
      name: 'World 5: Career & Professional Dynamics',
      description: 'Corporate climbing, team dynamics, and office politics.',
      languages: [{
        id: 'lang-prof-001',
        name: 'Corporate Ladder',
        vocabularies: [
          { term: 'Ambition / Deliverables', k4Type: 'P', role: 'SPEC' },
          { term: 'Role / Authority', k4Type: 'U', role: 'SPEC' },
          { term: 'Networking / Soft Skills', k4Type: 'I', role: 'MATERIAL' },
          { term: 'Office Politics / Burnout', k4Type: 'R', role: 'SPEC' },
        ],
      }],
      projects: [{
        id: 'proj-prof-main-001',
        name: 'Main',
        description: 'Default Project scope for career-dynamics demonstrations.',
        views: [{
          id: 'view-prof-001',
          name: 'Career Navigation',
          innateOmega: 2.0, innateR: 50, innateL: 40, innateC: 0.1,
          activeLanguageIds: ['lang-prof-001'],
          // Partial stance set — this legacy World only had 6 Circuits authored.
          circuits: buildCircuits('view-prof-001', {
            1:  { name: 'The Star Performer',     diagnosticVocab: ['High Impact','Promotion track','Alignment'],
                  rewardQuestion: 'How do I maximize deliverables leveraging my authority and influence, ignoring office politics?' },
            3:  { name: 'The Firefighter',        diagnosticVocab: ['Silo-busting','Saving the day','Grind'],
                  rewardQuestion: 'How do I force this project to completion relying on relationships to smash red tape, regardless of my job title?' },
            4:  { name: 'Quiet Quitting',         diagnosticVocab: ['Act your wage','Phoning it in','Disengaged'],
                  rewardQuestion: 'What is the absolute minimum effort required to fulfill my job description without extra stress?' },
            10: { name: 'The Siloed Genius',      diagnosticVocab: ['Passed over','Brilliant jerk','Blocked'],
                  rewardQuestion: 'Why is my expertise and authority resulting in zero influence, and what blocks my ability to collaborate?' },
            11: { name: 'The Micromanager',       diagnosticVocab: ['Bottleneck','Control freak','Process-heavy'],
                  rewardQuestion: 'How much team morale is destroyed enforcing massive hierarchical authority for so few deliverables?' },
            12: { name: 'The Martyr',             diagnosticVocab: ['Scapegoat','Overworked','Quitting'],
                  rewardQuestion: 'How much burnout am I taking trying to single-handedly deliver massive results with no official authority to protect me?' },
          }),
        }],
      }],
    },

    // ────────────────────────────────────────────────────────────────────────
    // WORLD ─ GTM / Business Models (LEGACY, partial stance set)
    // ────────────────────────────────────────────────────────────────────────
    {
      id: 'world-business-001',
      name: 'World 6: Go-To-Market & Business Models',
      description: 'Product-market fit, unit economics, and scaling.',
      languages: [{
        id: 'lang-biz-001',
        name: 'Startup Economics',
        vocabularies: [
          { term: 'Revenue / Conversion', k4Type: 'P', role: 'SPEC' },
          { term: 'Value Prop / Pricing', k4Type: 'U', role: 'SPEC' },
          { term: 'Funnel / User Engagement', k4Type: 'I', role: 'MATERIAL' },
          { term: 'CAC / Churn / Competition', k4Type: 'R', role: 'SPEC' },
        ],
      }],
      projects: [{
        id: 'proj-biz-main-001',
        name: 'Main',
        description: 'Default Project scope for GTM-dynamics demonstrations.',
        views: [{
          id: 'view-biz-001',
          name: 'GTM Funnel Tracker',
          innateOmega: 4.0, innateR: 60, innateL: 30, innateC: 0.05,
          activeLanguageIds: ['lang-biz-001'],
          circuits: buildCircuits('view-biz-001', {
            1:  { name: 'Product-Market Fit',       diagnosticVocab: ['Unicorn','Hockey stick','Organic growth'],
                  rewardQuestion: 'How do we maximize revenue multiplying our pricing model against organic user engagement, ignoring CAC for now?' },
            3:  { name: 'Growth Hacking',           diagnosticVocab: ['Performance marketing','Brute force','Arbitrage'],
                  rewardQuestion: 'How much revenue can we force by pouring massive traffic into a high-CAC market, even if our product value prop is weak?' },
            5:  { name: 'Product-Led Growth',       diagnosticVocab: ['Freemium','Self-serve','Viral coefficient'],
                  rewardQuestion: 'What is the steady flow of acquisition we can maintain purely based on the strength of our free tier divided by onboarding friction?' },
            10: { name: 'Vaporware',                diagnosticVocab: ['Pivot needed','Ghost town','Zero traction'],
                  rewardQuestion: 'Why is this perfect pitch deck resulting in zero user acquisition, and what market resistance is blocking the funnel?' },
            11: { name: 'Enterprise Sales Hell',    diagnosticVocab: ['Procurement','Long sales cycle','Legal review'],
                  rewardQuestion: 'How much cash burn is this over-engineered enterprise compliance costing us, relative to the tiny amount of revenue closing?' },
            12: { name: 'The Leaky Bucket',         diagnosticVocab: ['Massive churn','Burning cash','Death spiral'],
                  rewardQuestion: 'How quickly is our startup fracturing closing massive revenue deals with a terrible user experience and no actual product value to retain them?' },
          }),
        }],
      }],
    },
  ],
};
