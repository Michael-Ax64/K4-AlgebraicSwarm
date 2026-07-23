// wasm/src/screens/registry.ts

import { Signal } from '../reactive';

export interface ScreenDef {
    id: string;
    label: string;
    order: number;
    mount: (container: HTMLElement) => () => void;
}

class ScreenRegistry {
    private screens = new Map<string, ScreenDef>();
    
    // The reactive signal the Shell watches to draw the tabs
    public availableScreens = new Signal<ScreenDef[]>([]);

    beginUpdates() {
        // Prepare for a batch of registrations.
    }

    register(def: ScreenDef) {
        // Purely stores data. NEVER triggers UI updates or actions.
        this.screens.set(def.id, def);
    }

    endUpdates() {
        // Atomically commit the sorted screens to the reactive signal.
        this.availableScreens.value = Array.from(this.screens.values()).sort((a, b) => a.order - b.order);
    }

    get(id: string): ScreenDef | undefined {
        return this.screens.get(id);
    }
}

export const screenRegistry = new ScreenRegistry();
