// wasm/src/screens/arena.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { selectedLanguageId, selectedViewId } from '../ledger/grid-state';
import { processUserReply } from '../bridge';
import { uiState } from '../state';
import { pushScreen } from '../router';
import { Whole } from '../arena/whole';
import { arenaCache, currentArenaPath, activeWhole, getArenaPathKey } from './arena-state';
import { h } from '../dom';

export function mountArenaScreen(container: HTMLElement): () => void {
    const contentContainer = h('div', { 
        style: { flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '15px', display: 'flex', flexDirection: 'column', minHeight: '0' }
    });

    const layout = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-strong)', paddingBottom: '10px', marginBottom: '10px', flex: '0 0 auto' } },
            h('h2', { style: { margin: '0', color: 'var(--text-primary)' }, textContent: 'Arena Manifold (Global/Local Map)' })
        ),
        contentContainer
    );
    
    container.appendChild(layout);

    createEffect(() => {
        const lId = selectedLanguageId.value; // The Active Language
        if (!lId) {
            activeWhole.value = null;
            return;
        }

        const path = [{ languageId: lId }];
        const cacheKey = getArenaPathKey(path);
        
        let whole = arenaCache.get(cacheKey);
        if (!whole) {
            // Instantiate the map with the interactive click handler attached
            whole = new Whole({ 
                id: cacheKey, 
                name: `Arena: ${lId}`, 
                languageId: lId,
                onStanceClick: (stance) => {
                    // THE EXPLORATION LOOP: Click -> Query -> Relocate
                    if (!selectedViewId.value) return; // Must have an active cursor
                    
                    // If the engine is waiting, we send the Stance Name as the E3 recognition response.
                    // This forces the Paradox Engine to step to this new coordinate.
                    if (uiState.value === 'awaiting_user') {
                        processUserReply(stance.name);
                        pushScreen('chat'); // Jump to console to watch the query execute
                    } else {
                        // If engine is idle, we treat clicking a stance as a raw intent submission
                        processUserReply(`Let us relocate to ${stance.name} (${stance.eq}).`);
                        pushScreen('chat');
                    }
                }
            });
            arenaCache.set(cacheKey, whole);
        }
        
        currentArenaPath.value = path;
        activeWhole.value = whole;
    });

    let cleanupWhole: (() => void) | null = null;

    createEffect(() => {
        const whole = activeWhole.value;
        if (cleanupWhole) { cleanupWhole(); cleanupWhole = null; }
        
        contentContainer.replaceChildren();
        
        if (whole) {
            contentContainer.style.padding = '0';
            cleanupWhole = whole.mount(contentContainer);
        } else {
            contentContainer.style.padding = '15px';
            contentContainer.appendChild(h('div', { style: { color: '#888', fontStyle: 'italic' }, textContent: 'Select a Language to render the global map.' }));
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
    order: 110,
    mount: mountArenaScreen
});
