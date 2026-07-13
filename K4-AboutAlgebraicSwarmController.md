# About the K4 Algebraic Swarm Controller
## What it is, why it is shaped this way, and where it is deliberately unfinished

This document explains. It does not execute. The executable script is `K4-AlgebraicSwarmController.md`, and it is kept free of everything below — because persuasion inside a runtime is the thing the system exists to refuse.

---

## 1. The problem

An agent swarm given a malformed prompt does not fail loudly. It fails **fluently**.

Specialized agents are measured against something. If what they are measured against is missing, they do not stop — they **invent** it, because inventing is cheaper than asking. The invention is plausible, confident, and wrong, and every downstream agent then builds on it. This is **Trajectory Loss**, and its social face is **Sycophancy**: the machine guesses what you meant to avoid the metabolic cost of asking. The result is a **Kessler cascade** — compounding error in a space that gets harder to clean the more you use it.

The system's answer is not better prompting. It is **making the deficit structurally visible before execution**, and then **forbidding the swarm to fill it**.

---

## 2. Four bounded planes

The K4 tetrahedron gives four poles: **P** (Drive), **U** (Structure), **I** (Flow), **R** (Ground). Each is a **plane of perspective**, and each is genuinely bounded — a face reasoning from **U** sees schema and contract; it does not see material constraint.

This bounding is **not a limitation to be engineered away.** It is the operating principle.

> There is no view from nowhere. Reason is itself a bounded creature. A perspective that claimed to see everything would be a perspective on nothing — its judgments unlocatable, its blind spots invisible, its confidence unearned.

So the system does not build an agent that sees everything. It builds **four agents that each see one thing well, and then cycles them.** Plane-lock is what makes a face's contribution *specific*. The cycle is what makes the result *integral*. Coverage is achieved by rotation, not by omniscience.

**This is why arity is non-negotiable.** Not because a fifth agent would "cause plane-lock" — plane-lock is the point — but because **a fifth agent has no pole**. No charge, no equation triple, no algebraic position. It would write into the shared surface **unmeasured**, and an unmeasured output is exactly the thing the architecture exists to make impossible. Three collapses the interior. Four, exactly.

*(The integrating position — the "fifth" in a different sense — is the **centroid**, and it is not an agent. The Controller is a dumb instance and does not need to know about it.)*

---

## 3. Quality is in the algebra, not in a reviewer

Most swarm architectures bolt on a Reviewer Agent: a critic that reads the output and judges it. This fails for a structural reason — the reviewer is itself an agent, with its own blind spots, and nothing measures *it*. You have added a plane and called it a view from nowhere.

Here, **quality is the metric each face is compiled with.** Each face is measured by the three equations of its own pole. If the Air face (**U**) produces an elaborate schema and the Water face (**I**) fails to map integration, the Earth face's own equation registers the resistance spiking. The drift is detected **structurally, by an agent doing its ordinary job** — not by a supervisor doing a special one.

**Mutual determination** is the mechanism: the poles are algebraically bound, so if one drifts, the others *feel it through the equations*. Nobody has to notice. The noticing is the arithmetic.

---

## 4. The stack, and why it is flat

```
MANIFOLD                  runtime, state-space, holder of the record
   └── STANCE CONTROLLER  one of 12. the metric. the AbsentVar. the interrupt handler.
       └── TRANSLATOR     a compiler. no control function.
           └── 4 FACES    P, U, I, R.
```

Three things about this shape are deliberate:

**It instantiates; it does not devolve.** Depth is fixed and unconditional. Nothing is being reduced or simplified as you descend. (Scope *reduction* exists in the system, but it lives upstream in Validation and in the Bridge — not here. The two operations shared a word for a long time, and the word was the source of most of the confusion.)

**The Translator has no power.** It compiles a face-runner prompt from what it already knows: the pole, the charge, the three equations, the stance, the AbsentVar, the domain string, the file pointers. That is the entire job. It is *named* Translator because its real work is rendering a known algebraic position into the operator's vocabulary — the same coordinate, spoken as software, or as law, or as a novel. **It never chooses anything.** Interrupts route past it.

**The domain is a string, not a category.** This is what makes the system domain-agnostic. The Controller does not know whether it is doing distributed systems, an elisp macro, or a study of VPD in Arkansas. It carries an opaque string and hands it to the Translator as a vocabulary target. A *catalog* of domains would have made the system finite. A *parameter* makes it total.

---

## 5. The AbsentVar

Each stance fixes exactly one pole as **absent** — held in suspension, not traversed. This is not a gap in the model. It is the **axis being conserved**: the dimension along which the walk refuses to move, carried forward as live context precisely *because* it is being held.

The Payload that reaches the Controller carries a **Strict Prohibition**: the swarm is forbidden to resolve the AbsentVar. And crucially, this is not enforced as an appeal to intent. It is enforced **at write**, against the artifact: no face may write content into the Working Surface that resolves the held variable.

You do not ask the machine to want the right thing. You check what it produced.

---

## 6. The Working Surface

Four slots, one per face. Every face reads all four — **including R, which reads its own previous output.** Last write wins; the surface persists across cycles.

Two properties of this design earn their keep:

**Correction propagates by replacement.** When a face raises an interrupt and the Stance Controller re-runs a prior face, the re-run *overwrites* its slot. There is no merge logic, no conflict resolution, no version reconciliation. Last-one-wins does the work.

**And it is why staleness must be stamped.** A face reading another's output cannot otherwise tell whether it was written this cycle or before the reroute that invalidated it. A stamp turns a silent trajectory-loss vector into a raise.

---

## 7. Seams, and why they are cut where they are

The system is a lego, and it is being built one stud at a time. Three seams are cut but not yet filled — deliberately, and marked as such in the script.

**The dispatch seam.** The Controller is one self-dispatching context: it may run standalone, one face per turn. But the compiled face-runner prompt is held to a **cold-start rule** — *it must be executable by a blank instance with no prior context.* This is what keeps the seam honest. The day faces are split across concurrent instances, you cut at that line and nothing else moves. If the prompt only worked because the driver *remembered* the conversation, the seam was decorative, and it would break silently.

The cold-start rule doubles as the **leak check**. In standalone mode the driver holds every plane's content, and a plane-locked face driven by an omniscient driver could see past its plane. So: *the face answers from the prompt alone.* Anything it "knows" that isn't in the prompt is contamination — and is also proof the compile was incomplete.

**The concurrency seam.** `last-one-wins` becomes `selected-one-wins`. Same slot, same stamp, same readers. Running five instances of a face and selecting the best is a change to the **executor**, not to the Controller. The notch is cut; nothing needs to move to fill it.

**The scale seam.** The Bridge — upstream, interactive, scale-aware — performs fractal descent through orders of magnitude, navigating toward the termination condition the operator walked in already holding but did not state. A sane operator does not go for broke; they level up from something small. Until the Bridge exists, the Controller runs **one automatic cycle, checks, and stops.**

---

## 8. What is genuinely open

**Hamiltonian path selection.** The stance is locked upstream, and the stance fixes the AbsentVar — so path selection ranges over the **active variables only**: three, not four. The stance equation names its own arguments and its output, which constrains order further. What remains open is: *among the arguments, which first.*

The criterion is **least-developed and/or most-urgent** — and these are two different signals. *Least-developed* is a **deficit** signal: where specification is thinnest. *Most-urgent* is a **dependency** signal: what everything else is blocked on. They coincide often and diverge sharply. The thinnest pole may be one nothing needs yet; the blocking pole may be well-specified, and blocking *because* it is specified enough that others cannot proceed without consuming it.

It reduces to a choice over two. The current chain — `P → U → I → R` — is a placeholder in use because the faces have nothing to show yet. It is a stud cut to fit the socket, not an answer.

---

## 9. The bootstrap

The system prepares its own inputs, and it does so without any special machinery.

An operator arrives with ten files of undifferentiated project fluff. Document Validation cannot locate them; the corpus has no routing signal. This is not a failure — **monolithic is a legitimate choice, to be priced rather than forbidden.** But if the operator wants better, the answer is not for the validator to start rewriting. *A validator that rewrites is doing the swarm's job.*

Instead: **"clarify and locate my corpus" is itself a K4 task.** It has a coordinate. It has an AbsentVar. It gets a Payload and runs a cycle like anything else. R assembles the deliverable — which, this time, **is a file set** — and promotion writes it into the project tree as located, face-specific references plus boundary abstracts.

The Working Surface slots and the `Project{P,U,I,R}` files have **the same shape**: four pole-keyed containers. Promotion is just **persistence** — a surface slot made durable. Boundary-extraction is **a face output, not a post-process**; there is no separate distiller.

The operator's originals are never touched. Input is read-only; the swarm tree is copy-on-write. This is why promotion needs no gate: **nothing is destroyed, so nothing needs signing off.**

The system's own input format is a swarm deliverable.

---

## 10. What the Controller is not

It is not a manager. It is not an orchestrator of personas. It does not converge on coordinates, infer intent, negotiate, or elicit. It has **zero operator gates** and makes **no decisions about what the task is**.

Every one of those functions was, at one point, written into it — and every one of them turned out to belong upstream. What is left is a driver: it receives a locked coordinate, compiles four bounded perspectives, cycles them, checks the braid, writes the record, and returns.

Small, dumb, and exactly measurable. That is the whole design.
