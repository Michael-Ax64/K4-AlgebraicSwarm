# The TypeScript Host: Event Loop, Relational Flow, and the 5D Ledger
### A Deep Dive into the `ui/` Architecture

If the Rust Wasm kernel is the **Algebraic Engine** (the Verbs, the rigid geometry, the Landauer Tax enforcer), the TypeScript frontend is the **Relational Flow** (the Nouns, the Event Loop, the thermodynamic environment). 

The frontend is not merely a display layer; it is an active participant in the K4 topology. It manages the 5D Relational Graph, injects domain-specific vocabulary into the prompt, executes the actual LLM API calls, and physically models the AC circuit parameters of the Intent Bridge.

Here is the in-depth architectural study of the `ui/` directory.

---

## 1. The Inversion of Control (IoC) Boundary
The most critical architectural decision in the frontend is the **Inversion of Control** pattern implemented in `bridge.ts`. 

The Rust engine (`k4-manifold.wasm`) is trapped in a sandbox. It cannot make network requests, it cannot read the DOM, and it cannot hold the uncollapsed state of the LLM's response. Therefore, the Rust engine acts as a **synchronous state machine** that yields control back to TypeScript at every boundary.

### The Airlock (`bridge.ts`)
The `runEngineLoop` function is the heartbeat of the system. It processes `JsCommand` objects emitted by the Rust kernel:
*   **`FetchLLM`**: The Rust engine has compiled a prompt. The TS host takes this prompt, calls the configured LLM API (OpenAI, local, or manual copy/paste), and feeds the response back into `engine.step()`.
*   **`AwaitUser`**: The Rust engine has reached a structural pause (e.g., the Bridge is waiting for a "Ring/Clang" on a facet, or the Paradox Engine is presenting Held Paradoxes). The TS host updates the UI state and waits for DOM input.
*   **`Halt` / `Success`**: The run has terminated. The TS host updates the UI and stops the loop.

### The Noun/Verb Split & Vocabulary Injection
The Rust engine knows the *equations* (Verbs), but it does not know the *domain* (Nouns). Before handing the operator's `Document 0` to the Rust engine, `bridge.ts` intercepts it:
```typescript
const levelVocabulary = getActiveVocabContext();
const enrichedDoc0 = `
[CONTEXTUAL DICTIONARY - LEVEL SPECIFIC]
${levelVocabulary}
[OPERATOR INTENT]
${doc0Text}
`.trim();
```
This is **Scale Invariance** in action. The exact same Rust binary can run a macroeconomic simulation or a psychological evaluation simply because the TS host injects a different dictionary from the IndexedDB ledger before the `step_submission` call.

### The Integrity Stub (`engine-stub.ts`)
To prevent the UI from crashing during frontend-only development (or if the Wasm binary fails to compile), `bridge.ts` dynamically imports an `engine-stub`. The stub implements the exact same Wasm interface (`current_role`, `vfs_state`, `step`) but immediately returns a `Halt` command. This allows the UI to be tested and styled without requiring the Rust toolchain.

---

## 2. The 5D Relational Graph (The Ledger)
The flat JSON VFS of early iterations was destroyed and replaced with a robust, relational graph database hosted in the browser via IndexedDB (`ledger/fs.ts`). This is the persistent memory substrate of the Semantic OS.

### The Schema (`ledger/schema.ts`)
The database is structured hierarchically to support scale-invariant ontologies:
1.  **Worlds**: The top-level container (e.g., "Software Engineering"). Holds the API configuration (Provider, Key, Base URL).
2.  **Levels**: Scale layers within a World (e.g., "L0: Individual Contributor", "L1: Organization").
3.  **Vocabularies**: The domain nouns. Each term is mapped to a `K4Type` (Pole or Edge, e.g., `P`, `U`, `P-U`) and an `ElementRole` (`SPEC`, `MATERIAL`, `NIL`).
4.  **Circuits**: The AC circuit parameters for the Bridge's resonant cavity at this specific level.
5.  **Ledger Entries**: The persisted Phase Transition Records (PTRs) written by the Rust engine.

### State Management (`ledger/grid-state.ts`)
The ledger uses a cascading reactive pattern. Selecting a `World` triggers a fetch for its `Levels`. Selecting a `Level` triggers parallel fetches for its `Vocabularies`, `Circuits`, and `Ledger Entries`. This ensures the UI only ever holds the active slice of the ontology in memory.

---

## 3. The AC Circuit Modeler (The Physical Substrate)
The most visually and conceptually striking feature of the frontend is the **Circuit Workbench** (`ledger-ui.ts`). The Intent Bridge is modeled as an AC resonant cavity, and the UI allows the operator to physically tune its thermodynamic parameters using sliders.

When the operator adjusts the sliders, the `calcAC()` function runs real-time physics calculations:
*   **Inputs**: Driving Frequency ($\omega$), Resistance ($R$ - Ground/Friction), Inductance ($L$ - Memory/Momentum), Capacitance ($C$ - Tension/Anticipation).
*   **Outputs**: 
    *   **Reactance ($X$)**: $X_L - X_C$ (The torsional shear between memory and anticipation).
    *   **Impedance ($|Z|$)**: $\sqrt{R^2 + X^2}$ (Total opposition to flow).
    *   **Phase Angle ($\theta$)**: $\arctan(X/R)$ (The gap between the Bridge's drive and the operator's response).
    *   **Power Factor ($\cos \theta$)**: The ratio of real work to apparent power. (Target: 0.5 to 0.9).
    *   **Resonant Frequency ($\omega_0$)**: $1/\sqrt{LC}$ (The operator's natural frequency).
    *   **Quality Factor ($Q$)**: The sharpness of the resonance peak.

The UI provides immediate diagnostic feedback based on the math:
*   *If $\theta \approx 0$*: **RESONANCE ACHIEVED.** Markov Blanket is transparent.
*   *If $\theta > 5^\circ$*: **TORSIONAL SHEAR (Lagging).** Dominated by Inductive Memory.
*   *If $\theta < -5^\circ$*: **TORSIONAL SHEAR (Leading).** Paralyzed by Capacitive Anticipation.

This transforms the Bridge from an abstract text negotiation into a tangible, tunable physical instrument.

---

## 4. Zero-Dependency Reactivity & UI Rendering
The frontend avoids heavy frameworks (React, Vue) in favor of a custom, zero-dependency reactive core (`reactive.ts`). 

### The Signal Engine
```typescript
export class Signal<T> {
    // ... dependency tracking via activeEffect ...
}
export function createEffect(fn: () => void) { ... }
```
This is a minimal implementation of fine-grained reactivity. When a `Signal`'s value is read inside a `createEffect`, the effect automatically subscribes to it. When the value changes, only the specific DOM nodes tied to that effect are updated. This keeps the runtime footprint microscopic, ensuring the UI never interferes with the Wasm engine's execution.

### Visualizing the K4 Topology (`ui.ts`)
The UI renders the internal state of the Rust engine in real-time, translating the algebraic state into visual feedback:
*   **The Role Badge**: A dynamic topbar indicator that changes color and text based on `currentRole` (Validator/Slate, Bridge/Teal, Controller/Green, Paradox/Amber) and `currentMode` (cold, thinking, awaiting reply).
*   **The Working Surface**: A 4-quadrant grid representing the P, U, I, R poles. Each slot displays its content and its `SlotState` (Unwritten, Prior, Current, Stale). If a slot goes `Stale` (due to path-precedence staleness in the Rust engine), the UI visually flags it.
*   **The Braid History**: A timeline of `PtrSummary` objects. It visualizes the Gray-code traversal through the state-space, showing the cycle, stance, path traversed, and health (clear, raises, halted) of every committed Phase Transition Record.
*   **Context-Aware Placeholders**: The input field changes its prompt based on the active instrument. If the Paradox Engine is active, it asks: *"Which of these is bearing weight?"* If the Bridge is active, it asks: *"Reply to the Bridge's articulation..."*

---

## 5. Cold-Start & The Seed Ontology
When the application is loaded for the first time, `seed.ts` detects an empty IndexedDB and triggers a cold-start using `seed-data.ts`. 

It injects a fully formed **Software Engineering (DevOps)** ontology to demonstrate scale invariance:
*   **L0: Individual Contributor**: Maps "Feature Ticket" to `P` (Drive), "Pull Request" to `I` (Flow), "Design Patterns" to `U` (Structure), and "Technical Debt" to `R` (Ground). The circuit is tuned for fast daily pacing ($\omega=10$) with high legacy momentum ($L=50$).
*   **L1: Organization**: Maps "Market Deadline" to `P`, "Cross-Team Comms" to `I`, "Org Chart" to `U`, and "Payroll" to `R`. The circuit is tuned for slow macro-pacing ($\omega=0.5$) with immense institutional inertia ($L=200$).

This proves that the Rust engine doesn't need to be rewritten to change domains; the TS host simply swaps the Level, and the vocabulary injection handles the rest.

---

## Summary of the Frontend Architecture
The `ui/` directory is not a wrapper; it is the **thermodynamic environment** of the K4 system. 
1. It enforces the **Noun/Verb split** by injecting domain vocabulary into the Rust kernel.
2. It executes the **Inversion of Control** loop, handling the network I/O that Wasm cannot perform.
3. It provides a **physical substrate** (the AC Circuit Modeler) to tune the Bridge's resonant cavity.
4. It visualizes the **algebraic state** (Working Surface, Braid, Role Badges) so the operator can see the geometry of the run.

The Rust engine computes the topology. The TypeScript host provides the space in which that topology can breathe, interact, and do work.
