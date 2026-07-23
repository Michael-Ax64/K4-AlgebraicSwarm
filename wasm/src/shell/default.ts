// wasm/src/shell/default.ts

import { AppShell } from './types';
import { ScreenRegistry } from '../screens/registry';
import { activeScreen } from '../state';
import { pushScreen } from '../router';
import { 
    selectedWorldId, selectedLevelId, selectedCircuitId, 
    worldsGrid, levelsGrid, circuitGrid 
} from '../ledger/grid-state';
import { createEffect } from '../reactive';

export const DefaultShell: AppShell = {
    mountChrome: (root: HTMLElement, registry: ScreenRegistry) => {
        // --- INJECT CRITICAL CSS FOR LAYOUT, CONTRAST, AND ARENA GRID ---
        const style = document.createElement('style');
        style.textContent = `
            /* 1. Cross-Browser Flex & Base Colors */
            .k4-app-layout {
                display: flex;
                flex-direction: row;
                height: 100vh;
                width: 100vw;
                overflow: hidden;
                background: #F7F5F0;
                color: #14161A;
                font-family: system-ui, -apple-system, sans-serif;
            }
            .k4-pane-worlds, .k4-pane-circuits {
                background: #EAE8E3;
                border-right: 1px solid #DAD5CB;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                transition: flex 0.2s ease;
            }
            .k4-pane-worlds { flex: 0 0 250px; }
            .k4-pane-circuits { flex: 0 0 280px; background: #F4F2ED; }
            
            /* Safe Collapse Logic */
            .k4-pane-worlds.collapsed { flex: 0 0 40px; overflow: hidden; }
            .k4-pane-circuits.collapsed { flex: 0 0 40px; overflow: hidden; }
            .collapsed .pane-content { display: none; }

            .k4-main-area {
                flex: 1 1 auto;
                display: flex;
                flex-direction: column;
                min-width: 0;
                background: #FFFFFF;
            }
            .k4-screen-container {
                flex: 1 1 auto;
                overflow-y: auto;
                position: relative;
                padding: 20px;
                display: flex;
                flex-direction: column;
            }

            /* 2. Sidebar Navigation Items */
            .world-item, .level-item, .circuit-item {
                color: #222222;
                padding: 10px 15px;
                cursor: pointer;
                border-bottom: 1px solid #E0E0E0;
                transition: background 0.1s;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .world-item:hover, .level-item:hover, .circuit-item:hover {
                background: rgba(0,0,0,0.05);
            }
            .world-item.active { background: #D6D3CB; font-weight: bold; color: #000; }
            .level-item { padding-left: 30px; font-size: 0.9em; }
            .level-item.active { background: #DFDCD4; font-weight: bold; color: #000; }
            
            .circuit-item.active {
                background: #E0F7FA !important;
                border-left: 4px solid #00ACC1;
                color: #006064 !important;
            }

            .collapse-btn {
                background: #DAD5CB;
                border: none;
                border-bottom: 1px solid #ccc;
                padding: 12px;
                cursor: pointer;
                font-weight: bold;
                color: #111;
                text-align: left;
                white-space: nowrap;
                flex: 0 0 auto;
            }
            .collapse-btn:hover { background: #D0Cbc1; }
            .pane-content { flex: 1; overflow-y: auto; }
            
            /* 3. Chrome Top Nav */
            .k4-chrome {
                flex: 0 0 auto;
                background: #F7F5F0;
                border-bottom: 1px solid #DAD5CB;
                padding: 10px 10px 0 10px;
                display: flex;
                gap: 4px;
                overflow-x: auto;
            }
            .k4-nav-btn {
                background: transparent;
                border: 1px solid transparent;
                padding: 8px 16px;
                cursor: pointer;
                color: #555;
                font-weight: bold;
                border-radius: 4px 4px 0 0;
                white-space: nowrap;
            }
            .k4-nav-btn:hover { color: #111; }
            .k4-nav-btn.active {
                background: #FFFFFF;
                border: 1px solid #DAD5CB;
                border-bottom: 1px solid #FFFFFF;
                color: #000;
                margin-bottom: -1px;
            }

            /* --- 4. THE WHOLE & THE ARENA GRID --- */
            .whole { flex: 1; min-height: 0; display: flex; flex-direction: column; }
            .whole-perspective { margin-bottom: 10px; font-size: 0.9rem; color: #666; }
            .whole-tabbar { display: flex; gap: 4px; margin-bottom: 15px; }
            .whole-tab { background: #EAE8E3; border: 1px solid #DAD5CB; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 500;}
            .whole-tab.active { background: #14161A; color: #fff; border-color: #14161A; }
            
            .whole-body {
                flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; container-type: size; 
            }
            .arena-grid {
                display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 8px;
                width: 100cqmin; height: 100cqmin; max-width: 900px; max-height: 900px;
            }
            .arena-cell {
                border: 1px solid #DAD5CB; border-radius: 6px; background: #FAFAFA; padding: 10px; display: flex; flex-direction: column; overflow: hidden; color: #222; font-size: 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .arena-cell.face { background: #E3F2FD; border-color: #90CAF9; justify-content: center; align-items: center; text-align: center; }
            .arena-cell.stance { background: #FFF8E1; border-color: #FFE082; justify-content: center; }
            .arena-cell.empty { background: transparent; border: 1px dashed #ccc; box-shadow: none; }
            .arena-cell.absorbed { opacity: 0.2; background: transparent; border: 1px dashed #ccc; }

            .vertex-pole { font-size: 2.5rem; font-weight: bold; display: block; color: #0D47A1; line-height: 1; }
            .vertex-term { color: #1565C0; font-weight: bold; font-size: 1rem; margin-top: 8px; }
            .stance-meta { display: flex; justify-content: space-between; font-size: 0.7rem; color: #888; margin-bottom: 6px; }
            .stance-name { font-weight: bold; font-size: 0.95rem; margin-bottom: 4px; color: #111; }
            .stance-eq { font-family: monospace; color: #555; background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px; align-self: flex-start; }
            .stance-held { color: #d32f2f; font-weight: bold; }
            .quarter-controls { position: absolute; top: 4px; right: 4px; display: flex; gap: 4px; }
            .quarter-control-char { background: rgba(0,0,0,0.1); border:none; border-radius:3px; cursor:pointer; padding: 2px 6px; font-weight:bold; }
            
            /* --- 5. PARADOX ENGINE GRID (HIGH CONTRAST) --- */
            .paradox-grid { display: flex; flex-direction: column; gap: 15px; margin-top: 10px; width: 100%; }
            .paradox-face-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .paradox-face-header { font-weight: bold; color: #1565C0; border-bottom: 1px solid #90CAF9; padding-bottom: 4px; margin-top: 15px; text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem; }
            .paradox-card { background: #FFFDE7; border: 1px solid #FFCA28; padding: 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .paradox-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-color: #FFB300; background: #FFF8E1; }
            .paradox-name { font-weight: 800; color: #111; margin-bottom: 6px; font-size: 1rem; }
            .paradox-meta { font-family: monospace; color: #444; font-size: 0.8rem; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #FFE082; }
            .paradox-tension { color: #222; font-size: 0.9rem; line-height: 1.5; }

            /* --- 6. CHAT MESSAGE STYLES --- */
            .msg-block { padding: 10px; border-radius: 6px; font-size: 0.95em; max-width: 85%; }
            .msg-user { background: #E3F2FD; align-self: flex-end; border: 1px solid #BBDEFB; }
            .msg-system { background: #F4F2ED; align-self: flex-start; border: 1px solid #DAD5CB; }
            .msg-error { background: #ffebee; align-self: flex-start; border: 1px solid #ef9a9a; color: #c62828; }
            .msg-system.wide { max-width: 100%; width: 100%; }

            /* Text Utilities */
            .empty-text { color: #888; padding: 15px; font-size: 0.9rem; font-style: italic; }
        `;
        document.head.appendChild(style);
        
        // --- BUILD DOM ---
        const appLayout = document.createElement('div');
        appLayout.className = 'k4-app-layout';
        
        // ==========================================
        // PANE 1: WORLDS & LEVELS (Collapsible)
        // ==========================================
        const paneWorlds = document.createElement('div');
        paneWorlds.className = 'k4-pane-worlds'; 
        
        const collapseWorldsBtn = document.createElement('button');
        collapseWorldsBtn.textContent = '◀ Context';
        collapseWorldsBtn.className = 'collapse-btn';
        
        const worldsContent = document.createElement('div');
        worldsContent.className = 'pane-content';
        
        collapseWorldsBtn.onclick = () => {
            paneWorlds.classList.toggle('collapsed');
            collapseWorldsBtn.textContent = paneWorlds.classList.contains('collapsed') ? '▶' : '◀ Context';
        };
        
        paneWorlds.appendChild(collapseWorldsBtn);
        paneWorlds.appendChild(worldsContent);

        createEffect(() => {
            const worlds = worldsGrid.value;
            const levels = levelsGrid.value;
            const activeW = selectedWorldId.value;
            const activeL = selectedLevelId.value;
            
            worldsContent.innerHTML = '';
            worlds.forEach(w => {
                const wDiv = document.createElement('div');
                wDiv.className = `world-item ${w.id === activeW ? 'active' : ''}`;
                wDiv.textContent = `🌍 ${w.name}`;
                wDiv.onclick = () => { selectedWorldId.value = w.id; };
                worldsContent.appendChild(wDiv);
                
                if (w.id === activeW) {
                    const lContainer = document.createElement('div');
                    lContainer.className = 'level-container';
                    levels.forEach(l => {
                        const lDiv = document.createElement('div');
                        lDiv.className = `level-item ${l.id === activeL ? 'active' : ''}`;
                        lDiv.textContent = `↳ ${l.name}`;
                        lDiv.onclick = (e) => { e.stopPropagation(); selectedLevelId.value = l.id; };
                        lContainer.appendChild(lDiv);
                    });
                    worldsContent.appendChild(lContainer);
                }
            });
        });

        // ==========================================
        // PANE 2: CIRCUITS / 5D COORDINATES (Collapsible)
        // ==========================================
        const paneCircuits = document.createElement('div');
        paneCircuits.className = 'k4-pane-circuits';
        
        const collapseCircuitsBtn = document.createElement('button');
        collapseCircuitsBtn.textContent = '◀ Coordinates';
        collapseCircuitsBtn.className = 'collapse-btn';

        const circuitsContent = document.createElement('div');
        circuitsContent.className = 'pane-content';

        collapseCircuitsBtn.onclick = () => {
            paneCircuits.classList.toggle('collapsed');
            collapseCircuitsBtn.textContent = paneCircuits.classList.contains('collapsed') ? '▶' : '◀ Coordinates';
        };

        paneCircuits.appendChild(collapseCircuitsBtn);
        paneCircuits.appendChild(circuitsContent);

        createEffect(() => {
            const circuits = circuitGrid.value;
            const activeC = selectedCircuitId.value;
            
            circuitsContent.innerHTML = '';
            
            if (circuits.length === 0) {
                circuitsContent.innerHTML = '<div class="empty-text">No coordinates compiled. Select a Level.</div>';
                return;
            }

            circuits.forEach(c => {
                const cDiv = document.createElement('div');
                cDiv.className = `circuit-item ${c.id === activeC ? 'active' : ''}`;
                const coordString = `ω${c.drivingOmega}:R${c.resistanceR}:L${c.inductanceL}:C${c.capacitanceC}`;
                
                cDiv.innerHTML = `
                    <div style="font-weight:bold; margin-bottom: 4px;">${c.name}</div>
                    <div style="font-family:monospace; font-size:0.8rem; opacity:0.8;">${coordString}</div>
                `;
                cDiv.onclick = () => { selectedCircuitId.value = c.id; };
                circuitsContent.appendChild(cDiv);
            });
        });

        // ==========================================
        // PANE 3: MAIN VIEWPORT
        // ==========================================
        const mainArea = document.createElement('div');
        mainArea.className = 'k4-main-area';

        const chrome = document.createElement('div');
        chrome.className = 'k4-chrome';
        const navGroup = document.createElement('div');
        navGroup.className = 'k4-nav-group';

        createEffect(() => {
            const tabs = registry.availableScreens.value;
            navGroup.innerHTML = ''; 
            tabs.forEach(t => {
                const btn = document.createElement('button');
                btn.className = 'k4-nav-btn';
                btn.textContent = t.label;
                btn.onclick = () => { if (activeScreen.value !== t.id) pushScreen(t.id); };
                if (activeScreen.value === t.id) btn.classList.add('active');
                navGroup.appendChild(btn);
            });
        });

        chrome.appendChild(navGroup);
        mainArea.appendChild(chrome);

        const screenContainer = document.createElement('div');
        screenContainer.className = 'k4-screen-container';
        mainArea.appendChild(screenContainer);

        appLayout.appendChild(paneWorlds);
        appLayout.appendChild(paneCircuits);
        appLayout.appendChild(mainArea);
        root.appendChild(appLayout);

        return screenContainer;
    }
};
