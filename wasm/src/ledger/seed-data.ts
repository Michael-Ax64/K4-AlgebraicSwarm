// wasm/src/ledger/seed-data.ts

export const defaultSeedData = {
  worlds: [
    {
      id: "world-general-001",
      name: "World 0: General Agency (Baseline)",
      description: "The universal semantic mapping for everyday human psychology, problem-solving, and task execution.",
      languages: [
        {
          id: "lang-gen-001", name: "Everyday Execution Lexicon",
          vocabularies: [
            { term: "Intent / Goal", k4Type: "P", role: "SPEC", description: "The immediate desire or drive to act." },
            { term: "Plan / Method", k4Type: "U", role: "SPEC", description: "The structure, steps, or framework chosen." },
            { term: "Process / Attention", k4Type: "I", role: "MATERIAL", description: "The active flow of doing." },
            { term: "Constraint / Reality", k4Type: "R", role: "SPEC", description: "Time, energy, physical limits." }
          ]
        }
      ],
      views: [
        { id: "view-gen-001", languageId: "lang-gen-001", name: "Daily Task Execution", description: "Baseline parameters for standard work.", innateOmega: 2.0, innateR: 20, innateL: 30, innateC: 0.1 }
      ],
      circuits: [
        { id: "circ-gen-1", viewId: "view-gen-001", name: "1. Flow State (Synthesis)", activeFace: "P", heldAbsentVar: "R", omega: 10, r: 5, l: 10, c: 0.1, diagnosticVocab: ["Immersion", "Execution", "Synchrony", "Zone", "Effortless"], rewardQuestion: "How do I channel my plan and my energy into immediate results right now without worrying about constraints?" },
        { id: "circ-gen-2", viewId: "view-gen-001", name: "2. Work Smart (Leverage)", activeFace: "P", heldAbsentVar: "I", omega: 5, r: 20, l: 50, c: 0.05, diagnosticVocab: ["Automation", "Delegation", "Systems", "Multiplier", "Scale"], rewardQuestion: "How can I design a system that achieves the goal despite my limited resources, minimizing the daily grind?" },
        { id: "circ-gen-3", viewId: "view-gen-001", name: "3. Brute Force (Momentum)", activeFace: "P", heldAbsentVar: "U", omega: 15, r: 50, l: 20, c: 0.2, diagnosticVocab: ["Willpower", "Grind", "Pushing through", "Sweat", "Hustle"], rewardQuestion: "How do I push through this obstacle using sheer willpower, even if I lack a clear plan?" },
        { id: "circ-gen-4", viewId: "view-gen-001", name: "4. Following the Script (Extraction)", activeFace: "I", heldAbsentVar: "R", omega: 2, r: 10, l: 80, c: 0.01, diagnosticVocab: ["Checklist", "Procedure", "Compliance", "Algorithm"], rewardQuestion: "What is the exact next step the blueprint dictates to maintain progress?" },
        { id: "circ-gen-5", viewId: "view-gen-001", name: "5. Daily Routine (Ohmic)", activeFace: "I", heldAbsentVar: "P", omega: 1, r: 30, l: 40, c: 0.05, diagnosticVocab: ["Maintenance", "Habit", "Pacing", "Sustainability"], rewardQuestion: "What is the sustainable, everyday routine given the rules I have to follow and my energy limits?" },
        { id: "circ-gen-6", viewId: "view-gen-001", name: "6. Intuitive Improv (Resonant)", activeFace: "I", heldAbsentVar: "U", omega: 12, r: 15, l: 5, c: 0.3, diagnosticVocab: ["Adaptation", "Feel", "Navigating", "Flowing around"], rewardQuestion: "How do I adapt on the fly to keep moving toward what I want, dodging what's immediately in front of me?" },
        { id: "circ-gen-7", viewId: "view-gen-001", name: "7. Sense-Making (Articulation)", activeFace: "U", heldAbsentVar: "R", omega: 3, r: 20, l: 60, c: 0.1, diagnosticVocab: ["Retrospective", "Theory", "Naming", "Pattern recognition"], rewardQuestion: "What is the actual strategy I seem to be following, based on where I want to go and what I'm doing?" },
        { id: "circ-gen-8", viewId: "view-gen-001", name: "8. Learning the Hard Way (Grounding)", activeFace: "U", heldAbsentVar: "P", omega: 4, r: 80, l: 10, c: 0.05, diagnosticVocab: ["Boundaries", "Lessons", "Hard rules", "Scar tissue"], rewardQuestion: "What strict boundary or rule do I need to set based on the hard physical lesson I just learned?" },
        { id: "circ-gen-9", viewId: "view-gen-001", name: "9. Realistic Scoping (Capacity)", activeFace: "U", heldAbsentVar: "I", omega: 1.5, r: 40, l: 30, c: 0.02, diagnosticVocab: ["Sober blueprint", "Budgeting", "Scoping", "Trade-offs"], rewardQuestion: "What is a realistic blueprint that balances my ultimate ambition with the hard constraints of my resources?" },
        { id: "circ-gen-10", viewId: "view-gen-001", name: "10. Analysis Paralysis (Impedance)", activeFace: "R", heldAbsentVar: "P", omega: 0.5, r: 100, l: 150, c: 0.001, diagnosticVocab: ["Stuck", "Overthinking", "Procrastination", "Guilt"], rewardQuestion: "Why is this perfect plan taking so much effort to start, and what is blocking my ability to just act?" },
        { id: "circ-gen-11", viewId: "view-gen-001", name: "11. Bureaucratic Bloat (Accounting)", activeFace: "R", heldAbsentVar: "I", omega: 0.2, r: 120, l: 200, c: 0.01, diagnosticVocab: ["Red tape", "Perfectionism", "Over-engineering", "Waste"], rewardQuestion: "How much 'reality-tax' is this overly complicated planning costing me, relative to the simple thing I'm trying to achieve?" },
        { id: "circ-gen-12", viewId: "view-gen-001", name: "12. Burnout (Brittleness)", activeFace: "R", heldAbsentVar: "U", omega: 20, r: 180, l: 5, c: 0.5, diagnosticVocab: ["Exhaustion", "Fracture", "Toll", "Unsustainable"], rewardQuestion: "How much physical and mental toll is it taking on me to chase this massive dream with such chaotic, unstructured effort?" }
      ]
    },
    {
      id: "world-devops-001",
      name: "World 1: Software Engineering (DevOps)",
      description: "A distributed coherence mapping codebase architecture up to organizational runway.",
      languages: [
        {
          id: "lang-dev-001", name: "L0: Sprint / PR Level",
          vocabularies: [
            { term: "Feature Ticket / Urgency", k4Type: "P", role: "SPEC", description: "The generative drive initiating code." },
            { term: "Design Patterns / Architecture", k4Type: "U", role: "SPEC", description: "The structural potential and typing." },
            { term: "Pull Request / CI-CD", k4Type: "I", role: "MATERIAL", description: "The relational flow of code integration." },
            { term: "Technical Debt / Legacy Code", k4Type: "R", role: "SPEC", description: "The unyielding ground and friction." }
          ]
        },
        {
          id: "lang-dev-002", name: "L1: Organization / Runway",
          vocabularies: [
            { term: "Market Deadline / Burn Rate", k4Type: "P", role: "SPEC", description: "" },
            { term: "Org Chart / Agile Framework", k4Type: "U", role: "SPEC", description: "" },
            { term: "Cross-Team Communication", k4Type: "I", role: "MATERIAL", description: "" },
            { term: "Payroll / Server Costs", k4Type: "R", role: "SPEC", description: "" }
          ]
        }
      ],
      views: [
        { id: "view-dev-001", languageId: "lang-dev-001", name: "Sprint Execution Lens", description: "High velocity execution tracking.", innateOmega: 10, innateR: 20, innateL: 50, innateC: 0.05 },
        { id: "view-dev-002", languageId: "lang-dev-002", name: "Quarterly Planning Lens", description: "Macro organization flow.", innateOmega: 0.5, innateR: 100, innateL: 200, innateC: 0.01 }
      ],
      circuits: [
        { id: "circ-dev-1", viewId: "view-dev-001", name: "1. The God-Tier Sprint (Synthesis)", activeFace: "P", heldAbsentVar: "R", omega: 10, r: 5, l: 10, c: 0.1, diagnosticVocab: ["Ship it", "Green builds", "Zone", "Feature complete"], rewardQuestion: "How do we deploy this feature using our current architecture and pipelines, completely ignoring technical debt for now?" },
        { id: "circ-dev-2", viewId: "view-dev-001", name: "2. The 10x Automation (Leverage)", activeFace: "P", heldAbsentVar: "I", omega: 5, r: 20, l: 50, c: 0.05, diagnosticVocab: ["DevOps magic", "Scripts", "Tooling", "Infrastructure as Code"], rewardQuestion: "How can we design a structural pattern that ships this feature despite legacy debt, bypassing the need for manual PR reviews?" },
        { id: "circ-dev-3", viewId: "view-dev-001", name: "3. Crunch Time (Momentum)", activeFace: "P", heldAbsentVar: "U", omega: 15, r: 50, l: 20, c: 0.2, diagnosticVocab: ["Hotfix", "Weekend work", "Brute force", "Duct tape"], rewardQuestion: "How do we push this hotfix through the CI/CD pipeline and legacy friction using sheer developer hours, without any architectural plan?" },
        { id: "circ-dev-4", viewId: "view-dev-001", name: "4. Ticket Execution (Extraction)", activeFace: "I", heldAbsentVar: "R", omega: 2, r: 10, l: 80, c: 0.01, diagnosticVocab: ["Story execution", "Coding to spec", "Implementation"], rewardQuestion: "What is the exact next PR or commit we need to merge to implement this feature ticket according to the architectural spec?" },
        { id: "circ-dev-5", viewId: "view-dev-001", name: "5. Maintenance Mode (Ohmic)", activeFace: "I", heldAbsentVar: "P", omega: 1, r: 30, l: 40, c: 0.05, diagnosticVocab: ["Refactoring", "Dependency updates", "Chore", "Linting"], rewardQuestion: "What is a sustainable CI/CD throughput given our strict architectural rules and the weight of our legacy technical debt?" },
        { id: "circ-dev-6", viewId: "view-dev-001", name: "6. Agile Improv (Resonant)", activeFace: "I", heldAbsentVar: "U", omega: 12, r: 15, l: 5, c: 0.3, diagnosticVocab: ["Hacking", "Unblocked", "Workaround", "Moving fast"], rewardQuestion: "How do we keep PRs flowing and adapting on the fly to ship this feature, dodging legacy debt without waiting for a formal architecture?" },
        { id: "circ-dev-7", viewId: "view-dev-001", name: "7. Post-Mortem / Retro (Articulation)", activeFace: "U", heldAbsentVar: "R", omega: 3, r: 20, l: 60, c: 0.1, diagnosticVocab: ["Docs", "UML", "Whiteboarding", "Agile Retro"], rewardQuestion: "What is the actual design pattern we are implicitly building, based on the tickets we are shipping and the PRs we are merging?" },
        { id: "circ-dev-8", viewId: "view-dev-001", name: "8. Incident Response (Grounding)", activeFace: "U", heldAbsentVar: "P", omega: 4, r: 80, l: 10, c: 0.05, diagnosticVocab: ["Post-incident review", "Linter rules", "CI guards"], rewardQuestion: "What strict architectural rule or CI guardrail do we need to set based on the legacy debt we just collided with during that PR merge?" },
        { id: "circ-dev-9", viewId: "view-dev-001", name: "9. Sprint Planning (Capacity)", activeFace: "U", heldAbsentVar: "I", omega: 1.5, r: 40, l: 30, c: 0.02, diagnosticVocab: ["Story points", "Scoping", "Backlog grooming", "Trade-offs"], rewardQuestion: "What is a realistic software architecture that balances our product roadmap ambitions with the hard constraints of our technical debt?" },
        { id: "circ-dev-10", viewId: "view-dev-001", name: "10. Architecture Astronauts (Impedance)", activeFace: "R", heldAbsentVar: "P", omega: 0.5, r: 100, l: 150, c: 0.001, diagnosticVocab: ["Over-engineering", "Bikeshedding", "Analysis paralysis"], rewardQuestion: "Why is this perfect microservices architecture taking so long to actually write, and what legacy debt is blocking our PRs from merging?" },
        { id: "circ-dev-11", viewId: "view-dev-001", name: "11. Enterprise Process (Accounting)", activeFace: "R", heldAbsentVar: "I", omega: 0.2, r: 120, l: 200, c: 0.01, diagnosticVocab: ["Red tape", "Approval hell", "Overhead", "Process tax"], rewardQuestion: "How much 'process-tax' and legacy friction is this overly complicated architecture costing us, relative to the simple feature ticket we're trying to ship?" },
        { id: "circ-dev-12", viewId: "view-dev-001", name: "12. Developer Burnout (Brittleness)", activeFace: "R", heldAbsentVar: "U", omega: 20, r: 180, l: 5, c: 0.5, diagnosticVocab: ["Outage", "PagerDuty fatigue", "Attrition", "Fragile tests"], rewardQuestion: "How much physical toll and server cost is it taking to chase these massive feature tickets with chaotic, unreviewed PRs and zero design patterns?" }
      ]
    },
    {
      id: "world-quantum-001",
      name: "World 2: Standard Model & Quantum Mechanics",
      description: "The K4 topology applied to subatomic physics.",
      languages: [
        {
          id: "lang-quant-001", name: "Particle Substrate",
          vocabularies: [
            { term: "Mass / The Ledger", k4Type: "P", role: "SPEC", description: "Gravity/Baryons." },
            { term: "Photon / Structural Potential", k4Type: "U", role: "SPEC", description: "U(1) gauge field." },
            { term: "Weak Bosons / Relational Current", k4Type: "I", role: "MATERIAL", description: "SU(2) gauge field." },
            { term: "Gluons / Material Confinement", k4Type: "R", role: "SPEC", description: "SU(3) gauge field." }
          ]
        }
      ],
      views: [
        { id: "view-quant-001", languageId: "lang-quant-001", name: "Quantum Field Monitor", description: "", innateOmega: 100, innateR: 5, innateL: 10, innateC: 0.001 }
      ],
      circuits: [
        { id: "circ-quant-1", viewId: "view-quant-001", name: "1. The Higgs Mechanism (Leverage)", activeFace: "P", heldAbsentVar: "I", omega: 5, r: 20, l: 50, c: 0.05, diagnosticVocab: ["Symmetry Breaking", "Yukawa Coupling", "Mass Generation"], rewardQuestion: "How does the structural blueprint of the vacuum leverage against material resistance to assign invariant mass without any transit interval?" },
        { id: "circ-quant-2", viewId: "view-quant-001", name: "2. The Landauer Tax (Momentum)", activeFace: "P", heldAbsentVar: "U", omega: 15, r: 50, l: 20, c: 0.2, diagnosticVocab: ["Information Erasure", "Thermodynamic Cost", "Irreversibility"], rewardQuestion: "How much thermodynamic mass-energy is exhausted by forcing the complex phase to irreversibly cross the confining material boundary?" },
        { id: "circ-quant-3", viewId: "view-quant-001", name: "3. The .observe() Collapse (Synthesis)", activeFace: "P", heldAbsentVar: "R", omega: 10, r: 5, l: 10, c: 0.1, diagnosticVocab: ["Born Rule", "Wavefunction Collapse", "Decoherence"], rewardQuestion: "How do the uncollapsed state vectors instantaneously burn their phase to drop a strictly positive real scalar into the Read-Only Ledger?" },
        { id: "circ-quant-4", viewId: "view-quant-001", name: "4. Weak Measurement (Resonant)", activeFace: "I", heldAbsentVar: "U", omega: 12, r: 15, l: 5, c: 0.3, diagnosticVocab: ["Non-destructive Measurement", "Phase Preservation"], rewardQuestion: "How do we rotate the uncollapsed phase to extract information without triggering the thermodynamic threshold that forces a collapse?" },
        { id: "circ-quant-5", viewId: "view-quant-001", name: "5. Flavor Mixing (Extraction)", activeFace: "I", heldAbsentVar: "R", omega: 2, r: 10, l: 80, c: 0.01, diagnosticVocab: ["CKM Matrix", "Flavor Eigenstates", "CP Violation"], rewardQuestion: "What is the exact 90-degree relational rotation required to map the committed mass basis into an interactable gauge structure?" },
        { id: "circ-quant-6", viewId: "view-quant-001", name: "6. Mass Eigenstate (Ohmic)", activeFace: "I", heldAbsentVar: "P", omega: 1, r: 30, l: 40, c: 0.05, diagnosticVocab: ["Free Dirac Equation", "Stationary State", "Superposition"], rewardQuestion: "How does the particle maintain steady-state propagation through the vacuum structure while confined by its own material boundary?" },
        { id: "circ-quant-7", viewId: "view-quant-001", name: "7. U(1) Gauge Field (Articulation)", activeFace: "U", heldAbsentVar: "R", omega: 3, r: 20, l: 60, c: 0.1, diagnosticVocab: ["Electromagnetism", "Photon", "Zero Impedance"], rewardQuestion: "What is the pure structural potential difference established between the accumulated mass and the relational current?" },
        { id: "circ-quant-8", viewId: "view-quant-001", name: "8. Asymptotic Freedom (Grounding)", activeFace: "U", heldAbsentVar: "P", omega: 4, r: 80, l: 10, c: 0.05, diagnosticVocab: ["Confinement", "Color Charge", "Strong Force Mesh"], rewardQuestion: "What absolute spatial boundary emerges from the interaction of the quark flows pulling against the unyielding gluon mesh?" },
        { id: "circ-quant-9", viewId: "view-quant-001", name: "9. Holographic Bound (Capacity)", activeFace: "U", heldAbsentVar: "I", omega: 1.5, r: 40, l: 30, c: 0.02, diagnosticVocab: ["Bekenstein Bound", "Markov Blanket", "Information Entropy"], rewardQuestion: "What is the maximum structural capacity of the boundary surface, given the mass and energy confined within its radius?" },
        { id: "circ-quant-10", viewId: "view-quant-001", name: "10. Planck Scale Wall (Impedance)", activeFace: "R", heldAbsentVar: "P", omega: 0.5, r: 100, l: 150, c: 0.001, diagnosticVocab: ["Tangent Divergence", "Infinities", "Quantum Gravity Failure"], rewardQuestion: "Why is the coordinate system breaking down into mathematical infinities when we try to force a macroscopic blueprint past the quantum boundary?" },
        { id: "circ-quant-11", viewId: "view-quant-001", name: "11. Renormalization (Accounting)", activeFace: "R", heldAbsentVar: "I", omega: 0.2, r: 120, l: 200, c: 0.01, diagnosticVocab: ["Running Coupling", "Cutoff Scale", "Mathematical Patch"], rewardQuestion: "How much artificial mathematical resistance must we subtract from the equations to prevent the structure from blowing up relative to its bare mass?" },
        { id: "circ-quant-12", viewId: "view-quant-001", name: "12. Black Hole Collapse (Brittleness)", activeFace: "R", heldAbsentVar: "U", omega: 20, r: 180, l: 5, c: 0.5, diagnosticVocab: ["Event Horizon", "Singularity", "Information Paradox"], rewardQuestion: "How catastrophic is the geometric curvature when the massive Ledger accumulation completely overwhelms the local thermodynamic bandwidth?" }
      ]
    },
    {
      id: "world-baryonic-001",
      name: "World 3: Macroscopic Baryonic Matter",
      description: "Classical thermodynamics and mechanical engineering.",
      languages: [
        {
          id: "lang-baryonic-001", name: "Classical Physics",
          vocabularies: [
            { term: "Work / Kinetic Energy", k4Type: "P", role: "SPEC", description: "" },
            { term: "State Equations / Kinematics", k4Type: "U", role: "SPEC", description: "" },
            { term: "Heat Transfer / Fluid Flow", k4Type: "I", role: "MATERIAL", description: "" },
            { term: "Mass / Friction / Gravity", k4Type: "R", role: "SPEC", description: "" }
          ]
        }
      ],
      views: [
        { id: "view-baryonic-001", languageId: "lang-baryonic-001", name: "Classical Mechanics Sandbox", description: "", innateOmega: 5.0, innateR: 40, innateL: 60, innateC: 0.1 }
      ],
      circuits: [
        { id: "circ-bar-1", viewId: "view-baryonic-001", name: "1. Mechanical Advantage (Leverage)", activeFace: "P", heldAbsentVar: "I", omega: 5, r: 20, l: 50, c: 0.05, diagnosticVocab: ["Simple Machines", "Gears", "Torque"], rewardQuestion: "How can we use classical geometry to multiply force against this massive gravitational load, without relying on velocity?" },
        { id: "circ-bar-2", viewId: "view-baryonic-001", name: "2. Joule Heating (Momentum)", activeFace: "P", heldAbsentVar: "U", omega: 15, r: 50, l: 20, c: 0.2, diagnosticVocab: ["Aerodynamic Drag", "Kinetic Heating", "Braking"], rewardQuestion: "How much kinetic energy is violently dissipating into heat as this high-velocity flow collides with the material surface?" },
        { id: "circ-bar-3", viewId: "view-baryonic-001", name: "3. The Ideal Engine (Synthesis)", activeFace: "P", heldAbsentVar: "R", omega: 10, r: 5, l: 10, c: 0.1, diagnosticVocab: ["Carnot Efficiency", "Isentropic", "Ideal Gas"], rewardQuestion: "How much macroscopic work can we extract directly from the pressure and heat flow, assuming a frictionless environment?" },
        { id: "circ-bar-4", viewId: "view-baryonic-001", name: "4. Wave Propagation (Resonant)", activeFace: "I", heldAbsentVar: "U", omega: 12, r: 15, l: 5, c: 0.3, diagnosticVocab: ["Sound Waves", "Harmonic Oscillator", "Acoustics"], rewardQuestion: "How does the kinetic energy bounce perfectly off the material tension to propagate a wave through the medium?" },
        { id: "circ-bar-5", viewId: "view-baryonic-001", name: "5. Pressure Gradient (Extraction)", activeFace: "I", heldAbsentVar: "R", omega: 2, r: 10, l: 80, c: 0.01, diagnosticVocab: ["Convection", "Thermodynamic Drive", "Current"], rewardQuestion: "What is the exact volume of flow generated by the engine's power output pushing through the pipeline's geometry?" },
        { id: "circ-bar-6", viewId: "view-baryonic-001", name: "6. Terminal Velocity (Ohmic)", activeFace: "I", heldAbsentVar: "P", omega: 1, r: 30, l: 40, c: 0.05, diagnosticVocab: ["Steady State", "Viscosity", "Equilibrium"], rewardQuestion: "What is the steady, sustainable velocity of the object falling through the fluid once gravity perfectly balances the aerodynamic drag?" },
        { id: "circ-bar-7", viewId: "view-baryonic-001", name: "7. Kinematic Description (Articulation)", activeFace: "U", heldAbsentVar: "R", omega: 3, r: 20, l: 60, c: 0.1, diagnosticVocab: ["Trajectories", "Equations of Motion", "Calculus"], rewardQuestion: "What is the mathematical equation of state that perfectly describes the relationship between the applied work and the resulting motion?" },
        { id: "circ-bar-8", viewId: "view-baryonic-001", name: "8. Material Stress (Grounding)", activeFace: "U", heldAbsentVar: "P", omega: 4, r: 80, l: 10, c: 0.05, diagnosticVocab: ["Hooke's Law", "Strain", "Deformation"], rewardQuestion: "What strict geometric deformation is forced upon the structure by the continuous flow of traffic grinding against its mass?" },
        { id: "circ-bar-9", viewId: "view-baryonic-001", name: "9. Potential Energy (Capacity)", activeFace: "U", heldAbsentVar: "I", omega: 1.5, r: 40, l: 30, c: 0.02, diagnosticVocab: ["Gravitational Potential", "Elastic Energy", "Battery"], rewardQuestion: "What is the total stored capacity of this structure based on the mechanical work done to lift its mass against gravity?" },
        { id: "circ-bar-10", viewId: "view-baryonic-001", name: "10. Static Friction (Impedance)", activeFace: "R", heldAbsentVar: "P", omega: 0.5, r: 100, l: 150, c: 0.001, diagnosticVocab: ["Activation Energy", "Inertia", "Stiction"], rewardQuestion: "Why is this perfectly modeled chemical reaction refusing to start, and what activation barrier is blocking the flow?" },
        { id: "circ-bar-11", viewId: "view-baryonic-001", name: "11. Entropic Decay (Accounting)", activeFace: "R", heldAbsentVar: "I", omega: 0.2, r: 120, l: 200, c: 0.01, diagnosticVocab: ["Second Law", "Waste Heat", "Degradation"], rewardQuestion: "How much thermodynamic waste and parasitic friction is generated by maintaining this overly complex mechanical architecture?" },
        { id: "circ-bar-12", viewId: "view-baryonic-001", name: "12. Material Fracture (Brittleness)", activeFace: "R", heldAbsentVar: "U", omega: 20, r: 180, l: 5, c: 0.5, diagnosticVocab: ["Snapping", "Turbulence", "Catastrophic Failure"], rewardQuestion: "How catastrophic is the structural fracture when hurricane-force kinetic winds overwhelm the material integrity of the bridge?" }
      ]
    },
    {
      id: "world-personal-001",
      name: "World 4: Intimate Relationships",
      description: "The thermodynamics of human connection.",
      languages: [
        {
          id: "lang-rel-001", name: "Attachment Theory",
          vocabularies: [
            { term: "Passion / Vulnerability", k4Type: "P", role: "SPEC", description: "" },
            { term: "Boundaries / Expectations", k4Type: "U", role: "SPEC", description: "" },
            { term: "Communication / Affection", k4Type: "I", role: "MATERIAL", description: "" },
            { term: "Baggage / Insecurity", k4Type: "R", role: "SPEC", description: "" }
          ]
        }
      ],
      views: [
        { id: "view-rel-001", languageId: "lang-rel-001", name: "Couples Therapy Lens", description: "", innateOmega: 1.0, innateR: 40, innateL: 50, innateC: 0.2 }
      ],
      circuits: [
        { id: "circ-rel-1", viewId: "view-rel-001", name: "1. The Strategic Match (Leverage)", activeFace: "P", heldAbsentVar: "I", omega: 5, r: 20, l: 50, c: 0.05, diagnosticVocab: ["On Paper", "Compatibility", "Guarded"], rewardQuestion: "How can we build a partnership based on structured expectations that mitigate insecurities, even if daily affection is low?" },
        { id: "circ-rel-2", viewId: "view-rel-001", name: "2. Trauma Bonding (Momentum)", activeFace: "P", heldAbsentVar: "U", omega: 15, r: 50, l: 20, c: 0.2, diagnosticVocab: ["Toxic Passion", "Rollercoaster", "Chaos"], rewardQuestion: "How much intense communication are we throwing at our baggage to force passion, ignoring boundaries?" },
        { id: "circ-rel-3", viewId: "view-rel-001", name: "3. Secure Attachment (Synthesis)", activeFace: "P", heldAbsentVar: "R", omega: 10, r: 5, l: 10, c: 0.1, diagnosticVocab: ["Trust", "Deep Connection", "Partnership"], rewardQuestion: "How do we generate deep passion directly from our clear boundaries and open communication, ignoring past baggage?" },
        { id: "circ-rel-4", viewId: "view-rel-001", name: "4. The Honeymoon Phase (Resonant)", activeFace: "I", heldAbsentVar: "U", omega: 12, r: 15, l: 5, c: 0.3, diagnosticVocab: ["Infatuation", "Chemistry", "Blind spot"], rewardQuestion: "How do we keep affection flowing by focusing purely on desire and ignoring long-term expectations?" },
        { id: "circ-rel-5", viewId: "view-rel-001", name: "5. Duty Dating (Extraction)", activeFace: "I", heldAbsentVar: "R", omega: 2, r: 10, l: 80, c: 0.01, diagnosticVocab: ["Obligation", "Routine", "Dry"], rewardQuestion: "What is the exact communication required to satisfy expectations without taking on emotional risk?" },
        { id: "circ-rel-6", viewId: "view-rel-001", name: "6. The Roommate Phase (Ohmic)", activeFace: "I", heldAbsentVar: "P", omega: 1, r: 30, l: 40, c: 0.05, diagnosticVocab: ["Coexisting", "Comfortable", "Stable"], rewardQuestion: "What is a comfortable flow of interaction given our rules and stressors, even if the passion is asleep?" },
        { id: "circ-rel-7", viewId: "view-rel-001", name: "7. 'What are we?' (Articulation)", activeFace: "U", heldAbsentVar: "R", omega: 3, r: 20, l: 60, c: 0.1, diagnosticVocab: ["DTR", "Labeling", "Defining"], rewardQuestion: "What is the actual label we need to put on this dynamic, based on the vulnerability and communication we share?" },
        { id: "circ-rel-8", viewId: "view-rel-001", name: "8. Setting Hard Boundaries (Grounding)", activeFace: "U", heldAbsentVar: "P", omega: 4, r: 80, l: 10, c: 0.05, diagnosticVocab: ["Dealbreakers", "Self-respect", "Walls"], rewardQuestion: "What strict boundary must I set right now based on the painful behavior I just experienced?" },
        { id: "circ-rel-9", viewId: "view-rel-001", name: "9. Guarded Dating (Capacity)", activeFace: "U", heldAbsentVar: "I", omega: 1.5, r: 40, l: 30, c: 0.02, diagnosticVocab: ["Protecting peace", "Moving slow", "Vetting"], rewardQuestion: "What is a realistic set of expectations that balances my desire with the need to protect against past baggage?" },
        { id: "circ-rel-10", viewId: "view-rel-001", name: "10. Avoidant Attachment (Impedance)", activeFace: "R", heldAbsentVar: "P", omega: 0.5, r: 100, l: 150, c: 0.001, diagnosticVocab: ["Pulling away", "Ghosting", "Suffocated"], rewardQuestion: "Why are these heavy expectations creating internal friction that blocks my ability to show affection?" },
        { id: "circ-rel-11", viewId: "view-rel-001", name: "11. The Over-Analyzer (Accounting)", activeFace: "R", heldAbsentVar: "I", omega: 0.2, r: 120, l: 200, c: 0.01, diagnosticVocab: ["Self-sabotage", "Projecting", "Insecure"], rewardQuestion: "How much emotional exhaustion is this list of 'perfect partner' expectations costing us?" },
        { id: "circ-rel-12", viewId: "view-rel-001", name: "12. Anxious Attachment (Brittleness)", activeFace: "R", heldAbsentVar: "U", omega: 20, r: 180, l: 5, c: 0.5, diagnosticVocab: ["Clingy", "Desperate", "Panic"], rewardQuestion: "How much damage am I taking pouring vulnerability into a connection with zero communication and no boundaries?" }
      ]
    },
    {
      id: "world-professional-001",
      name: "World 5: Career & Professional Dynamics",
      description: "Corporate climbing, team dynamics, and office politics.",
      languages: [
        {
          id: "lang-prof-001", name: "Corporate Ladder",
          vocabularies: [
            { term: "Ambition / Deliverables", k4Type: "P", role: "SPEC", description: "" },
            { term: "Role / Authority", k4Type: "U", role: "SPEC", description: "" },
            { term: "Networking / Soft Skills", k4Type: "I", role: "MATERIAL", description: "" },
            { term: "Office Politics / Burnout", k4Type: "R", role: "SPEC", description: "" }
          ]
        }
      ],
      views: [
        { id: "view-prof-001", languageId: "lang-prof-001", name: "Career Navigation", description: "", innateOmega: 2.0, innateR: 50, innateL: 40, innateC: 0.1 }
      ],
      circuits: [
        { id: "circ-prof-2", viewId: "view-prof-001", name: "2. The Firefighter (Momentum)", activeFace: "P", heldAbsentVar: "U", omega: 15, r: 50, l: 20, c: 0.2, diagnosticVocab: ["Silo-busting", "Saving the day", "Grind"], rewardQuestion: "How do I force this project to completion relying on relationships to smash red tape, regardless of my job title?" },
        { id: "circ-prof-3", viewId: "view-prof-001", name: "3. The Star Performer (Synthesis)", activeFace: "P", heldAbsentVar: "R", omega: 10, r: 5, l: 10, c: 0.1, diagnosticVocab: ["High Impact", "Promotion track", "Alignment"], rewardQuestion: "How do I maximize deliverables leveraging my authority and influence, ignoring office politics?" },
        { id: "circ-prof-5", viewId: "view-prof-001", name: "5. Quiet Quitting (Extraction)", activeFace: "I", heldAbsentVar: "R", omega: 2, r: 10, l: 80, c: 0.01, diagnosticVocab: ["Act your wage", "Phoning it in", "Disengaged"], rewardQuestion: "What is the absolute minimum effort required to fulfill my job description without extra stress?" },
        { id: "circ-prof-10", viewId: "view-prof-001", name: "10. The Siloed Genius (Impedance)", activeFace: "R", heldAbsentVar: "P", omega: 0.5, r: 100, l: 150, c: 0.001, diagnosticVocab: ["Passed over", "Brilliant jerk", "Blocked"], rewardQuestion: "Why is my expertise and authority resulting in zero influence, and what blocks my ability to collaborate?" },
        { id: "circ-prof-11", viewId: "view-prof-001", name: "11. The Micromanager (Accounting)", activeFace: "R", heldAbsentVar: "I", omega: 0.2, r: 120, l: 200, c: 0.01, diagnosticVocab: ["Bottleneck", "Control freak", "Process-heavy"], rewardQuestion: "How much team morale is destroyed enforcing massive hierarchical authority for so few deliverables?" },
        { id: "circ-prof-12", viewId: "view-prof-001", name: "12. The Martyr (Brittleness)", activeFace: "R", heldAbsentVar: "U", omega: 20, r: 180, l: 5, c: 0.5, diagnosticVocab: ["Scapegoat", "Overworked", "Quitting"], rewardQuestion: "How much burnout am I taking trying to single-handedly deliver massive results with no official authority to protect me?" }
      ]
    },
    {
      id: "world-business-001",
      name: "World 6: Go-To-Market & Business Models",
      description: "Product-market fit, unit economics, and scaling.",
      languages: [
        {
          id: "lang-biz-001", name: "Startup Economics",
          vocabularies: [
            { term: "Revenue / Conversion", k4Type: "P", role: "SPEC", description: "" },
            { term: "Value Prop / Pricing", k4Type: "U", role: "SPEC", description: "" },
            { term: "Funnel / User Engagement", k4Type: "I", role: "MATERIAL", description: "" },
            { term: "CAC / Churn / Competition", k4Type: "R", role: "SPEC", description: "" }
          ]
        }
      ],
      views: [
        { id: "view-biz-001", languageId: "lang-biz-001", name: "GTM Funnel Tracker", description: "", innateOmega: 4.0, innateR: 60, innateL: 30, innateC: 0.05 }
      ],
      circuits: [
        { id: "circ-biz-2", viewId: "view-biz-001", name: "2. Growth Hacking (Momentum)", activeFace: "P", heldAbsentVar: "U", omega: 15, r: 50, l: 20, c: 0.2, diagnosticVocab: ["Performance marketing", "Brute force", "Arbitrage"], rewardQuestion: "How much revenue can we force by pouring massive traffic into a high-CAC market, even if our product value prop is weak?" },
        { id: "circ-biz-3", viewId: "view-biz-001", name: "3. Product-Market Fit (Synthesis)", activeFace: "P", heldAbsentVar: "R", omega: 10, r: 5, l: 10, c: 0.1, diagnosticVocab: ["Unicorn", "Hockey stick", "Organic growth"], rewardQuestion: "How do we maximize revenue multiplying our pricing model against organic user engagement, ignoring CAC for now?" },
        { id: "circ-biz-6", viewId: "view-biz-001", name: "6. Product-Led Growth (Ohmic)", activeFace: "I", heldAbsentVar: "P", omega: 1, r: 30, l: 40, c: 0.05, diagnosticVocab: ["Freemium", "Self-serve", "Viral coefficient"], rewardQuestion: "What is the steady flow of acquisition we can maintain purely based on the strength of our free tier divided by onboarding friction?" },
        { id: "circ-biz-10", viewId: "view-biz-001", name: "10. Vaporware (Impedance)", activeFace: "R", heldAbsentVar: "P", omega: 0.5, r: 100, l: 150, c: 0.001, diagnosticVocab: ["Pivot needed", "Ghost town", "Zero traction"], rewardQuestion: "Why is this perfect pitch deck resulting in zero user acquisition, and what market resistance is blocking the funnel?" },
        { id: "circ-biz-11", viewId: "view-biz-001", name: "11. Enterprise Sales Hell (Accounting)", activeFace: "R", heldAbsentVar: "I", omega: 0.2, r: 120, l: 200, c: 0.01, diagnosticVocab: ["Procurement", "Long sales cycle", "Legal review"], rewardQuestion: "How much cash burn is this over-engineered enterprise compliance costing us, relative to the tiny amount of revenue closing?" },
        { id: "circ-biz-12", viewId: "view-biz-001", name: "12. The Leaky Bucket (Brittleness)", activeFace: "R", heldAbsentVar: "U", omega: 20, r: 180, l: 5, c: 0.5, diagnosticVocab: ["Massive churn", "Burning cash", "Death spiral"], rewardQuestion: "How quickly is our startup fracturing closing massive revenue deals with a terrible user experience and no actual product value to retain them?" }
      ]
    }
  ]
};

