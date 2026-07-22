// src/reactive.ts

// The global tracker. When an effect runs, it sets itself as the active target.
let activeEffect: (() => void) | null = null;

export class Signal<T> {
  private _value: T;
  private subscribers = new Set<() => void>();

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get value(): T {
    // Dependency tracking: if an effect is running, subscribe it to this signal
    if (activeEffect) {
      this.subscribers.add(activeEffect);
    }
    return this._value;
  }

  set value(newValue: T) {
    // Only trigger if the value actually changed (prevents infinite loops)
    if (!Object.is(this._value, newValue)) {
      this._value = newValue;
      this.trigger();
    }
  }

  private trigger() {
    // Notify all effects that depend on this signal
    for (const sub of this.subscribers) {
      sub();
    }
  }
}

// Creates an effect that automatically tracks any signals read inside it
export function createEffect(fn: () => void) {
  activeEffect = fn;
  fn(); // Run immediately to collect initial dependencies
  activeEffect = null;
}

