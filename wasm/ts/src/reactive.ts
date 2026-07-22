// wasm/ts/src/reactive.ts

let activeEffect: (() => void) | null = null;

// Track which Signal subscriber sets this effect currently belongs to
const effectDependencies = new WeakMap<() => void, Set<Set<() => void>>>();
const pendingEffects = new Set<() => void>();
let flushScheduled = false;

function flushEffects() {
  const effects = Array.from(pendingEffects);
  pendingEffects.clear();
  flushScheduled = false;
  for (const effect of effects) {
    effect();
  }
}

export class Signal<T> {
  private _value: T;
  public subscribers = new Set<() => void>();

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get value(): T {
    if (activeEffect) {
      this.subscribers.add(activeEffect);
      
      // Track this subscription so the effect can clean it up later
      let deps = effectDependencies.get(activeEffect);
      if (!deps) {
        deps = new Set();
        effectDependencies.set(activeEffect, deps);
      }
      deps.add(this.subscribers);
    }
    return this._value;
  }

  set value(newValue: T) {
    if (!Object.is(this._value, newValue)) {
      this._value = newValue;
      this.trigger();
    }
  }

  private trigger() {
    for (const sub of this.subscribers) {
      pendingEffects.add(sub);
    }
    // Batch UI updates in a microtask to prevent render thrashing
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(flushEffects);
    }
  }
}

export function createEffect(fn: () => void): void {
  const run = () => {
    // Eager Unsubscription: Clear old dependencies before re-running
    // This prevents memory leaks on dormant branch logic (e.g., hidden tabs)
    const deps = effectDependencies.get(run);
    if (deps) {
      for (const subSet of deps) {
        subSet.delete(run);
      }
      deps.clear();
    }

    const previous = activeEffect;
    activeEffect = run;
    try {
      fn();
    } finally {
      activeEffect = previous;
    }
  };
  run();
}
