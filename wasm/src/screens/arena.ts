// wasm/src/screens/arena.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { 
  selectedLanguageId, selectedViewId, viewLangSelectionsGrid, composedLanguages 
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
    style: { flex: '1', overflowY: 'auto', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '15px', display: 'flex', flexDirection: 'column', minHeight: '0' }
  });

  const layout = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-strong)', paddingBottom: '10px', marginBottom: '10px', flex: '0 0 auto' } },
      h('h2', { style: { margin: '0', color: 'var(--text-primary)' }, textContent: 'Arena Manifold (Global/Local Map)' })
    ),
    contentContainer
  );
  
  container.appendChild(layout);

  // 1. Auto-resolve Active Language & Instantiate Whole Map
  createEffect(() => {
    let lId = selectedLanguageId.value;

    // AUTO-RESOLVE: If no explicit language selected, pick the View's active selection
    if (!lId) {
      const activeSels = viewLangSelectionsGrid.value.filter(s => s.active);
      if (activeSels.length > 0) {
        lId = activeSels[0].languageId;
      } else {
        const sections = composedLanguages();
        if (sections.length > 0 && sections[0].items.length > 0) {
          lId = sections[0].items[0].id;
        }
      }
      if (lId) {
        selectedLanguageId.value = lId; // Sync selection signal
      }
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
          if (!selectedViewId.value) return;
          
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

  // 2. Reactively Sync Stance Overlays (Domain Tensions) to Active Whole Map
  createEffect(() => {
    const whole = activeWhole.value;
    const overlays = stanceOverlays.value;
    if (whole) {
      whole.overlays.value = overlays;
    }
  });

  // 3. Mount Active Whole Instance
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
        style: { color: 'var(--text-muted)', fontStyle: 'italic' }, 
        textContent: 'Select or tick a Language to render the global map.' 
      }));
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

