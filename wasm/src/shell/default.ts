// wasm/src/shell/default.ts

import { AppShell } from './types';
import { ScreenRegistry } from '../screens/registry';
import { activeScreen } from '../state';
import { pushScreen } from '../router';
import { 
  selectedWorldId, selectedProjectId, selectedViewId, 
  worldsGrid, projectsGrid, viewsGrid, activeWorldConfig, activeProject, activeView, viewLangSelectionsGrid
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

    // Context Graph Sidebar (World -> Project -> View)
    createEffect(() => {
      const worlds = worldsGrid.value;
      const projects = projectsGrid.value;
      const views = viewsGrid.value;
      const activeW = selectedWorldId.value;
      const activeP = selectedProjectId.value;
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
          projects.forEach(p => {
            const isPActive = p.id === activeP;
            const pDiv = h('div', {
              className: `tree-item level-item ${isPActive ? 'active' : ''}`,
              style: 'padding-left: 25px; font-weight: 600;',
              textContent: `📁 ${p.name}`,
              on: { click: (e: Event) => {
                e.stopPropagation();
                selectedProjectId.value = p.id;
                pushScreen('project'); // Opens the Project-Level Screen
              } }
            });
            sidebarContent.appendChild(pDiv);

            if (p.id === activeP) {
              views.forEach(v => {
                const isViewActive = v.id === activeV;
                sidebarContent.appendChild(h('div', {
                  className: `tree-item level-item ${isViewActive ? 'active' : ''}`,
                  style: `padding-left: 42px; font-size: 0.85rem; ${isViewActive ? 'border-left: 3px solid var(--role-controller); background: var(--bg-elevated);' : ''}`,
                  textContent: `👁️ ${v.name}`,
                  on: { click: (e: Event) => {
                    e.stopPropagation();
                    selectedViewId.value = v.id;
                    pushScreen('chat');
                  } }
                }));
              });
            }
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

    // Peer Workspace Tabs for View Context
    const viewPeerScreenIds = ['console', 'chat', 'documents', 'doc-editor', 'doc0', 'lexicons', 'arena', 'ledger', 'circuit'];
    
    createEffect(() => {
      const tabs = registry.availableScreens.value;
      const w = activeWorldConfig.value;
      const p = activeProject.value;
      
      let locationText = '🌍 No World Selected';
      if (w && p) locationText = `🌍 ${w.name} / 📁 ${p.name}`;
      else if (w) locationText = `🌍 ${w.name}`;

      globalNavLeft.textContent = locationText;
      globalNavRight.replaceChildren();
      localNav.replaceChildren();

      // Top Global Navigation Bar: STRICTLY domain-wide and system screens
      const globalScreenIds = ['world', 'project', 'languages', 'kinds', 'log', 'manifold', 'settings'];

      globalScreenIds.forEach(id => {
        const t = tabs.find(tab => tab.id === id);
        if (!t) return;
        const isGlobalActive = activeScreen.value === t.id;
        globalNavRight.appendChild(h('button', {
          className: `k4-nav-btn ${isGlobalActive ? 'active' : ''}`, textContent: t.label,
          on: { click: () => pushScreen(t.id) }
        }));
      });

      // View Peer Tabs in Local Nav
      viewPeerScreenIds.forEach(id => {
        const t = tabs.find(tab => tab.id === id);
        if (!t) return;
        localNav.appendChild(h('button', {
          className: `k4-nav-btn ${activeScreen.value === t.id ? 'active' : ''}`, 
          textContent: t.label,
          on: { click: () => pushScreen(t.id) }
        }));
      });
    });

    createEffect(() => {
      const v = activeView.value;
      const isViewContext = viewPeerScreenIds.includes(activeScreen.value);
      
      if (!isViewContext) {
        contextBanner.style.display = 'none';
        localNav.style.display = 'none';
      } else {
        contextBanner.style.display = 'block';
        localNav.style.display = 'flex';
        if (v) {
          const activeLangsCount = viewLangSelectionsGrid.value.filter(s => s.active).length;
          contextBanner.replaceChildren(
            h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
              h('div', {},
                h('strong', { textContent: `[ACTIVE VIEW] ${v.name}` }),
                h('span', { textContent: ` | Active Languages: ${activeLangsCount}` })
              ),
              h('span', {
                style: 'opacity: 0.85; font-size: 0.85em; font-family: var(--font-mono); text-align: right; margin-left: auto;',
                textContent: `AC Baseline Physics: ω=${v.innateOmega}, R=${v.innateR}, L=${v.innateL}, C=${v.innateC}`
              })
            )
          );
        } else {
          contextBanner.replaceChildren(h('span', { textContent: 'No Active View selected. Select one from the Context Graph.' }));
        }
      }
    });

    const appLayout = h('div', { className: 'k4-app-layout' }, sidebar, mainArea);
    root.appendChild(appLayout);
    return screenContainer;
  }
};
