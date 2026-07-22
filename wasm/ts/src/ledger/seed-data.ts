// wasm/ui/src/ledger/seed-data.ts
import { K4Type, ElementRole } from './schema';

export const defaultSeedData = {
  worlds: [
    {
      id: "world-general-001",
      name: "World 0: General Agency (Baseline)",
      description: "The universal semantic mapping for everyday human psychology, problem-solving, and task execution.",
      apiProvider: 'manual',
      levels: [
        {
          id: "lvl-gen-001",
          name: "L0: Everyday Execution",
          levelIndex: 0,
          vocabularies: [
            { term: "Intent / Goal", k4Type: "P", role: "SPEC", description: "The immediate desire or drive to act." },
            { term: "Plan / Method", k4Type: "U", role: "SPEC", description: "The structure, steps, or framework chosen to reach the goal." },
            { term: "Process / Attention", k4Type: "I", role: "MATERIAL", description: "The active flow of doing and relating to the task." },
            { term: "Constraint / Reality", k4Type: "R", role: "SPEC", description: "Time, energy, physical limits, and friction." }
          ],
          circuits: [
            // --- FIRE: P (Drive / Actualization) ---
            {
              id: "circ-gen-1", name: "1. Flow State (Synthesis)",
              activeFace: "P", heldAbsentVar: "R",
              resistanceR: 5, inductanceL: 10, capacitanceC: 0.1, drivingOmega: 10, currentCycle: 1,
              diagnosticVocab: ["Immersion", "Execution", "Synchrony", "Zone", "Effortless"],
              rewardQuestion: "How do I channel my plan and my energy into immediate results right now without worrying about constraints?"
            },
            {
              id: "circ-gen-2", name: "2. Work Smart (Leverage)",
              activeFace: "P", heldAbsentVar: "I",
              resistanceR: 20, inductanceL: 50, capacitanceC: 0.05, drivingOmega: 5, currentCycle: 1,
              diagnosticVocab: ["Automation", "Delegation", "Systems", "Multiplier", "Scale"],
              rewardQuestion: "How can I design a system that achieves the goal despite my limited resources, minimizing the daily grind?"
            },
            {
              id: "circ-gen-3", name: "3. Brute Force (Momentum)",
              activeFace: "P", heldAbsentVar: "U",
              resistanceR: 50, inductanceL: 20, capacitanceC: 0.2, drivingOmega: 15, currentCycle: 1,
              diagnosticVocab: ["Willpower", "Grind", "Pushing through", "Sweat", "Hustle"],
              rewardQuestion: "How do I push through this obstacle using sheer willpower, even if I lack a clear plan?"
            },
            // --- WATER: I (Flow / Current) ---
            {
              id: "circ-gen-4", name: "4. Following the Script (Extraction)",
              activeFace: "I", heldAbsentVar: "R",
              resistanceR: 10, inductanceL: 80, capacitanceC: 0.01, drivingOmega: 2, currentCycle: 1,
              diagnosticVocab: ["Checklist", "Procedure", "Compliance", "Algorithm", "Step-by-step"],
              rewardQuestion: "What is the exact next step the blueprint dictates to maintain progress?"
            },
            {
              id: "circ-gen-5", name: "5. Daily Routine (Ohmic)",
              activeFace: "I", heldAbsentVar: "P",
              resistanceR: 30, inductanceL: 40, capacitanceC: 0.05, drivingOmega: 1, currentCycle: 1,
              diagnosticVocab: ["Maintenance", "Habit", "Pacing", "Sustainability", "Chores"],
              rewardQuestion: "What is the sustainable, everyday routine given the rules I have to follow and my energy limits?"
            },
            {
              id: "circ-gen-6", name: "6. Intuitive Improv (Resonant)",
              activeFace: "I", heldAbsentVar: "U",
              resistanceR: 15, inductanceL: 5, capacitanceC: 0.3, drivingOmega: 12, currentCycle: 1,
              diagnosticVocab: ["Adaptation", "Feel", "Navigating", "Flowing around", "Agility"],
              rewardQuestion: "How do I adapt on the fly to keep moving toward what I want, dodging what's immediately in front of me?"
            },
            // --- AIR: U (Structure / Voltage) ---
            {
              id: "circ-gen-7", name: "7. Sense-Making (Articulation)",
              activeFace: "U", heldAbsentVar: "R",
              resistanceR: 20, inductanceL: 60, capacitanceC: 0.1, drivingOmega: 3, currentCycle: 1,
              diagnosticVocab: ["Retrospective", "Theory", "Naming", "Pattern recognition", "Sense-making"],
              rewardQuestion: "What is the actual strategy I seem to be following, based on where I want to go and what I'm doing?"
            },
            {
              id: "circ-gen-8", name: "8. Learning the Hard Way (Grounding)",
              activeFace: "U", heldAbsentVar: "P",
              resistanceR: 80, inductanceL: 10, capacitanceC: 0.05, drivingOmega: 4, currentCycle: 1,
              diagnosticVocab: ["Boundaries", "Lessons", "Hard rules", "Scar tissue", "Correction"],
              rewardQuestion: "What strict boundary or rule do I need to set based on the hard physical lesson I just learned?"
            },
            {
              id: "circ-gen-9", name: "9. Realistic Scoping (Capacity)",
              activeFace: "U", heldAbsentVar: "I",
              resistanceR: 40, inductanceL: 30, capacitanceC: 0.02, drivingOmega: 1.5, currentCycle: 1,
              diagnosticVocab: ["Sober blueprint", "Budgeting", "Scoping", "Trade-offs", "Architecture"],
              rewardQuestion: "What is a realistic blueprint that balances my ultimate ambition with the hard constraints of my resources?"
            },
            // --- EARTH: R (Grounding / Friction) ---
            {
              id: "circ-gen-10", name: "10. Analysis Paralysis (Impedance)",
              activeFace: "R", heldAbsentVar: "P",
              resistanceR: 100, inductanceL: 150, capacitanceC: 0.001, drivingOmega: 0.5, currentCycle: 1,
              diagnosticVocab: ["Stuck", "Overthinking", "Procrastination", "Guilt", "Hesitation"],
              rewardQuestion: "Why is this perfect plan taking so much effort to start, and what is blocking my ability to just act?"
            },
            {
              id: "circ-gen-11", name: "11. Bureaucratic Bloat (Accounting)",
              activeFace: "R", heldAbsentVar: "I",
              resistanceR: 120, inductanceL: 200, capacitanceC: 0.01, drivingOmega: 0.2, currentCycle: 1,
              diagnosticVocab: ["Red tape", "Perfectionism", "Over-engineering", "Waste", "Meetings"],
              rewardQuestion: "How much 'reality-tax' is this overly complicated planning costing me, relative to the simple thing I'm trying to achieve?"
            },
            {
              id: "circ-gen-12", name: "12. Burnout (Brittleness)",
              activeFace: "R", heldAbsentVar: "U",
              resistanceR: 180, inductanceL: 5, capacitanceC: 0.5, drivingOmega: 20, currentCycle: 1,
              diagnosticVocab: ["Exhaustion", "Fracture", "Toll", "Unsustainable", "Breaking point"],
              rewardQuestion: "How much physical and mental toll is it taking on me to chase this massive dream with such chaotic, unstructured effort?"
            }
          ]
        }
      ]
    },
    {
      id: "world-devops-001",
      name: "World 1: Software Engineering (DevOps)",
      description: "A distributed coherence mapping codebase architecture up to organizational runway.",
      apiProvider: 'manual',
      levels: [
        {
          id: "lvl-dev-001",
          name: "L0: Individual Contributor / Sprint Execution",
          levelIndex: 0,
          vocabularies: [
            { term: "Feature Ticket / Urgency", k4Type: "P", role: "SPEC", description: "The generative drive initiating code." },
            { term: "Design Patterns / Architecture", k4Type: "U", role: "SPEC", description: "The structural potential and typing." },
            { term: "Pull Request / CI-CD", k4Type: "I", role: "MATERIAL", description: "The relational flow of code integration." },
            { term: "Technical Debt / Legacy Code", k4Type: "R", role: "SPEC", description: "The unyielding ground and friction." }
          ],
          circuits: [
            // --- FIRE: Shipping Code (P) ---
            {
              id: "circ-dev-1", name: "1. The God-Tier Sprint (Synthesis)",
              activeFace: "P", heldAbsentVar: "R",
              resistanceR: 5, inductanceL: 10, capacitanceC: 0.1, drivingOmega: 10, currentCycle: 1,
              diagnosticVocab: ["Ship it", "Green builds", "Zone", "Feature complete", "Rapid iteration"],
              rewardQuestion: "How do we deploy this feature using our current architecture and CI/CD pipelines, completely ignoring technical debt for now?"
            },
            {
              id: "circ-dev-2", name: "2. The 10x Automation (Leverage)",
              activeFace: "P", heldAbsentVar: "I",
              resistanceR: 20, inductanceL: 50, capacitanceC: 0.05, drivingOmega: 5, currentCycle: 1,
              diagnosticVocab: ["DevOps magic", "Scripts", "Refactor", "Tooling", "Infrastructure as Code"],
              rewardQuestion: "How can we design a structural pattern that ships this feature despite legacy debt, bypassing the need for manual PR reviews?"
            },
            {
              id: "circ-dev-3", name: "3. Crunch Time (Momentum)",
              activeFace: "P", heldAbsentVar: "U",
              resistanceR: 50, inductanceL: 20, capacitanceC: 0.2, drivingOmega: 15, currentCycle: 1,
              diagnosticVocab: ["Hotfix", "Spaghetti code", "Weekend work", "Brute force", "Duct tape"],
              rewardQuestion: "How do we push this hotfix through the CI/CD pipeline and legacy friction using sheer developer hours, without any architectural plan?"
            },

            // --- WATER: CI/CD & PR Flow (I) ---
            {
              id: "circ-dev-4", name: "4. Ticket Execution (Extraction)",
              activeFace: "I", heldAbsentVar: "R",
              resistanceR: 10, inductanceL: 80, capacitanceC: 0.01, drivingOmega: 2, currentCycle: 1,
              diagnosticVocab: ["Story execution", "Coding to spec", "Implementation", "PR factory", "Heads down"],
              rewardQuestion: "What is the exact next PR or commit we need to merge to implement this feature ticket according to the architectural spec?"
            },
            {
              id: "circ-dev-5", name: "5. Maintenance Mode (Ohmic)",
              activeFace: "I", heldAbsentVar: "P",
              resistanceR: 30, inductanceL: 40, capacitanceC: 0.05, drivingOmega: 1, currentCycle: 1,
              diagnosticVocab: ["Refactoring", "Dependency updates", "Chore", "Linting", "Steady state"],
              rewardQuestion: "What is a sustainable CI/CD throughput given our strict architectural rules and the weight of our legacy technical debt?"
            },
            {
              id: "circ-dev-6", name: "6. Agile Improv (Resonant)",
              activeFace: "I", heldAbsentVar: "U",
              resistanceR: 15, inductanceL: 5, capacitanceC: 0.3, drivingOmega: 12, currentCycle: 1,
              diagnosticVocab: ["Hacking", "Unblocked", "Workaround", "Agile", "Moving fast"],
              rewardQuestion: "How do we keep PRs flowing and adapting on the fly to ship this feature, dodging legacy debt without waiting for a formal architecture?"
            },

            // --- AIR: Architecture & Planning (U) ---
            {
              id: "circ-dev-7", name: "7. Post-Mortem / Retro (Articulation)",
              activeFace: "U", heldAbsentVar: "R",
              resistanceR: 20, inductanceL: 60, capacitanceC: 0.1, drivingOmega: 3, currentCycle: 1,
              diagnosticVocab: ["Docs", "UML", "Whiteboarding", "Agile Retro", "Design Doc"],
              rewardQuestion: "What is the actual design pattern we are implicitly building, based on the tickets we are shipping and the PRs we are merging?"
            },
            {
              id: "circ-dev-8", name: "8. Incident Response (Grounding)",
              activeFace: "U", heldAbsentVar: "P",
              resistanceR: 80, inductanceL: 10, capacitanceC: 0.05, drivingOmega: 4, currentCycle: 1,
              diagnosticVocab: ["Post-incident review", "Linter rules", "CI guards", "Test coverage", "Boundary"],
              rewardQuestion: "What strict architectural rule or CI guardrail do we need to set based on the legacy debt we just collided with during that PR merge?"
            },
            {
              id: "circ-dev-9", name: "9. Sprint Planning (Capacity)",
              activeFace: "U", heldAbsentVar: "I",
              resistanceR: 40, inductanceL: 30, capacitanceC: 0.02, drivingOmega: 1.5, currentCycle: 1,
              diagnosticVocab: ["Story points", "Scoping", "Backlog grooming", "Trade-offs", "Feasibility"],
              rewardQuestion: "What is a realistic software architecture that balances our product roadmap ambitions with the hard constraints of our technical debt?"
            },
            
            // --- EARTH: Engineering Dysfunctions (R) ---
            {
              id: "circ-dev-10", name: "10. Architecture Astronauts (Impedance)",
              activeFace: "R", heldAbsentVar: "P",
              resistanceR: 100, inductanceL: 150, capacitanceC: 0.001, drivingOmega: 0.5, currentCycle: 1,
              diagnosticVocab: ["Over-engineering", "Bikeshedding", "Analysis paralysis", "Stale branches", "Blocked"],
              rewardQuestion: "Why is this perfect microservices architecture taking so long to actually write, and what legacy debt is blocking our PRs from merging?"
            },
            {
              id: "circ-dev-11", name: "11. Enterprise Process (Accounting)",
              activeFace: "R", heldAbsentVar: "I",
              resistanceR: 120, inductanceL: 200, capacitanceC: 0.01, drivingOmega: 0.2, currentCycle: 1,
              diagnosticVocab: ["Red tape", "Approval hell", "Overhead", "Process tax", "Meeting heavy"],
              rewardQuestion: "How much 'process-tax' and legacy friction is this overly complicated architecture costing us, relative to the simple feature ticket we're trying to ship?"
            },
            {
              id: "circ-dev-12", name: "12. Developer Burnout (Brittleness)",
              activeFace: "R", heldAbsentVar: "U",
              resistanceR: 180, inductanceL: 5, capacitanceC: 0.5, drivingOmega: 20, currentCycle: 1,
              diagnosticVocab: ["Outage", "PagerDuty fatigue", "Attrition", "Fragile tests", "System failure"],
              rewardQuestion: "How much physical toll and server cost is it taking to chase these massive feature tickets with chaotic, unreviewed PRs and zero design patterns?"
            }
          ]
        }
      ]
    },
    {
      id: "world-devops-002",
      name: "Software Engineering (DevOps)",
      description: "A distributed coherence mapping codebase architecture up to organizational runway.",
      levels: [
        {
          id: "lvl-dev-001",
          name: "L0: Individual Contributor / PR",
          levelIndex: 0,
          vocabularies: [
            { term: "Feature Ticket / Urgency", k4Type: "P", role: "SPEC", description: "The generative drive initiating code." },
            { term: "Pull Request / Pair Programming", k4Type: "I", role: "MATERIAL", description: "The relational flow of code review." },
            { term: "Design Patterns / Interfaces", k4Type: "U", role: "SPEC", description: "The structural potential and typing." },
            { term: "Technical Debt / Compiler Errors", k4Type: "R", role: "SPEC", description: "The unyielding ground and friction." }
          ],
          circuits: [
            {
              id: "circ-dev-001",
              name: "Sprint Execution Loop",
              activeFace: "U",
              heldAbsentVar: "P",
              resistanceR: 20,    // Moderate friction
              inductanceL: 50,    // High legacy code momentum
              capacitanceC: 0.05, // High anticipation/stress for release
              drivingOmega: 10,   // Fast daily pacing
              currentCycle: 1
            }
          ]
        },
        {
          id: "lvl-dev-002",
          name: "L1: Organization / Runway",
          levelIndex: 1,
          vocabularies: [
            { term: "Market Deadline / Burn Rate", k4Type: "P", role: "SPEC", description: "The macro-urgency and ledger commitment." },
            { term: "Cross-Team Communication", k4Type: "I", role: "MATERIAL", description: "The relational flow between departments." },
            { term: "Org Chart / Agile Framework", k4Type: "U", role: "SPEC", description: "The structural governance." },
            { term: "Payroll / Server Costs", k4Type: "R", role: "SPEC", description: "The thermodynamic cost of maintaining the macro-blanket." }
          ],
          circuits: [
            {
              id: "circ-dev-002",
              name: "Quarterly Planning",
              activeFace: "P",
              heldAbsentVar: "I",
              resistanceR: 100,   // Massive bureaucratic friction
              inductanceL: 200,   // Immense institutional inertia
              capacitanceC: 0.01, // Huge tension regarding runway
              drivingOmega: 0.5,  // Slow macro-pacing
              currentCycle: 1
            }
          ]
        }
      ]
    },
    {
      id: "world-quantum-001",
      name: "Standard Model & Quantum Mechanics",
      description: "The K4 topology applied to subatomic physics, mapping the 12 fermions, 12 gauge bosons, and the thermodynamic cost of wave-function collapse.",
      apiProvider: 'manual',
      levels: [
        {
          id: "lvl-quant-001",
          name: "L0: The Particle Substrate",
          levelIndex: 0,
          vocabularies: [
            { term: "Mass / The Ledger", k4Type: "P", role: "SPEC", description: "The Read-Only Ledger of committed actualization (Gravity/Baryons)." },
            { term: "Photon / Structural Potential", k4Type: "U", role: "SPEC", description: "The U(1) gauge field; structural difference without mass." },
            { term: "Weak Bosons / Relational Current", k4Type: "I", role: "MATERIAL", description: "The SU(2) gauge field; flavor mixing and unitary flow." },
            { term: "Gluons / Material Confinement", k4Type: "R", role: "SPEC", description: "The SU(3) gauge field; Absolute resistance and the boundary." }
          ],
          circuits: [
            // --- FIRE: The Ledger & Collapse (P) ---
            {
              id: "circ-quant-1", name: "1. The .observe() Collapse (Synthesis)",
              activeFace: "P", heldAbsentVar: "R",
              resistanceR: 5, inductanceL: 10, capacitanceC: 0.1, drivingOmega: 10, currentCycle: 1,
              diagnosticVocab: ["Born Rule", "Wavefunction Collapse", "XOR Bottleneck", "Projection", "Decoherence"],
              rewardQuestion: "How do the uncollapsed state vectors instantaneously burn their phase to drop a strictly positive real scalar into the Read-Only Ledger?"
            },
            {
              id: "circ-quant-2", name: "2. The Higgs Mechanism (Leverage)",
              activeFace: "P", heldAbsentVar: "I",
              resistanceR: 20, inductanceL: 50, capacitanceC: 0.05, drivingOmega: 5, currentCycle: 1,
              diagnosticVocab: ["Symmetry Breaking", "Yukawa Coupling", "Scalar Field", "Mass Generation", "I-U Pricing"],
              rewardQuestion: "How does the structural blueprint of the vacuum leverage against material resistance to assign invariant mass without any transit interval?"
            },
            {
              id: "circ-quant-3", name: "3. The Landauer Tax (Momentum)",
              activeFace: "P", heldAbsentVar: "U",
              resistanceR: 50, inductanceL: 20, capacitanceC: 0.2, drivingOmega: 15, currentCycle: 1,
              diagnosticVocab: ["Information Erasure", "Thermodynamic Cost", "Irreversibility", "Phase Burning", "Exhaust"],
              rewardQuestion: "How much thermodynamic mass-energy is exhausted by forcing the complex phase to irreversibly cross the confining material boundary?"
            },
            // --- WATER: Relational Flow & Flavor (I) ---
            {
              id: "circ-quant-4", name: "4. Flavor Mixing / CKM Matrix (Extraction)",
              activeFace: "I", heldAbsentVar: "R",
              resistanceR: 10, inductanceL: 80, capacitanceC: 0.01, drivingOmega: 2, currentCycle: 1,
              diagnosticVocab: ["Unitary Rotation", "Flavor Eigenstates", "Tangent Crossing Turn", "CP Violation", "Torsional Shear"],
              rewardQuestion: "What is the exact 90-degree relational rotation required to map the committed mass basis into an interactable gauge structure?"
            },
            {
              id: "circ-quant-5", name: "5. Mass Eigenstate Propagation (Ohmic)",
              activeFace: "I", heldAbsentVar: "P",
              resistanceR: 30, inductanceL: 40, capacitanceC: 0.05, drivingOmega: 1, currentCycle: 1,
              diagnosticVocab: ["Free Dirac Equation", "Stationary State", ".behold() state", "Superposition", "Uncollapsed Buffer"],
              rewardQuestion: "How does the particle maintain steady-state propagation through the vacuum structure while confined by its own material boundary?"
            },
            {
              id: "circ-quant-6", name: "6. Weak Measurement (Resonant)",
              activeFace: "I", heldAbsentVar: "U",
              resistanceR: 15, inductanceL: 5, capacitanceC: 0.3, drivingOmega: 12, currentCycle: 1,
              diagnosticVocab: ["Non-destructive Measurement", "Phase Preservation", "Transparent Blanket", "Unitary Evolution"],
              rewardQuestion: "How do we rotate the uncollapsed phase to extract information without triggering the thermodynamic threshold that forces a collapse?"
            },
            // --- AIR: The Structural Boundary (U) ---
            {
              id: "circ-quant-7", name: "7. The U(1) Gauge Field (Articulation)",
              activeFace: "U", heldAbsentVar: "R",
              resistanceR: 20, inductanceL: 60, capacitanceC: 0.1, drivingOmega: 3, currentCycle: 1,
              diagnosticVocab: ["Electromagnetism", "Photon", "Zero Impedance", "Map without Territory", "Blueprint"],
              rewardQuestion: "What is the pure structural potential difference established between the accumulated mass and the relational current?"
            },
            {
              id: "circ-quant-8", name: "8. Asymptotic Freedom (Grounding)",
              activeFace: "U", heldAbsentVar: "P",
              resistanceR: 80, inductanceL: 10, capacitanceC: 0.05, drivingOmega: 4, currentCycle: 1,
              diagnosticVocab: ["Confinement", "Color Charge", "Strong Force Mesh", "SU(3)", "Vacuum Substrate"],
              rewardQuestion: "What absolute spatial boundary emerges from the interaction of the quark flows pulling against the unyielding gluon mesh?"
            },
            {
              id: "circ-quant-9", name: "9. The Holographic Bound (Capacity)",
              activeFace: "U", heldAbsentVar: "I",
              resistanceR: 40, inductanceL: 30, capacitanceC: 0.02, drivingOmega: 1.5, currentCycle: 1,
              diagnosticVocab: ["Bekenstein Bound", "Markov Blanket", "K3 Surface Projection", "Information Entropy", "Area Law"],
              rewardQuestion: "What is the maximum structural capacity of the K3 boundary surface, given the mass and energy confined within its radius?"
            },
            // --- EARTH: The Boundaries of Physics (R) ---
            {
              id: "circ-quant-10", name: "10. The Planck Scale Wall (Impedance)",
              activeFace: "R", heldAbsentVar: "P",
              resistanceR: 100, inductanceL: 150, capacitanceC: 0.001, drivingOmega: 0.5, currentCycle: 1,
              diagnosticVocab: ["Tangent Divergence", "Infinities", "Quantum Gravity Failure", "Spacetime Foam", "Coordinate Breakdown"],
              rewardQuestion: "Why is the coordinate system breaking down into mathematical infinities when we try to force a macroscopic blueprint past the quantum boundary?"
            },
            {
              id: "circ-quant-11", name: "11. Renormalization (Accounting)",
              activeFace: "R", heldAbsentVar: "I",
              resistanceR: 120, inductanceL: 200, capacitanceC: 0.01, drivingOmega: 0.2, currentCycle: 1,
              diagnosticVocab: ["Running Coupling", "Cutoff Scale", "Dirac's Objection", "Mathematical Patch", "Scale Integration"],
              rewardQuestion: "How much artificial mathematical resistance must we subtract from the equations to prevent the structure from blowing up relative to its bare mass?"
            },
            {
              id: "circ-quant-12", name: "12. Black Hole Collapse (Brittleness)",
              activeFace: "R", heldAbsentVar: "U",
              resistanceR: 180, inductanceL: 5, capacitanceC: 0.5, drivingOmega: 20, currentCycle: 1,
              diagnosticVocab: ["Event Horizon", "Singularity", "Metabolic Overload", "Information Paradox", "Catastrophic Yield"],
              rewardQuestion: "How catastrophic is the geometric curvature when the massive Ledger accumulation completely overwhelms the local thermodynamic bandwidth?"
            }
          ]
        }
      ]
    },
    {
      id: "world-baryonic-001",
      name: "Macroscopic Baryonic Matter",
      description: "The compiled classical realm. Thermodynamics, material science, and classical mechanics operating strictly above the quantum cut.",
      apiProvider: 'manual',
      levels: [
        {
          id: "lvl-baryonic-001",
          name: "L0: Classical Physics & Thermodynamics",
          levelIndex: 0,
          vocabularies: [
            { term: "Work / Kinetic Energy", k4Type: "P", role: "SPEC", description: "The macroscopic transfer of energy; thermodynamic output." },
            { term: "State Equations / Kinematics", k4Type: "U", role: "SPEC", description: "The geometric and algebraic rules governing classical states." },
            { term: "Heat Transfer / Fluid Flow", k4Type: "I", role: "MATERIAL", description: "The relational transport of energy or matter over time." },
            { term: "Mass / Friction / Gravity", k4Type: "R", role: "SPEC", description: "The inertial ground; the macroscopic curvature of the compiled Ledger." }
          ],
          circuits: [
            // --- FIRE: Thermodynamic Work & Force (P) ---
            {
              id: "circ-baryonic-1", name: "1. The Ideal Engine (Synthesis)",
              activeFace: "P", heldAbsentVar: "R",
              resistanceR: 5, inductanceL: 10, capacitanceC: 0.1, drivingOmega: 10, currentCycle: 1,
              diagnosticVocab: ["Carnot Efficiency", "Isentropic", "Smooth Actuation", "Expansion", "Ideal Gas"],
              rewardQuestion: "How much macroscopic work can we extract directly from the pressure and heat flow, assuming a frictionless classical environment?"
            },
            {
              id: "circ-baryonic-2", name: "2. Mechanical Advantage (Leverage)",
              activeFace: "P", heldAbsentVar: "I",
              resistanceR: 20, inductanceL: 50, capacitanceC: 0.05, drivingOmega: 5, currentCycle: 1,
              diagnosticVocab: ["Simple Machines", "Gears", "Pulleys", "Torque", "Multiplier"],
              rewardQuestion: "How can we use classical geometry and rigid structures to multiply force against this massive gravitational load, without relying on velocity?"
            },
            {
              id: "circ-baryonic-3", name: "3. Joule Heating (Momentum)",
              activeFace: "P", heldAbsentVar: "U",
              resistanceR: 50, inductanceL: 20, capacitanceC: 0.2, drivingOmega: 15, currentCycle: 1,
              diagnosticVocab: ["Aerodynamic Drag", "Dissipation", "Kinetic Heating", "Impact", "Braking"],
              rewardQuestion: "How much kinetic energy is violently dissipating into heat as this high-velocity flow collides with the unyielding material surface?"
            },
            // --- WATER: Transport & Chemical Flow (I) ---
            {
              id: "circ-baryonic-4", name: "4. Pressure Gradient (Extraction)",
              activeFace: "I", heldAbsentVar: "R",
              resistanceR: 10, inductanceL: 80, capacitanceC: 0.01, drivingOmega: 2, currentCycle: 1,
              diagnosticVocab: ["Convection", "Thermodynamic Drive", "Pressure Differential", "Yielding", "Current"],
              rewardQuestion: "What is the exact volume of flow generated by the engine's power output pushing through the pipeline's geometry?"
            },
            {
              id: "circ-baryonic-5", name: "5. Terminal Velocity (Ohmic)",
              activeFace: "I", heldAbsentVar: "P",
              resistanceR: 30, inductanceL: 40, capacitanceC: 0.05, drivingOmega: 1, currentCycle: 1,
              diagnosticVocab: ["Steady State", "Viscosity", "Diffusion", "Equilibrium", "Constant Transport"],
              rewardQuestion: "What is the steady, sustainable velocity of the object falling through the fluid once gravity perfectly balances the aerodynamic drag?"
            },
            {
              id: "circ-baryonic-6", name: "6. Wave Propagation (Resonant)",
              activeFace: "I", heldAbsentVar: "U",
              resistanceR: 15, inductanceL: 5, capacitanceC: 0.3, drivingOmega: 12, currentCycle: 1,
              diagnosticVocab: ["Sound Waves", "Pendulum", "Harmonic Oscillator", "Acoustics", "Ripples"],
              rewardQuestion: "How does the kinetic energy bounce perfectly off the material tension to propagate a wave through the medium without needing a rigid blueprint?"
            },
            // --- AIR: Classical Structure & Engineering (U) ---
            {
              id: "circ-baryonic-7", name: "7. Kinematic Description (Articulation)",
              activeFace: "U", heldAbsentVar: "R",
              resistanceR: 20, inductanceL: 60, capacitanceC: 0.1, drivingOmega: 3, currentCycle: 1,
              diagnosticVocab: ["Trajectories", "Equations of Motion", "Phase Space", "Vectors", "Calculus"],
              rewardQuestion: "What is the mathematical equation of state that perfectly describes the relationship between the applied work and the resulting motion?"
            },
            {
              id: "circ-baryonic-8", name: "8. Material Stress (Grounding)",
              activeFace: "U", heldAbsentVar: "P",
              resistanceR: 80, inductanceL: 10, capacitanceC: 0.05, drivingOmega: 4, currentCycle: 1,
              diagnosticVocab: ["Hooke's Law", "Strain", "Load Bearing", "Deformation", "Tension"],
              rewardQuestion: "What strict geometric deformation is forced upon the structure by the continuous flow of traffic grinding against its gravitational mass?"
            },
            {
              id: "circ-baryonic-9", name: "9. Potential Energy (Capacity)",
              activeFace: "U", heldAbsentVar: "I",
              resistanceR: 40, inductanceL: 30, capacitanceC: 0.02, drivingOmega: 1.5, currentCycle: 1,
              diagnosticVocab: ["Gravitational Potential", "Elastic Energy", "Battery", "Architecture", "Suspension"],
              rewardQuestion: "What is the total stored capacity of this structure based on the mechanical work done to lift its mass against gravity?"
            },
            // --- EARTH: Material Limits & Entropy (R) ---
            {
              id: "circ-baryonic-10", name: "10. Static Friction (Impedance)",
              activeFace: "R", heldAbsentVar: "P",
              resistanceR: 100, inductanceL: 150, capacitanceC: 0.001, drivingOmega: 0.5, currentCycle: 1,
              diagnosticVocab: ["Activation Energy", "Inertia", "Stiction", "Catalyst Needed", "Locked"],
              rewardQuestion: "Why is this perfectly modeled chemical reaction refusing to start, and what activation barrier is blocking the flow of reagents?"
            },
            {
              id: "circ-baryonic-11", name: "11. Entropic Decay (Accounting)",
              activeFace: "R", heldAbsentVar: "I",
              resistanceR: 120, inductanceL: 200, capacitanceC: 0.01, drivingOmega: 0.2, currentCycle: 1,
              diagnosticVocab: ["Second Law", "Waste Heat", "Cooling", "Degradation", "Over-engineered"],
              rewardQuestion: "How much thermodynamic waste and parasitic friction is generated by maintaining this overly complex mechanical architecture?"
            },
            {
              id: "circ-baryonic-12", name: "12. Material Fracture (Brittleness)",
              activeFace: "R", heldAbsentVar: "U",
              resistanceR: 180, inductanceL: 5, capacitanceC: 0.5, drivingOmega: 20, currentCycle: 1,
              diagnosticVocab: ["Snapping", "Turbulence", "Catastrophic Failure", "Shattering", "Chaos"],
              rewardQuestion: "How catastrophic is the structural fracture when hurricane-force kinetic winds overwhelm the material integrity of the bridge?"
            }
          ]
        }
      ]
    },   
    {
      id: "world-personal-001",
      name: "Intimate Relationships & Attachment",
      description: "The thermodynamics of human connection. Mapping attachment styles, boundaries, and emotional investment.",
      apiProvider: 'manual',
      levels: [
        {
          id: "lvl-rel-001",
          name: "L0: Relational Dynamics",
          levelIndex: 0,
          vocabularies: [
            { term: "Passion / Vulnerability", k4Type: "P", role: "SPEC", description: "The raw emotional drive, desire, and commitment." },
            { term: "Boundaries / Expectations", k4Type: "U", role: "SPEC", description: "The rules, labels, and structural safety of the relationship." },
            { term: "Communication / Affection", k4Type: "I", role: "MATERIAL", description: "The daily flow of connection, texts, and shared time." },
            { term: "Baggage / Insecurity", k4Type: "R", role: "SPEC", description: "Past trauma, external stressors, and emotional risk." }
          ],
          circuits: [
            // --- FIRE: Passion & Commitment (P) ---
            {
              id: "circ-rel-1", name: "1. Secure Attachment (Synthesis)",
              activeFace: "P", heldAbsentVar: "R",
              resistanceR: 5, inductanceL: 10, capacitanceC: 0.1, drivingOmega: 10, currentCycle: 1,
              diagnosticVocab: ["Trust", "Deep Connection", "Safety", "Partnership", "Effortless"],
              rewardQuestion: "How do we generate deep passion directly from our clear boundaries and our open, daily communication, ignoring our past baggage?"
            },
            {
              id: "circ-rel-2", name: "2. The Strategic Match (Leverage)",
              activeFace: "P", heldAbsentVar: "I",
              resistanceR: 20, inductanceL: 50, capacitanceC: 0.05, drivingOmega: 5, currentCycle: 1,
              diagnosticVocab: ["Arranged Marriage", "On Paper", "Checkboxes", "Compatibility", "Guarded"],
              rewardQuestion: "How can we build a committed partnership based on heavy, structured expectations that mitigate our insecurities, even if daily affection is low?"
            },
            {
              id: "circ-rel-3", name: "3. Trauma Bonding (Momentum)",
              activeFace: "P", heldAbsentVar: "U",
              resistanceR: 50, inductanceL: 20, capacitanceC: 0.2, drivingOmega: 15, currentCycle: 1,
              diagnosticVocab: ["Toxic Passion", "Rollercoaster", "Make up / Break up", "Intensity", "Chaos"],
              rewardQuestion: "How much intense, desperate communication are we throwing at our massive emotional baggage to force this passion to work, completely ignoring healthy boundaries?"
            },
            // --- WATER: Communication & Flow (I) ---
            {
              id: "circ-rel-4", name: "4. Duty Dating (Extraction)",
              activeFace: "I", heldAbsentVar: "R",
              resistanceR: 10, inductanceL: 80, capacitanceC: 0.01, drivingOmega: 2, currentCycle: 1,
              diagnosticVocab: ["Going through motions", "Obligation", "Scheduled dates", "Routine", "Dry"],
              rewardQuestion: "What is the exact communication required of me to satisfy the label and expectations of this relationship, without taking on emotional risk?"
            },
            {
              id: "circ-rel-5", name: "5. The Roommate Phase (Ohmic)",
              activeFace: "I", heldAbsentVar: "P",
              resistanceR: 30, inductanceL: 40, capacitanceC: 0.05, drivingOmega: 1, currentCycle: 1,
              diagnosticVocab: ["Coexisting", "Domestic", "Comfortable", "Low spark", "Stable"],
              rewardQuestion: "What is a comfortable, sustainable flow of daily interaction given our established rules and our everyday life stressors, even if the passion is asleep?"
            },
            {
              id: "circ-rel-6", name: "6. The Honeymoon Phase (Resonant)",
              activeFace: "I", heldAbsentVar: "U",
              resistanceR: 15, inductanceL: 5, capacitanceC: 0.3, drivingOmega: 12, currentCycle: 1,
              diagnosticVocab: ["Infatuation", "Texting all night", "Chemistry", "Spontaneous", "Blind spot"],
              rewardQuestion: "How do we keep this massive flow of affection and chemistry going by focusing purely on our desire and ignoring all long-term expectations?"
            },
            // --- AIR: Boundaries & Expectations (U) ---
            {
              id: "circ-rel-7", name: "7. 'What are we?' (Articulation)",
              activeFace: "U", heldAbsentVar: "R",
              resistanceR: 20, inductanceL: 60, capacitanceC: 0.1, drivingOmega: 3, currentCycle: 1,
              diagnosticVocab: ["DTR", "Labeling", "Checking in", "Defining", "Therapy"],
              rewardQuestion: "What is the actual label or boundary we need to put on this dynamic, based on the vulnerability we feel and the communication we are already doing?"
            },
            {
              id: "circ-rel-8", name: "8. Setting Hard Boundaries (Grounding)",
              activeFace: "U", heldAbsentVar: "P",
              resistanceR: 80, inductanceL: 10, capacitanceC: 0.05, drivingOmega: 4, currentCycle: 1,
              diagnosticVocab: ["Ultimatums", "Dealbreakers", "Self-respect", "Walls", "Rules"],
              rewardQuestion: "What strict, non-negotiable boundary must I set right now based on the painful behavior I just experienced from you?"
            },
            {
              id: "circ-rel-9", name: "9. Guarded Dating (Capacity)",
              activeFace: "U", heldAbsentVar: "I",
              resistanceR: 40, inductanceL: 30, capacitanceC: 0.02, drivingOmega: 1.5, currentCycle: 1,
              diagnosticVocab: ["Pre-nup", "Protecting peace", "Moving slow", "Vetting", "Pacing"],
              rewardQuestion: "What is a realistic set of expectations that balances my desire for this connection with my need to protect myself from my past baggage?"
            },
            // --- EARTH: Emotional Friction & Insecurity (R) ---
            {
              id: "circ-rel-10", name: "10. Avoidant Attachment (Impedance)",
              activeFace: "R", heldAbsentVar: "P",
              resistanceR: 100, inductanceL: 150, capacitanceC: 0.001, drivingOmega: 0.5, currentCycle: 1,
              diagnosticVocab: ["Pulling away", "Ghosting", "Walls up", "Suffocated", "Distant"],
              rewardQuestion: "Why are these heavy relationship expectations creating so much internal friction that it is completely blocking my ability to communicate or show affection?"
            },
            {
              id: "circ-rel-11", name: "11. The Over-Analyzer (Accounting)",
              activeFace: "R", heldAbsentVar: "I",
              resistanceR: 120, inductanceL: 200, capacitanceC: 0.01, drivingOmega: 0.2, currentCycle: 1,
              diagnosticVocab: ["Self-sabotage", "Projecting", "Insecure", "Interrogating", "Testing"],
              rewardQuestion: "How much emotional exhaustion is this massive list of 'perfect partner' expectations costing us, relative to the actual love we share?"
            },
            {
              id: "circ-rel-12", name: "12. Anxious Attachment (Brittleness)",
              activeFace: "R", heldAbsentVar: "U",
              resistanceR: 180, inductanceL: 5, capacitanceC: 0.5, drivingOmega: 20, currentCycle: 1,
              diagnosticVocab: ["Clingy", "Desperate", "Fear of abandonment", "Shattering", "Panic"],
              rewardQuestion: "How much psychological damage am I taking by pouring massive vulnerability into this connection while receiving chaotic, zero-communication in return, with no boundaries to protect me?"
            }
          ]
        }
      ]
    },
    {
      id: "world-professional-001",
      name: "Career & Professional Dynamics",
      description: "The K4 topology applied to corporate climbing, team dynamics, and office politics.",
      apiProvider: 'manual',
      levels: [
        {
          id: "lvl-prof-001",
          name: "L0: The Corporate Ladder",
          levelIndex: 0,
          vocabularies: [
            { term: "Ambition / Deliverables", k4Type: "P", role: "SPEC", description: "The drive to execute, ship, and get promoted." },
            { term: "Role / Authority", k4Type: "U", role: "SPEC", description: "The job description, title, and organizational chart." },
            { term: "Networking / Soft Skills", k4Type: "I", role: "MATERIAL", description: "The flow of influence, favors, and cross-team communication." },
            { term: "Office Politics / Burnout", k4Type: "R", role: "SPEC", description: "The bureaucratic friction, market reality, and glass ceilings." }
          ],
          circuits: [
            {
              id: "circ-prof-1", name: "1. The Star Performer (Synthesis)",
              activeFace: "P", heldAbsentVar: "R",
              resistanceR: 5, inductanceL: 10, capacitanceC: 0.1, drivingOmega: 10, currentCycle: 1,
              diagnosticVocab: ["High Impact", "Promotion track", "Synergy", "Crushing it", "Alignment"],
              rewardQuestion: "How do I maximize my deliverables by perfectly leveraging my official authority and my strong network of influence, ignoring the office politics?"
            },
            {
              id: "circ-prof-3", name: "3. The Firefighter / Hero (Momentum)",
              activeFace: "P", heldAbsentVar: "U",
              resistanceR: 50, inductanceL: 20, capacitanceC: 0.2, drivingOmega: 15, currentCycle: 1,
              diagnosticVocab: ["Silo-busting", "All-nighter", "Saving the day", "Unsung", "Grind"],
              rewardQuestion: "How do I force this project to completion by relying entirely on my personal relationships to smash through the bureaucratic red tape, regardless of my actual job title?"
            },
            {
              id: "circ-prof-4", name: "4. Quiet Quitting (Extraction)",
              activeFace: "I", heldAbsentVar: "R",
              resistanceR: 10, inductanceL: 80, capacitanceC: 0.01, drivingOmega: 2, currentCycle: 1,
              diagnosticVocab: ["Act your wage", "Phoning it in", "Malicious compliance", "Clocking out", "Disengaged"],
              rewardQuestion: "What is the absolute minimum communication and effort required to fulfill the exact wording of my job description without taking on extra stress?"
            },
            {
              id: "circ-prof-10", name: "10. The Siloed Genius (Impedance)",
              activeFace: "R", heldAbsentVar: "P",
              resistanceR: 100, inductanceL: 150, capacitanceC: 0.001, drivingOmega: 0.5, currentCycle: 1,
              diagnosticVocab: ["Passed over", "Unrecognized", "Brilliant jerk", "Blocked", "Resentful"],
              rewardQuestion: "Why is my incredibly high level of expertise and authority resulting in zero actual influence on the team, and what is blocking my ability to collaborate?"
            },
            {
              id: "circ-prof-11", name: "11. The Micromanager (Accounting)",
              activeFace: "R", heldAbsentVar: "I",
              resistanceR: 120, inductanceL: 200, capacitanceC: 0.01, drivingOmega: 0.2, currentCycle: 1,
              diagnosticVocab: ["Bottleneck", "Control freak", "Status updates", "Disempowering", "Process-heavy"],
              rewardQuestion: "How much team morale and momentum is being destroyed by enforcing this massive hierarchical authority structure to produce so few actual deliverables?"
            },
            {
              id: "circ-prof-12", name: "12. The Martyr (Brittleness)",
              activeFace: "R", heldAbsentVar: "U",
              resistanceR: 180, inductanceL: 5, capacitanceC: 0.5, drivingOmega: 20, currentCycle: 1,
              diagnosticVocab: ["Scapegoat", "Overworked", "Underpaid", "Crushed", "Quitting"],
              rewardQuestion: "How much catastrophic burnout am I taking on by trying to single-handedly deliver massive results with zero network support and no official authority to protect me?"
            }
          ]
        }
      ]
    },
    {
      id: "world-business-001",
      name: "Go-To-Market & Business Models",
      description: "The physics of product-market fit, unit economics, and company scaling.",
      apiProvider: 'manual',
      levels: [
        {
          id: "lvl-biz-001",
          name: "L0: Startup Economics",
          levelIndex: 0,
          vocabularies: [
            { term: "Revenue / Conversion", k4Type: "P", role: "SPEC", description: "The top-line actualization, closed-won deals." },
            { term: "Value Prop / Pricing Model", k4Type: "U", role: "SPEC", description: "The structural unit economics and product offering." },
            { term: "Funnel / User Engagement", k4Type: "I", role: "MATERIAL", description: "The flow of acquisition, retention, and traffic." },
            { term: "CAC / Churn / Competition", k4Type: "R", role: "SPEC", description: "Customer Acquisition Cost and market resistance." }
          ],
          circuits: [
            {
              id: "circ-biz-1", name: "1. Product-Market Fit (Synthesis)",
              activeFace: "P", heldAbsentVar: "R",
              resistanceR: 5, inductanceL: 10, capacitanceC: 0.1, drivingOmega: 10, currentCycle: 1,
              diagnosticVocab: ["Unicorn", "Hockey stick", "Scaling", "Organic growth", "High LTV"],
              rewardQuestion: "How do we maximize revenue simply by multiplying our incredible pricing model against our massive, organic user engagement, ignoring CAC for now?"
            },
            {
              id: "circ-biz-3", name: "3. Growth Hacking (Momentum)",
              activeFace: "P", heldAbsentVar: "U",
              resistanceR: 50, inductanceL: 20, capacitanceC: 0.2, drivingOmega: 15, currentCycle: 1,
              diagnosticVocab: ["Performance marketing", "Ad spend", "Brute force", "Buying users", "Arbitrage"],
              rewardQuestion: "How much revenue can we force through the door by pouring a massive volume of traffic into a high-CAC market, even if our core product value prop is weak?"
            },
            {
              id: "circ-biz-5", name: "5. Product-Led Growth (Ohmic)",
              activeFace: "I", heldAbsentVar: "P",
              resistanceR: 30, inductanceL: 40, capacitanceC: 0.05, drivingOmega: 1, currentCycle: 1,
              diagnosticVocab: ["Freemium", "Self-serve", "Viral coefficient", "Frictionless", "Sticky"],
              rewardQuestion: "What is the steady, sustainable flow of user acquisition we can maintain purely based on the strength of our free tier divided by the friction of onboarding?"
            },
            {
              id: "circ-biz-10", name: "10. Vaporware (Impedance)",
              activeFace: "R", heldAbsentVar: "P",
              resistanceR: 100, inductanceL: 150, capacitanceC: 0.001, drivingOmega: 0.5, currentCycle: 1,
              diagnosticVocab: ["Pivot needed", "Ghost town", "Beautiful UI, no users", "Zero traction", "Dead"],
              rewardQuestion: "Why is this absolutely perfect pitch deck and pricing model resulting in zero user acquisition, and what market resistance is blocking the funnel?"
            },
            {
              id: "circ-biz-11", name: "11. Enterprise Sales Hell (Accounting)",
              activeFace: "R", heldAbsentVar: "I",
              resistanceR: 120, inductanceL: 200, capacitanceC: 0.01, drivingOmega: 0.2, currentCycle: 1,
              diagnosticVocab: ["Procurement", "Compliance", "Long sales cycle", "Legal review", "Stuck"],
              rewardQuestion: "How much cash burn and operational friction is this massive, over-engineered enterprise legal compliance costing us, relative to the tiny amount of actual revenue closing?"
            },
            {
              id: "circ-biz-12", name: "12. The Leaky Bucket (Brittleness)",
              activeFace: "R", heldAbsentVar: "U",
              resistanceR: 180, inductanceL: 5, capacitanceC: 0.5, drivingOmega: 20, currentCycle: 1,
              diagnosticVocab: ["Massive churn", "Burning cash", "Unsustainable", "Bait and switch", "Death spiral"],
              rewardQuestion: "How quickly is our startup fracturing due to aggressively closing massive revenue deals with a terrible user experience and no actual product value to retain them?"
            }
          ]
        }
      ]
    }
  ]
};
