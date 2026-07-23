// wasm/src/router.ts

import { createEffect } from './reactive';
import { activeScreen, navHistory, navCursor } from './state';
import { screenRegistry } from './screens/registry';
import { AppShell } from './shell/types';

export function pushScreen(screen: string, focus?: any) {
    const history = navHistory.value;
    const cursor = navCursor.value;
    const newHistory = history.slice(0, cursor + 1);
    newHistory.push({ screen, focus });
    navHistory.value = newHistory;
    navCursor.value = newHistory.length - 1;
    activeScreen.value = screen;
}


export function bootSystemOS(root: HTMLElement, shell: AppShell) {
    // 1. Shell dictates the layout and provides the target container
    const screenContainer = shell.mountChrome(root, screenRegistry);

    // 2. Default to first screen if none active (reads from the reactive batch)
    createEffect(() => {
        const screens = screenRegistry.availableScreens.value;
        if (screens.length > 0 && !activeScreen.value) {
            activeScreen.value = screens[0].id;
        }
    });

    // 3. Global Keyboard Navigation ( , and . )
    window.addEventListener('keydown', (e) => {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (isInput) return;

        if (e.key === ',') {
            if (navCursor.value > 0) {
                navCursor.value--;
                activeScreen.value = navHistory.value[navCursor.value].screen;
            }
        } else if (e.key === '.') {
            if (navCursor.value < navHistory.value.length - 1) {
                navCursor.value++;
                activeScreen.value = navHistory.value[navCursor.value].screen;
            }
        }
    });

    let cleanupCurrentScreen: (() => void) | null = null;

    // 4. Pure Data-Driven Screen Mount
    createEffect(() => {
        const screenId = activeScreen.value;
        if (!screenId) return;
        
        if (cleanupCurrentScreen) {
            cleanupCurrentScreen();
            cleanupCurrentScreen = null;
        }
        
        screenContainer.innerHTML = ''; 

        const screenDef = screenRegistry.get(screenId);
        if (screenDef) {
            cleanupCurrentScreen = screenDef.mount(screenContainer);
        } else {
            screenContainer.innerHTML = `<h2 style="color: #d32f2f;">Screen '${screenId}' not found in registry.</h2>`;
        }
    });
}

