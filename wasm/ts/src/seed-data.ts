// wasm/ui/src/ledger/seed-data.ts
import { K4Type, ElementRole } from './schema';

export const defaultSeedData = {
  worlds: [
    {
      id: "world-devops-001",
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
    }
  ]
};
