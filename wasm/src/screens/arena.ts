// wasm/src/screens/arena.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { selectedLevelId } from '../ledger/grid-state';
import { Whole } from '../arena/whole';
import { arenaCache, currentArenaPath, activeWhole, getArenaPathKey } from './arena-state';


export function mountArenaScreen(container: HTMLElement): () => void {
    const layout = document.createElement('div');
    layout.style.display = 'flex';
    layout.style.flexDirection = 'column';
    layout.style.height = '100%';
    
    layout.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px; flex: 0 0 auto;">
            <h2 style="margin: 0; color: #14161A;">Arena</h2>
        </div>
        <div id="arena-content" style="flex: 1; overflow-y: auto; background: #fff; border: 1px solid #DAD5CB; border-radius: 4px; padding: 15px; display: flex; flex-direction: column; min-height: 0;"></div>
    `;
    
    container.appendChild(layout);
    const contentContainer = layout.querySelector('#arena-content') as HTMLElement;

    createEffect(() => {
        const lId = selectedLevelId.value;
        if (!lId) {
            activeWhole.value = null;
            return;
        }

        const path = [{ levelId: lId }];
        const cacheKey = getArenaPathKey(path);
        
        let whole = arenaCache.get(cacheKey);
        if (!whole) {
            whole = new Whole({
                id: cacheKey,
                name: `Arena: ${lId}`,
                levelId: lId
            });
            arenaCache.set(cacheKey, whole);
        }
        
        currentArenaPath.value = path;
        activeWhole.value = whole;
    });

    let cleanupWhole: (() => void) | null = null;

    createEffect(() => {
        const whole = activeWhole.value;
        
        if (cleanupWhole) {
            cleanupWhole();
            cleanupWhole = null;
        }
        
        contentContainer.innerHTML = '';
        
        if (whole) {
            // Remove padding to give the Arena grid its max bounds
            contentContainer.style.padding = '0';
            cleanupWhole = whole.mount(contentContainer);
        } else {
            // Restore padding for the empty state
            contentContainer.style.padding = '15px';
            contentContainer.innerHTML = '<div style="color: #888; font-style: italic;">Select a Level to initialize the Arena.</div>';
        }
    });

    return () => {
        if (cleanupWhole) cleanupWhole();
        container.innerHTML = '';
    };
}

screenRegistry.register({
    id: 'arena',
    label: 'Arena',
    order: 20,
    mount: mountArenaScreen
});
