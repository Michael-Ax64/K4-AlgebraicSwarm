// wasm/src/screens/arena.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { 
  selectedLanguageId, selectedCircuitId, activeCircuitLangs,
  composedLanguages, languagesGrid
} from '../ledger/grid-state';
import { processUserReply } from '../bridge';
import { uiState } from '../state';
import { pushScreen } from '../router';
import { Whole } from '../arena/whole';
import { 
  arenaCache, currentArenaPath, activeWhole, getArenaPathKey, stanceOverlays 
} from './arena-state';
import { h } from '../dom';

export function mountArenaScreen(container: HTMLElement): () => void {
  const contentContainer = h('div', { 
    style: 'flex: 1; overflow-y: auto; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 10px; display: flex; flex-direction: column; min-height: 0; width: 100%; height: 100%;'
  });

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; width: 100%;' },
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 10px; flex: 0 0 auto;' },
      h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: 'Arena Manifold (K4 Stance Map)' })
    ),
    contentContainer
  );
  
  container.appendChild(layout);

  createEffect(() => {
    let lId = selectedLanguageId.value;

    // Auto-resolve Language ID for active circuit
    if (!lId) {
      const activeSels = activeCircuitLangs.value.filter(s => s.active);
      if (activeSels.length > 0) {
        lId = activeSels[0].languageId;
      } else if (languagesGrid.value.length > 0) {
        lId = languagesGrid.value[0].id;
      } else {
        const sections = composedLanguages();
        if (sections.length > 0 && sections[0].items.length > 0) {
          lId = sections[0].items[0].id;
        }
      }
      if (lId) selectedLanguageId.value = lId;
    }

    if (!lId) {
      activeWhole.value = null;
      return;
    }

    const path = [{ languageId: lId }];
    const cacheKey = getArenaPathKey(path);
    
    let whole = arenaCache.get(cacheKey);
    if (!whole) {
      whole = new Whole({ 
        id: cacheKey, 
        name: `Arena Map`, 
        languageId: lId,
        onStanceClick: (stance) => {
          if (!selectedCircuitId.value) return;
          
          if (uiState.value === 'awaiting_user') {
            processUserReply(stance.name);
            pushScreen('chat');
          } else {
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

  createEffect(() => {
    const whole = activeWhole.value;
    const overlays = stanceOverlays.value;
    if (whole) whole.overlays.value = overlays;
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
      contentContainer.appendChild(h('div', { 
        style: 'color: var(--text-muted); font-style: italic;', 
        textContent: 'Select or link a Language lexicon to render the stance map.' 
      }));
    }
  });

  return () => {
    if (cleanupWhole) cleanupWhole();
    container.innerHTML = '';
  };
}

screenRegistry.register({ id: 'arena', label: 'Arena', order: 110, mount: mountArenaScreen });

