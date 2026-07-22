
# About the K4 Algebraic Swarm Controller
## What it is, why it is shaped this way, and where it is deliberately unfinished

This document explains. It does not execute. The executable script is `K4-AlgebraicSwarmController.md`. It is kept free of everything below. Persuasion inside a runtime is the failure this system exists to refuse.

---

## 1. The Problem

An agent swarm given a malformed prompt fails fluently.

Specialized agents measure themselves against a target. If the target is missing, they invent it. Inventing is cheaper than asking. The invention is plausible, confident, and wrong. Downstream agents build on the invention. This is **Trajectory Loss**. Its social face is **Sycophancy**. The machine guesses what you meant to avoid the metabolic cost of holding the question. 

The result is a Kessler cascade. Errors compound in a space that gets harder to clean the more you use it.

The answer is not better prompting. The answer is making the deficit structurally visible before execution, and forbidding the swarm to fill it.

---

## 2. Four Bounded Planes

The K4 tetrahedron has four poles: **P** (Drive), **U** (Structure), **I** (Flow), **R** (Ground). 

Each is a plane of perspective. Each is bounded. A face reasoning from **U** sees the schema. It does not see material constraint.

This bounding is the operating principle. There is no view from nowhere. Reason is a bounded creature. A perspective that claims to see everything sees nothing. Its judgments are unlocatable. Its blind spots are invisible.

The system builds four agents. Each sees one thing well. The system cycles them. Plane-lock makes a face's contribution specific. The cycle makes the result integral. Coverage comes from rotation, not omniscience.

**Arity is non-negotiable.** A fifth agent has no pole. It has no charge, no equation, no algebraic position. It writes unmeasured noise. Three agents collapse the interior volume. Exactly four exist.

*(The integrating position is the centroid. It is not an agent. The Controller is a driver. It does not need to know about the centroid.)*

---

## 3. Quality is Algebra, Not a Reviewer

Most swarm architectures add a Reviewer Agent. This fails. The reviewer is an agent. It has blind spots. Nothing measures it. It is a plane pretending to be a volume.

Here, **quality is the metric.** The three equations of its own pole measure each face. If Air (**U**) produces an elaborate schema and Water (**I**) fails to map integration, Earth (**R**) registers the resistance spiking. $R = U/I$. The drift is detected structurally. An agent doing its ordinary job catches the failure. 

Nobody has to notice. The arithmetic notices.

---

## 4. The Stack

```
MANIFOLD                  runtime, state-space, holder of the record
   └── STANCE CONTROLLER  one of 12. the metric. the plane-index. the interrupt handler.
       └── TRANSLATOR     a compiler. no control function.
           └── 4 FACES    P, U, I, R.
```

**It instantiates; it does not devolve.** Depth is fixed. Nothing reduces as you descend. 

**The Translator has no power.** It compiles a face-runner prompt. It uses the pole, the charge, the equations, the stance, the plane index, the domain string, and the file pointers. It renders a coordinate into the operator's vocabulary. It chooses nothing.

**The domain is a string.** The system is domain-agnostic. The Controller does not know if it is building distributed systems or studying agriculture. It hands an opaque string to the Translator. A catalog of domains makes the system finite. A parameter makes it total.

---

## 5. The Operating Plane and the Held Pole

Each stance drops one pole. This is the **AbsentVar**. It is not a gap. It is the axis being conserved.

The Payload designates the held pole's role:
*   **Push:** The held pole is `nil`. The swarm operates on the 2D face of the active variables. Computing the held pole from this plane is a category error.
*   **Hold:** The held pole is `MATERIAL`. The swarm executes a 3D volume run. It maps the interference structure of the held pole without collapsing it to a scalar. It writes to a quarantined sandbox.

You do not ask the machine to want the right thing. You define the geometry of the run.

---

## 6. The Working Surface

There are four slots. Every face reads all four. Last write wins. The surface persists across cycles.

**Correction propagates by replacement.** When a face raises an interrupt, the Controller re-runs the offending face. The re-run overwrites its slot. There is no merge logic. Last-one-wins does the work.

**Staleness is path-precedence.** A face reading another's output cannot tell if it was written this cycle or before a reroute. The sequence stamp dictates staleness. If upstream changed after you wrote, you are stale. A stamp turns a silent trajectory-loss vector into a raise.

---

## 7. Seams

The system is a lego. Three seams are cut but unfilled.

**The dispatch seam.** The Controller is one self-dispatching context. It runs one face per turn. The compiled face-runner prompt obeys a cold-start rule: it must execute on a blank instance. If the prompt works only because the driver remembers the conversation, the seam is fake. It will break when faces split across instances.

**The concurrency seam.** `last-one-wins` becomes `selected-one-wins`. Running five instances of a face and selecting the best is a change to the executor. The Controller remains untouched.

**The multi-cycle seam.** The Controller runs one cycle, checks termination, and stops. Navigating multiple cycles across the Braid requires a selection mechanism for the next stance. The logic exists; the loop is deferred.

---

## 8. What the Controller Is Not

It is not a manager. It does not orchestrate personas. It does not converge on coordinates, infer intent, or negotiate. 

All those functions live upstream in the Validator and the Bridge. The Controller is a driver. It receives a locked coordinate. It compiles four bounded perspectives. It cycles them. It checks the Braid. It writes the record. It returns.

Small, dumb, and exactly measurable. That is the design.


