// wasm/src/shell/default.ts
import { AppShell } from './types';
import { ScreenRegistry } from '../screens/registry';
import { activeScreen } from '../state';
import { pushScreen } from '../router';
import { 
    selectedWorldId, selectedLanguageId, selectedViewId, 
    worldsGrid, languagesGrid, viewsGrid, activeWorldConfig
} from '../ledger/grid-state';
import { createEffect } from '../reactive';
import { h } from '../dom';

export const DefaultShell: AppShell = {
    mountChrome: (root: HTMLElement, registry: ScreenRegistry) => {
        const sidebarContent = h('div', { className: 'pane-content' });
        const sidebar = h('div', { 
            style: 'flex: 0 0 280px; background: var(--bg-panel); border-right: 1px solid var(--border-subtle); display: flex; flex-direction: column; overflow: hidden;' 
        }, 
            h('div', { style: 'padding: 15px; font-weight: bold; color: var(--text-primary); border-bottom: 1px solid var(--border-strong); background: var(--bg-elevated); letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.85rem;', textContent: 'Context Graph' }),
            sidebarContent
        );

        createEffect(() => {
            const worlds = worldsGrid.value;
            const languages = languagesGrid.value;
            const views = viewsGrid.value;
            const activeW = selectedWorldId.value;
            const activeL = selectedLanguageId.value;
            const activeV = selectedViewId.value;
            
            sidebarContent.replaceChildren();

            worlds.forEach(w => {
                const wDiv = h('div', {
                    className: `tree-item world-item ${w.id === activeW ? 'active' : ''}`,
                    textContent: `🌍 ${w.name}`,
                    on: { click: () => { 
                        selectedWorldId.value = w.id; 
                        if (activeScreen.value !== 'world') pushScreen('world');
                    } }
                });
                sidebarContent.appendChild(wDiv);
                
                if (w.id === activeW) {
                    // --- LANGUAGES FOLDER ---
                    const langHeader = h('div', { 
                        style: `padding: 10px 15px; font-size: 0.8rem; font-weight: bold; color: ${activeScreen.value === 'languages' ? 'var(--text-primary)' : 'var(--text-muted)'}; text-transform: uppercase; margin-top: 10px; cursor: pointer; background: ${activeScreen.value === 'languages' ? 'var(--bg-elevated)' : 'transparent'}; border-left: ${activeScreen.value === 'languages' ? '3px solid var(--role-bridge)' : '3px solid transparent'};`, 
                        textContent: '📖 Languages (Lexicons)',
                        on: { click: () => pushScreen('languages') }
                    });
                    sidebarContent.appendChild(langHeader);

                    languages.forEach(l => {
                        const isActiveLang = l.id === activeL && activeScreen.value === 'languages';
                        sidebarContent.appendChild(h('div', {
                            className: `tree-item level-item ${isActiveLang ? 'active' : ''}`,
                            textContent: l.name,
                            on: { click: (e) => { 
                                e.stopPropagation(); 
                                selectedLanguageId.value = l.id; 
                                pushScreen('languages');
                            } }
                        }));
                    });

                    // --- VIEWS FOLDER ---
                    const viewHeader = h('div', { 
                        style: `padding: 10px 15px; font-size: 0.8rem; font-weight: bold; color: ${activeScreen.value === 'views' ? 'var(--text-primary)' : 'var(--text-muted)'}; text-transform: uppercase; margin-top: 10px; cursor: pointer; background: ${activeScreen.value === 'views' ? 'var(--bg-elevated)' : 'transparent'}; border-left: ${activeScreen.value === 'views' ? '3px solid var(--role-controller)' : '3px solid transparent'};`, 
                        textContent: '👁️ Active Views',
                        on: { click: () => pushScreen('views') }
                    });
                    sidebarContent.appendChild(viewHeader);

                    views.forEach(v => {
                        const isViewHierarchy = ['views', 'circuit', 'arena', 'chat', 'ledger'].includes(activeScreen.value);
                        const isActiveView = v.id === activeV && isViewHierarchy;
                        sidebarContent.appendChild(h('div', {
                            className: `tree-item level-item ${isActiveView ? 'active' : ''}`,
                            style: isActiveView ? 'border-left-color: var(--role-controller);' : '',
                            textContent: v.name,
                            on: { click: (e) => { 
                                e.stopPropagation(); 
                                selectedViewId.value = v.id; 
                                if (!['circuit', 'arena', 'chat', 'ledger'].includes(activeScreen.value)) {
                                    pushScreen('circuit');
                                }
                            } }
                        }));
                    });
                }
            });
        });

        const globalNavLeft = h('div', { style: 'display: flex; align-items: center; font-weight: bold; color: var(--text-primary); font-size: 0.95rem; padding-bottom: 8px;' });
        const globalNavRight = h('div', { style: 'display: flex; gap: 6px; align-items: flex-end;' });
        const globalNav = h('div', { className: 'k4-global-nav', style: 'justify-content: space-between;' }, globalNavLeft, globalNavRight);
        
        const contextBanner = h('div', { className: 'k4-context-banner' });
        const localNav = h('div', { className: 'k4-local-nav' });
        const screenContainer = h('div', { className: 'k4-screen-container', style: 'padding: 0;' }); 

        const mainArea = h('div', { className: 'k4-main-area' }, globalNav, contextBanner, localNav, screenContainer);

        createEffect(() => {
            const tabs = registry.availableScreens.value;
            globalNavLeft.textContent = activeWorldConfig.value ? `🌍 ${activeWorldConfig.value.name}` : '🌍 No World Selected';
            globalNavRight.replaceChildren();
            localNav.replaceChildren();

            const globalScreenIds = ['world', 'views', 'languages', 'log', 'manifold', 'settings'];
            const viewSubScreenIds = ['circuit', 'arena', 'chat', 'ledger'];

            globalScreenIds.forEach(id => {
                const t = tabs.find(tab => tab.id === id);
                if (!t) return;
                const isGlobalActive = activeScreen.value === t.id || (t.id === 'views' && viewSubScreenIds.includes(activeScreen.value));
                globalNavRight.appendChild(h('button', {
                    className: `k4-nav-btn ${isGlobalActive ? 'active' : ''}`, textContent: t.label,
                    on: { click: () => { 
                        if (t.id === 'views' && selectedViewId.value && !viewSubScreenIds.includes(activeScreen.value)) pushScreen('circuit');
                        else pushScreen(t.id); 
                    } }
                }));
            });

            viewSubScreenIds.forEach(id => {
                const t = tabs.find(tab => tab.id === id);
                if (!t) return;
                localNav.appendChild(h('button', {
                    className: `k4-nav-btn ${activeScreen.value === t.id ? 'active' : ''}`, textContent: t.label === 'Circuit' ? 'Circuits' : t.label,
                    on: { click: () => pushScreen(t.id) }
                }));
            });
        });

        createEffect(() => {
            const vId = selectedViewId.value;
            const view = viewsGrid.value.find(v => v.id === vId);
            const isViewContext = activeScreen.value === 'views' || ['circuit', 'arena', 'chat', 'ledger'].includes(activeScreen.value);
            
            if (!isViewContext) {
                contextBanner.style.display = 'none';
                localNav.style.display = 'none';
            } else {
                contextBanner.style.display = 'block';
                localNav.style.display = 'flex';
                if (view) {
                    const lang = languagesGrid.value.find(l => l.id === view.languageId)?.name || 'Unknown Language';
                    contextBanner.replaceChildren(
                        h('strong', { textContent: `[ACTIVE VIEW] ${view.name}` }),
                        h('span', { textContent: ` | Language Lens: ${lang}` }),
                        h('br'),
                        h('span', { style: 'opacity: 0.8; font-size: 0.9em;', textContent: `Innate Baseline Physics: ω=${view.innateOmega}, R=${view.innateR}, L=${view.innateL}, C=${view.innateC}` })
                    );
                } else {
                    contextBanner.replaceChildren(h('span', { textContent: 'No View selected. Select one from the Context Graph.' }));
                }
            }
        });

        const appLayout = h('div', { className: 'k4-app-layout' }, sidebar, mainArea);
        root.appendChild(appLayout);
        return screenContainer;
    }
};
