// wasm/src/shell/default.ts

import { AppShell } from './types';
import { activeScreen } from '../state';
import { pushScreen } from '../router';
import {
  selectedCircuitId, activeCircuit, circuitsGrid, languagesGrid, documentsGrid,
  circuitTrashCount, languageTrashCount, documentTrashCount,
  activeSovereignSpace, SovereignSpace, selectedLanguageId, selectedDocumentId,
  rehomingState, cancelRehoming, executeRehome, deleteCircuitToTrash,
  startRehoming, purgeCircuitPermanent, appendConsoleRow, refreshAllGrids,
  resolveCircuitLineage, sidebarCollapsed, recalculateTrashCounters
} from '../ledger/grid-state';

import { vfsDb } from '../ledger/fs';
import { CircuitNode } from '../ledger/schema';
import { createEffect } from '../reactive';
import { h, trashButton } from '../dom';

export const DefaultShell: AppShell = {
  mountChrome: (root: HTMLElement, registry: any) => {
    const sidebarContent = h('div', { className: 'pane-content' });
    const sidebarTitle = h('span', { style: 'letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.85rem;' });

    const sidebarHeader = h('div', {
      style: 'padding: 12px 15px; font-weight: bold; color: var(--text-primary); border-bottom: 1px solid var(--border-strong); background: var(--bg-elevated); display: flex; justify-content: space-between; align-items: center;'
    },
      sidebarTitle,
      h('button', {
        textContent: '+ New',
        className: 'k4-btn-primary',
        style: 'padding: 2px 8px; font-size: 0.75rem; cursor: pointer;',
        on: { click: (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          handleCreateNewInActiveSovereignSpace().catch(err => console.error("Failed to create node:", err));
        }}
      })
    );

    const sidebar = h('div', {
      style: 'flex: 0 0 280px; background: var(--bg-panel); border-right: 1px solid var(--border-subtle); display: flex; flex-direction: column; overflow: hidden;'
    }, sidebarHeader, sidebarContent);

    // Dynamic Sidebar Collapsed/Visible Effect
    createEffect(() => {
      const isCollapsed = sidebarCollapsed.value;
      sidebar.style.display = isCollapsed ? 'none' : 'flex';
    });

    // Freeze Mode Re-Homing Overlay Banner
    const freezeBanner = h('div', {
      style: 'background: var(--role-paradox); color: #fff; padding: 10px 16px; font-weight: bold; display: none; justify-content: space-between; align-items: center;'
    });

    // Top Global Nav
    const globalNavLeft = h('div', { style: 'display: flex; align-items: center; font-weight: bold; color: var(--text-primary); font-size: 0.95rem;' });
    const globalNavRight = h('div', { style: 'display: flex; gap: 6px; align-items: flex-end;' });
    const globalNav = h('div', { className: 'k4-global-nav', style: 'justify-content: space-between;' }, globalNavLeft, globalNavRight);

    const contextBanner = h('div', { className: 'k4-context-banner' });
    const localNav = h('div', { className: 'k4-local-nav' });
    const screenContainer = h('div', { className: 'k4-screen-container', style: 'padding: 0; flex: 1;' });

    const mainArea = h('div', { className: 'k4-main-area', style: 'position: relative;' },
      freezeBanner, globalNav, contextBanner, localNav, screenContainer
    );

    function getActiveSovereignNode(): CircuitNode | null {
      const space = activeSovereignSpace.value;
      if (space === 'documents') {
        const dId = selectedDocumentId.value;
        return documentsGrid.value.find(d => d.id === dId) || null;
      } else if (space === 'languages') {
        const lId = selectedLanguageId.value;
        return languagesGrid.value.find(l => l.id === lId) || null;
      }
      return activeCircuit.value;
    }

    // ─── RE-HOMING FREEZE OVERLAY CONTROLLER ──────────────────────────────
    createEffect(() => {
      const rh = rehomingState.value;
      if (rh.active) {
        freezeBanner.style.display = 'flex';
        freezeBanner.replaceChildren(
          h('span', { textContent: `🔒 RE-HOMING MODE: Click a target Circuit in the sidebar to re-home under it...` }),
          h('div', { style: 'display: flex; gap: 8px;' },
            h('button', {
              textContent: 'Root (No Home)',
              style: 'background: #fff; color: #000; border: none; padding: 4px 10px; font-weight: bold; cursor: pointer; border-radius: 3px;',
              on: { click: () => executeRehome(null) }
            }),
            h('button', {
              textContent: 'Cancel',
              style: 'background: transparent; color: #fff; border: 1px solid #fff; padding: 4px 10px; cursor: pointer; border-radius: 3px;',
              on: { click: () => cancelRehoming() }
            })
          )
        );
        mainArea.style.pointerEvents = 'none';
        freezeBanner.style.pointerEvents = 'auto';
        sidebar.style.border = '2px solid var(--role-paradox)';
      } else {
        freezeBanner.style.display = 'none';
        mainArea.style.pointerEvents = 'auto';
        sidebar.style.border = 'none';
      }
    });

    // ─── DYNAMIC SIDEBAR TREE RENDERER ─────────────────────────────────────
    createEffect(() => {
      const space = activeSovereignSpace.value;
      const isRehoming = rehomingState.value.active;
      const rehomeSourceId = rehomingState.value.sourceId;

      sidebarContent.replaceChildren();

      let activeGrid: CircuitNode[] = [];
      let activeSelectedId: string | null = null;
      let tCount = 0;

      if (space === 'documents') {
        sidebarTitle.textContent = 'Documents Tree';
        activeGrid = documentsGrid.value;
        activeSelectedId = selectedDocumentId.value;
        tCount = documentTrashCount.value;
      } else if (space === 'languages') {
        sidebarTitle.textContent = 'Languages Tree';
        activeGrid = languagesGrid.value;
        activeSelectedId = selectedLanguageId.value;
        tCount = languageTrashCount.value;
      } else {
        sidebarTitle.textContent = 'Circuits Tree';
        activeGrid = circuitsGrid.value;
        activeSelectedId = selectedCircuitId.value;
        tCount = circuitTrashCount.value;
      }

      const liveNodes = activeGrid.filter(c => c.priorId !== '__TRASH__');
      const trashedNodes = activeGrid.filter(c => c.priorId === '__TRASH__');

      const knownIds = new Set(liveNodes.map(n => n.id));
      const childrenMap = new Map<string | null, CircuitNode[]>();

      liveNodes.forEach(c => {
        const rawPrior = (c.priorId && c.priorId.trim() !== '') ? c.priorId : null;
        const key = (rawPrior && knownIds.has(rawPrior)) ? rawPrior : null;

        if (!childrenMap.has(key)) childrenMap.set(key, []);
        childrenMap.get(key)!.push(c);
      });

      function renderTree(parentId: string | null, depth: number = 0) {
        const children = childrenMap.get(parentId) || [];
        children.forEach(node => {
          const isActive = node.id === activeSelectedId;
          const isRehomeTarget = isRehoming && node.id !== rehomeSourceId;

          const badge = node.specialization === 'world' ? '🌍' :
                        node.specialization === 'project' ? '📁' :
                        node.specialization === 'view' ? '👁️' :
                        node.specialization === 'language' ? '📖' :
                        node.specialization === 'document' ? '📄' : '✦';

          const itemRow = h('div', {
            className: `tree-item ${isActive ? 'active' : ''}`,
            style: `padding-left: ${12 + depth * 16}px; display: flex; justify-content: space-between; align-items: center; ${isRehomeTarget ? 'outline: 1px dashed var(--role-paradox); cursor: pointer;' : ''}`,
            on: {
              click: (e: Event) => {
                e.stopPropagation();
                if (isRehoming) {
                  if (node.id !== rehomeSourceId) executeRehome(node.id);
                } else {
                  if (space === 'documents') {
                    selectedDocumentId.value = node.id;
                    pushScreen('doc-editor');
                  } else if (space === 'languages') {
                    selectedLanguageId.value = node.id;
                    pushScreen('languages');
                  } else {
                    selectedCircuitId.value = node.id;
                  }
                }
              }
            }
          },
            h('span', { textContent: `${badge} ${node.name}` }),
            h('div', { className: 'tree-actions', style: 'display: flex; gap: 4px;' },
              h('button', {
                textContent: '⇄',
                title: 'Re-home Node',
                style: 'background: transparent; border: none; color: var(--text-muted); cursor: pointer;',
                on: { click: (e: Event) => { e.stopPropagation(); startRehoming(node.id); } }
              }),
              trashButton({
                title: 'Move to Trash',
                onClick: (e) => { e.stopPropagation(); deleteCircuitToTrash(node.id); }
              })
            )
          );

          sidebarContent.appendChild(itemRow);
          renderTree(node.id, depth + 1);
        });
      }

      renderTree(null, 0);

      if (tCount > 0) {
        sidebarContent.appendChild(h('div', {
          style: 'padding: 10px 15px; font-weight: bold; color: var(--health-halted); border-top: 1px solid var(--border-strong); margin-top: 15px; background: var(--bg-elevated);',
          textContent: `🗑️ Trash (${tCount})`
        }));

        trashedNodes.forEach(tNode => {
          const isTActive = tNode.id === activeSelectedId;
          const tRow = h('div', {
            className: `tree-item ${isTActive ? 'active' : ''}`,
            style: 'padding-left: 20px; display: flex; justify-content: space-between; align-items: center;',
            on: { click: () => {
              if (space === 'documents') selectedDocumentId.value = tNode.id;
              else if (space === 'languages') selectedLanguageId.value = tNode.id;
              else selectedCircuitId.value = tNode.id;
            }}
          },
            h('span', { textContent: `✦ ${tNode.name}` }),
            h('div', { style: 'display: flex; gap: 4px;' },
              h('button', {
                textContent: 'Restore',
                style: 'font-size: 0.7rem; background: var(--role-bridge); color: #fff; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;',
                on: { click: (e: Event) => { e.stopPropagation(); executeRehomeNodeDirect(tNode.id, null); } }
              }),
              h('button', {
                textContent: 'Purge',
                style: 'font-size: 0.7rem; background: var(--health-halted); color: #fff; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;',
                on: { click: (e: Event) => { e.stopPropagation(); purgeCircuitPermanent(tNode.id); } }
              })
            )
          );
          sidebarContent.appendChild(tRow);
        });
      }
    });

    // ─── TOP GLOBAL MENU & DYNAMIC SUBMENU MANAGEMENT ──────────────────────
    createEffect(() => {
      const activeNode = getActiveSovereignNode();
      const space = activeSovereignSpace.value;
      const currentScr = activeScreen.value;
      const tabs = registry.availableScreens.value;

      const isGlobalTopLevelScreen = ['kinds', 'log', 'manifold', 'settings'].includes(currentScr);

      // Top-line header single-word titles
      if (currentScr === 'kinds') globalNavLeft.textContent = '✦ KINDS';
      else if (currentScr === 'log') globalNavLeft.textContent = '✦ LOG';
      else if (currentScr === 'manifold') globalNavLeft.textContent = '✦ MANIFOLD';
      else if (currentScr === 'settings') globalNavLeft.textContent = '✦ SETTINGS';
      else globalNavLeft.textContent = activeNode ? `✦ ${activeNode.name}` : 'No Node Selected';

      globalNavRight.replaceChildren();
      localNav.replaceChildren();

      // Top Menu Items
      const topMenuItems: { id: string; label: string; space?: SovereignSpace }[] = [
        { id: 'circuit', label: 'Circuits', space: 'circuits' },
        { id: 'doc-editor', label: 'Documents', space: 'documents' },
        { id: 'languages', label: 'Languages', space: 'languages' },
        { id: 'kinds', label: 'Kinds' },
        { id: 'log', label: 'API Log' },
        { id: 'manifold', label: 'Manifold' },
        { id: 'settings', label: 'Settings' }
      ];

      topMenuItems.forEach(item => {
        const isTopActive = item.space ? (activeSovereignSpace.value === item.space && !isGlobalTopLevelScreen) : (currentScr === item.id);
        
        globalNavRight.appendChild(h('button', {
          className: `k4-nav-btn ${isTopActive ? 'active' : ''}`,
          textContent: item.label,
          on: { click: () => {
            if (item.space) {
              // 1. Guaranteed Sidebar Visibility on entry into Circuits, Documents, Languages
              sidebarCollapsed.value = false;
              activeSovereignSpace.value = item.space;
            } else if (currentScr === item.id && isGlobalTopLevelScreen) {
              // 2. Re-clicking an active top-level entry (KINDS, LOG, MANIFOLD, SETTINGS) toggles tree visibility!
              sidebarCollapsed.value = !sidebarCollapsed.value;
            }
            pushScreen(item.id);
          }}
        }));
      });

      // Submenu Workspace Tabs
      if (isGlobalTopLevelScreen) {
        localNav.style.display = 'none';
        contextBanner.style.display = 'none';
      } else {
        localNav.style.display = 'flex';
        contextBanner.style.display = 'block';

        let peerScreenIds: string[] = [];

        if (space === 'documents') {
          // Documents Submenu starts: Document | Documents | Circuit | Chat...
          peerScreenIds = ['doc-editor', 'documents', 'circuit', 'chat', 'doc0', 'arena', 'ledger', 'console'];
        } else if (space === 'languages') {
          peerScreenIds = ['languages', 'circuit', 'chat', 'doc0', 'arena', 'ledger', 'console'];
        } else {
          // Circuits Submenu ends: ..Arena | Languages | Documents | Log | Console
          peerScreenIds = ['circuit', 'chat', 'doc0', 'arena', 'lexicons', 'documents', 'ledger', 'console'];
        }

        peerScreenIds.forEach(id => {
          const t = tabs.find((tab: any) => tab.id === id);
          if (!t) return;

          let dynamicLabel = t.label;
          if (id === 'doc-editor') dynamicLabel = 'Document';
          if (id === 'documents') dynamicLabel = 'Documents';
          if (id === 'languages') dynamicLabel = 'Lexicon';
          if (id === 'circuit') dynamicLabel = 'Circuit';
          if (id === 'lexicons') dynamicLabel = 'Languages';
          if (id === 'ledger') dynamicLabel = 'Log';

          localNav.appendChild(h('button', {
            className: `k4-nav-btn ${currentScr === t.id ? 'active' : ''}`, 
            textContent: dynamicLabel,
            on: { click: () => pushScreen(t.id) }
          }));
        });
      }
    });

    // Adaptive Context Banner
    createEffect(() => {
      const node = getActiveSovereignNode();
      const currentScr = activeScreen.value;

      if (['kinds', 'log', 'manifold', 'settings'].includes(currentScr)) {
        contextBanner.style.display = 'none';
        return;
      }

      if (node) {
        contextBanner.style.display = 'block';
        resolveCircuitLineage(node.id).then(({ lineage }) => {
          const isTrashedInChain = lineage.some(n => n.priorId === '__TRASH__') || node.priorId === '__TRASH__';
          const trashBadge = isTrashedInChain ? ' ⚠️ [TRASHED]' : '';

          contextBanner.replaceChildren(
            h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
              h('strong', {
                style: isTrashedInChain ? 'color: var(--health-halted);' : 'color: var(--text-primary);',
                textContent: `[CIRCUIT] ${node.name} (${node.specialization})${trashBadge}`
              }),
              h('span', { style: 'font-family: var(--font-mono); font-size: 0.85rem;', textContent: `AC Physics: ω=${node.physics.omega}, R=${node.physics.r}, L=${node.physics.l}, C=${node.physics.c}` })
            )
          );
        });
      } else {
        contextBanner.style.display = 'block';
        contextBanner.replaceChildren(h('span', { textContent: 'No active node selected.' }));
      }
    });

    const appLayout = h('div', { className: 'k4-app-layout' }, sidebar, mainArea);
    root.appendChild(appLayout);
    return screenContainer;
  }
};

async function handleCreateNewInActiveSovereignSpace() {
  const space = activeSovereignSpace.peek();
  const now = Date.now();

  if (space === 'documents') {
    const parentDocId = selectedDocumentId.peek();
    const freshDocNode: CircuitNode = {
      id: `doc-${now}-${Math.random().toString(36).substring(2, 7)}`,
      priorId: (parentDocId && parentDocId !== '__TRASH__') ? parentDocId : null,
      specialization: 'document',
      name: 'New Document',
      description: '',
      doc0: '',
      physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
      activeFace: 'P',
      heldAbsentVar: 'I',
      documentData: { content: '', defaultA: true, defaultP: false, defaultU: false, defaultI: false, defaultR: false, kind: 'source' },
      createdAt: now,
      updatedAt: now,
    };
    await vfsDb.upsertCircuit(freshDocNode);
    await refreshAllGrids();
    selectedDocumentId.value = freshDocNode.id;
    pushScreen('doc-editor');
  } else if (space === 'languages') {
    const parentLangId = selectedLanguageId.peek();
    const freshLangNode: CircuitNode = {
      id: `lang-${now}-${Math.random().toString(36).substring(2, 7)}`,
      priorId: (parentLangId && parentLangId !== '__TRASH__') ? parentLangId : null,
      specialization: 'language',
      name: 'New Language',
      description: '',
      doc0: '',
      physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
      activeFace: 'P',
      heldAbsentVar: 'I',
      createdAt: now,
      updatedAt: now,
    };
    await vfsDb.upsertCircuit(freshLangNode);
    await refreshAllGrids();
    selectedLanguageId.value = freshLangNode.id;
    pushScreen('languages');
  } else {
    const currentSelected = selectedCircuitId.peek();
    const parentId = (currentSelected && currentSelected.trim() !== '' && currentSelected !== '__TRASH__') ? currentSelected : null;
    
    const freshCircuit: CircuitNode = {
      id: `circ-${now}-${Math.random().toString(36).substring(2, 7)}`,
      priorId: parentId,
      specialization: 'circuit',
      name: 'New Circuit',
      description: '',
      doc0: '',
      physics: { omega: 1.0, r: 10, l: 10, c: 0.1 },
      activeFace: 'P',
      heldAbsentVar: 'I',
      createdAt: now,
      updatedAt: now,
    };
    await vfsDb.upsertCircuit(freshCircuit);
    await refreshAllGrids();
    selectedCircuitId.value = freshCircuit.id;
    pushScreen('circuit');
  }
}

async function executeRehomeNodeDirect(nodeId: string, targetId: string | null) {
  const node = await vfsDb.getCircuit(nodeId);
  if (!node) return;
  node.priorId = targetId;
  node.updatedAt = Date.now();
  await vfsDb.upsertCircuit(node);
  await refreshAllGrids();
  await recalculateTrashCounters(); // Ensures sidebar trash badge updates immediately
}

