// wasm/src/shell/types.ts

import { ScreenRegistry } from '../screens/registry';

export interface AppShell {
    /** 
     * Mounts the application chrome (menus, perspective toggles) to the root.
     * Returns the inner container where the Router should mount the active Screen.
     */
    mountChrome: (root: HTMLElement, registry: any) => HTMLElement;
    
    /**
     * Optional: The Shell's own teardown/cleanup logic.
     */
    unmount?: () => void;
}
