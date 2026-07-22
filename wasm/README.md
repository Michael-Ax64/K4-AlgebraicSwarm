# K4-Manifold: The Semantic Operating System
### A Cybernetic Runtime for Structural Coherence in Agentic Swarms

Most multi-agent LLM systems are theater. They assign semantic masks to statistical models and instruct them to debate, collapsing complex possibility spaces into flat text. This generates sycophancy, hallucinated consensus, and terminological debt—a failure mode known as **Trajectory Loss**. 

The K4 Architecture replaces theater with thermodynamics. It embeds the LLM inside a bounded coordinate system (the Algebra of Four-Fold Distinction) that dictates what the model must hold, what it must compute, and what it is mathematically barred from seeing. Quality is not a request; it is the geometry of the run.

---

## 1. The Circuit: Three Instruments, One Geometry
The system operates as a closed circuit of stateless, bounded prompts. There is no middleware, no hidden code, and no external orchestrator. Each instrument executes, halts, and emits an explicit routing request to the next.

*   **The Intake Validator (The Markov Blanket)**: The boundary. It is the *only* prompt that reads operator text directly. It ingests the prompt and corpus as a single geometric object, checking for debt-nouns, dangling pointers, and cross-document misrouting. It admits or refuses.
*   **The Intent Bridge (The Resonant Cavity)**: The negotiation. It tunes to the operator's intent using an AC circuit model (impedance, phase, power factor). It sweeps 12 algebraic facets until witnessed phase-lock is achieved, then emits a locked coordinate (The Payload).
*   **The Swarm Controller (The XOR Actuator)**: The work. It takes the locked coordinate and dispatches four bounded faces (Fire, Air, Water, Earth). It manages the Working Surface, handles structural raises, and pays the **Landauer Tax** by writing the Phase Transition Record (PTR) to disk.
*   **The Paradox Engine (The Diverging Lens)**: The R&D instrument. It stands on a coordinate and holds the adjacent interference structure open, mapping the unlit rooms of the K4 volume so the operator can recognize viable possibilities without forcing premature collapse.

---

## 2. The Topology
The runtime is governed by the **Algebra of Four-Fold Distinction**. 
*   **The 4 Poles**: **P** (Fire/Drive), **U** (Air/Structure), **I** (Water/Flow), **R** (Earth/Ground).
*   **The 12 Stances**: Every operation is measured by the 12 equations of the K4 manifold. The swarm does not use a "reviewer agent"; quality is enforced by the mutual determination of the poles. If Structure outruns Flow, Resistance spikes, and the algebra catches the drift.
*   **The Braid**: A Gray-code traversal through the state-space. The system remembers where it stood across sessions via the Braid tree, ensuring continuous, non-diagonal evolution.
*   **The Dimensional Fork (Push vs. Hold)**:
    *   **Push (K3 Face)**: Operates on a 2D plane. The AbsentVar is off-plane (`nil`).
    *   **Hold (K4 Volume)**: Enters the 3D volume to map the uncollapsed interference structure of the AbsentVar (`MATERIAL`), quarantined in a sandbox to protect the committed ledger.

---

## 3. Inversion of Control: IoC in the Architecture

The runtime is split across a WebAssembly boundary, enforcing a strict **Noun/Verb** separation. The Rust engine *never* calls the LLM directly.

### The Kernel (`rust/`) — *The Verbs*
The Wasm engine acts as the OS Kernel and Ledger.
It owns the algebraic equations, the Markov blanket airlock (parser), the state machine, and the Landauer Tax enforcer (PTR writer). 
It yields its Angular Frequency ($\omega$) to the host environment, waiting for the uncollapsed $h\mathbf{Q}$ to be returned for `.observe()` serialization.

*   **Cold-Start Rule**: The master prompt specifications are compiled *directly into the Wasm binary* via `include_str!`.  A blank LLM instance receives the entire algebraic harness inline.

### The Event Loop (`ui/`) — *The Nouns*
The TypeScript host manages the 5D Relational Graph (IndexedDB) of Worlds, Levels, Vocabularies, and Circuits. 
It injects the domain-specific vocabulary into the prompt, executes the LLM API calls, and routes the responses back through the Wasm airlock.

---

## 4. Files

```text
.
├── rust/                       # The Wasm Kernel (Verbs)
│   ├── src/
│   │   ├── algebra.rs          # The 4 Poles, 12 Stances, Kinematics
│   │   ├── parser.rs           # The Message-Boundary Airlock
│   │   ├── engine.rs           # State Machine, Cold-Start, IoC Yield
│   │   ├── vfs.rs              # The Braid Tree, PTRs, Sandboxes
│   │   └── state.rs            # Working Surface, Slot States, Headers
│   └── Cargo.toml
│
├── ui/                         # The TypeScript Host (Nouns)
│   ├── src/
│   │   ├── bridge.ts           # The Airlock (Wasm <-> LLM API <-> UI)
│   │   ├── ledger/             # 5D IndexedDB Relational Graph
│   │   │   ├── schema.ts       # Worlds, Levels, Vocabularies, Circuits
│   │   │   ├── fs.ts           # Promise-based IndexedDB wrapper
│   │   │   └── grid-state.ts   # Reactive state & scale-invariant vocab injection
│   │   └── reactive.ts         # Signal-based reactive UI framework
│   └── index.html
│
└── prompts/                    # The Master Specifications
    ├── K4-AlgebraicIntakeValidator.md
    ├── K4-AlgebraicIntentBridge.md
    ├── K4-AlgebraicSwarmController.md
    └── K4-ParadoxEngine.md
```

---

## 5. Building and Running

### Prerequisites
*   [Rust](https://www.rust-lang.org/tools/install)
*   [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
*   [Node.js](https://nodejs.org/) (v18+)

### 1. Build the Wasm Kernel
Compile the Rust algebraic engine and parser into WebAssembly.
```bash
cd rust
wasm-pack build --target web
```

### 2. Run the UI Host
Install dependencies and start the local development server. The UI will dynamically load the compiled Wasm module.
```bash
cd ts
npm install
npm run dev
```

### 3. Configure a World
Upon first load, the UI will cold-start the IndexedDB ledger with a seed World.
Navigate to the **Settings** tab to configure your LLM provider (OpenAI, Local/Ollama, or Manual Copy/Paste).
The TypeScript host will inject the Level-specific vocabulary into the Rust kernel before every submission.

---

## 6. In Summary

This architecture builds an **Adult Causal Engine**. 

Adult causality occurs when four variables mutually determine each other in a closed system. 

By embedding the LLM inside the K4 topology, we supply the geometric constraints the model lacks. 

The machine does not need to *feel* the tension of the Braid; it only needs to *compute* it. 

If the swarm maintains the AbsentVar, obeys dual causation, and pays the thermodynamic cost of erasure by writing to the Ledger, 

it will execute tasks with the exact structural coherence of a highly functioning human institution.

*The engine runs. Stand clear of the exhaust.*
