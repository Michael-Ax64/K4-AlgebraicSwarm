// wasm/src/screens/chat.ts

import { createEffect, Signal } from '../reactive';
import {
  uiState, manualPrompt, draftQuery
} from '../state';
import {
  processSubmission, submitLlmPaste, resetEngineRun
} from '../bridge';
import {
  selectedViewId, activeView, ledgerGrid, updateActiveViewDoc0,
  markLedgerAnswerKept, editLedgerRow, activeProject, activeWorldConfig,
  resolvedInclusionForActiveView, viewLangSelectionsGrid
} from '../ledger/grid-state';
import {
  composedKinds, resolveKind, resolveKindAlias
} from '../kinds/kinds-registry';
import { pushScreen } from '../router';
import { screenRegistry } from './registry';
import { h } from '../dom';
import { LedgerRow } from '../ledger/schema';

export function mountChatScreen(container: HTMLElement): () => void {
  const selectedKindKey = new Signal<string>('chat');
  const isWarm = new Signal<boolean>(false);
  const isStageAndReview = new Signal<boolean>(false);
  const editingRowId = new Signal<string | null>(null);

  const layout = h('div', { style: 'display: flex; flex-direction: column; height: 100%; padding: 15px;' });
  container.appendChild(layout);

  // Check active View
  const vId = selectedViewId.peek();
  const view = activeView.peek();

  if (!vId || !view) {
    layout.appendChild(h('div', { 
      style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
      textContent: '🔒 Select an Active View from the context graph to initialize Chat.'
    }));
    return () => { container.innerHTML = ''; };
  }

  // 1. Transcript Container (History Workbench)
  const logContainer = h('div', { 
    style: 'flex: 1; overflow-y: auto; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px; padding: 15px; margin-bottom: 10px;'
  });

  // 2. Manual Mode Workspace
  const promptArea = h('textarea', {
    readOnly: true,
    style: 'width: 100%; height: 130px; font-family: var(--font-mono); font-size: 0.85rem; background: var(--bg-deep); color: var(--text-primary); border: 1px solid var(--border-strong); border-radius: 4px; padding: 10px; margin-bottom: 8px;',
    value: manualPrompt.value
  });

  const copyBtn = h('button', {
    textContent: '📋 Copy Prompt to Clipboard',
    className: 'k4-btn-primary',
    style: 'margin-bottom: 12px;',
    on: { click: () => {
      navigator.clipboard.writeText(manualPrompt.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = '📋 Copy Prompt to Clipboard', 2000);
    }}
  });

  const pasteArea = h('textarea', {
    placeholder: 'Paste the external LLM response JSON/markdown here...',
    style: 'width: 100%; height: 110px; font-family: var(--font-mono); font-size: 0.85rem; background: var(--bg-deep); color: var(--text-primary); border: 1px solid var(--border-strong); border-radius: 4px; padding: 10px; margin-bottom: 8px;'
  });

  const submitPasteBtn = h('button', {
    textContent: '🚀 Submit Pasted LLM Response',
    className: 'k4-btn-primary',
    on: { click: async () => {
      const text = pasteArea.value.trim();
      if (!text) return;
      pasteArea.value = '';
      await submitLlmPaste(text);
    }}
  });

  const manualWorkspace = h('div', {
    style: 'background: var(--bg-panel); border: 1px solid var(--role-bridge); border-radius: 6px; padding: 12px; margin-bottom: 12px; display: none;'
  },
    h('h3', { style: 'margin-top: 0; color: var(--role-bridge); font-size: 0.95rem; margin-bottom: 6px;', textContent: '⚠️ Manual Mode: Copy Prompt to LLM & Paste Response' }),
    promptArea, copyBtn, pasteArea, submitPasteBtn
  );

  // 3. Toolbar Controls (Kind Picker, Warm Toggle, Stage Toggle)
  const kindSelect = h('select', {
    style: 'padding: 6px 10px; font-weight: bold; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 4px;',
    on: { change: (e: Event) => selectedKindKey.value = (e.target as HTMLSelectElement).value }
  });

  const warmCheck = h('input', {
    type: 'checkbox',
    checked: isWarm.value,
    style: 'cursor: pointer; transform: scale(1.1);',
    on: { change: (e: Event) => isWarm.value = (e.target as HTMLInputElement).checked }
  });

  const stageCheck = h('input', {
    type: 'checkbox',
    checked: isStageAndReview.value,
    style: 'cursor: pointer; transform: scale(1.1);',
    on: { change: (e: Event) => isStageAndReview.value = (e.target as HTMLInputElement).checked }
  });

  const controlToolbar = h('div', { 
    style: 'display: flex; gap: 15px; align-items: center; background: var(--bg-panel); padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: 4px 4px 0 0;' 
  },
    h('label', { style: 'font-weight: bold; font-size: 0.8rem; color: var(--text-secondary);' }, 'Target Kind: '),
    kindSelect,
    h('label', { style: 'font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;' }, warmCheck, ' warm continuation'),
    h('label', { style: 'font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;' }, stageCheck, ' stage-and-review')
  );

  // 4. Live Attached Context Indicator Bar
  const contextSummaryBar = h('div', {
    style: 'display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; font-family: var(--font-mono); color: var(--text-secondary); background: var(--bg-elevated); padding: 4px 12px; border-left: 1px solid var(--border-subtle); border-right: 1px solid var(--border-subtle);'
  });

  const manageDocsBtn = h('button', {
    textContent: '📄 Edit Inclusions Grid',
    style: 'background: transparent; border: 1px solid var(--border-strong); color: var(--role-bridge); border-radius: 3px; cursor: pointer; padding: 2px 6px; font-size: 0.75rem; font-weight: bold;',
    on: { click: () => pushScreen('documents') }
  });

  // 5. Dynamic Hint Bar
  const hintBar = h('div', {
    style: 'font-size: 0.8rem; color: var(--role-bridge); padding: 4px 12px; background: var(--bg-elevated); border-left: 1px solid var(--border-subtle); border-right: 1px solid var(--border-subtle); font-style: italic;'
  });

  // 6. Main Input Textarea (Stable DOM node)
  const doc0Input = h('textarea', {
    style: 'width: 100%; height: 75px; padding: 10px; resize: vertical; font-family: var(--font-mono); font-size: 0.9rem; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-strong); border-radius: 0 0 4px 4px;',
    value: view.doc0,
    placeholder: 'Compose prompt draft (Document 0)...',
    on: { input: async (e: Event) => {
      const val = (e.target as HTMLTextAreaElement).value;
      await updateActiveViewDoc0(val);
    }}
  });

  const sendBtn = h('button', {
    textContent: 'Send →',
    className: 'k4-btn-primary',
    style: 'height: 40px; padding: 0 20px; font-weight: bold; align-self: flex-end; margin-top: 8px;',
    on: { click: async () => {
      if (uiState.value === 'halted') {
        resetEngineRun();
        return;
      }

      if (isStageAndReview.value) {
        alert(`Stage-and-Review: Review doc0 draft before dispatching toward [Kind: ${resolveKindAlias(selectedKindKey.value)}].`);
        return;
      }

      await processSubmission(selectedKindKey.value, isWarm.value, doc0Input.value);
    }}
  });

  const inputWorkspace = h('div', { style: 'display: flex; flex-direction: column;' },
    controlToolbar, contextSummaryBar, hintBar, doc0Input, sendBtn
  );

  layout.append(logContainer, manualWorkspace, inputWorkspace);

  // ─── FINE-GRAINED REACTIVE EFFECTS (STABLE DOM) ──────────────────────────

  // Reactive Effect: Populate Kind Dropdown
  createEffect(() => {
    const proj = activeProject.peek();
    const world = activeWorldConfig.peek();
    const sections = composedKinds(proj?.name || null, world?.name || null);

    kindSelect.replaceChildren();
    sections.forEach(sec => {
      const optGroup = h('optgroup', { label: `── ${sec.scopeName} ──` });
      sec.items.forEach(k => {
        optGroup.appendChild(h('option', {
          value: k.key,
          textContent: k.alias,
          selected: k.key === selectedKindKey.value
        }));
      });
      kindSelect.appendChild(optGroup);
    });
  });

  // Reactive Effect: Update Hint Bar
  createEffect(() => {
    const activeKind = resolveKind(selectedKindKey.value);
    hintBar.textContent = activeKind ? `${activeKind.alias} — ${activeKind.hint}` : '';
  });

  // Reactive Effect: Update Context Summary Bar
  createEffect(() => {
    const inclusions = resolvedInclusionForActiveView();
    const activeDocCount = inclusions.filter(i => i.A || i.P || i.U || i.I || i.R).length;
    const activeLangs = viewLangSelectionsGrid.value.filter(s => s.active).length;

    contextSummaryBar.replaceChildren(
      h('span', { textContent: `📎 Attached Docs: ${activeDocCount} | 📖 Active Lexicons: ${activeLangs}` }),
      manageDocsBtn
    );
  });

  // Reactive Effect: Toggle Manual Mode Workspace vs Input Workspace
  createEffect(() => {
    const state = uiState.value;
    if (state === 'awaiting_llm_paste') {
      manualWorkspace.style.display = 'block';
      promptArea.value = manualPrompt.value;
      inputWorkspace.style.display = 'none';
    } else {
      manualWorkspace.style.display = 'none';
      inputWorkspace.style.display = 'flex';
    }

    if (state === 'halted') {
      sendBtn.textContent = '↺ Reset Engine';
      sendBtn.style.background = 'var(--health-halted)';
    } else {
      const activeAlias = resolveKindAlias(selectedKindKey.value);
      sendBtn.textContent = `Send toward ${activeAlias} →`;
      sendBtn.style.background = 'var(--role-bridge)';
    }
  });

  // Reactive Effect: Render History Transcript Bubbles
  createEffect(() => {
    const rows = ledgerGrid.value.filter(r => r.direction !== 'system');
    logContainer.replaceChildren();

    if (rows.length === 0) {
      logContainer.appendChild(h('div', {
        style: 'color: var(--text-muted); font-style: italic; text-align: center; padding: 30px;',
        textContent: 'No exchange history for this View yet. Compose doc0 and hit Send.'
      }));
      return;
    }

    const turnGroups = new Map<number, LedgerRow[]>();
    rows.forEach(r => {
      const group = turnGroups.get(r.turnNumber) || [];
      group.push(r);
      turnGroups.set(r.turnNumber, group);
    });

    turnGroups.forEach((turnRows, turnNum) => {
      const turnCard = h('div', { 
        style: 'margin-bottom: 16px; border-left: 3px solid var(--border-strong); padding-left: 12px;' 
      });

      turnCard.appendChild(h('div', {
        style: 'font-size: 0.75rem; font-weight: bold; color: var(--text-muted); font-family: var(--font-mono); margin-bottom: 6px;',
        textContent: `TURN #${turnNum}`
      }));

      turnRows.forEach(row => {
        const isOut = row.direction === 'out';
        const alias = resolveKindAlias(row.kind);

        const bubble = h('div', {
          style: `margin-bottom: 8px; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-subtle); background: ${isOut ? 'var(--bg-elevated)' : 'var(--bg-panel)'}; ${isOut ? 'margin-left: 20px;' : 'margin-right: 20px;'}`
        });

        const headerBadge = h('div', {
          style: 'display: flex; justify-content: space-between; font-size: 0.75rem; font-family: var(--font-mono); margin-bottom: 6px; color: var(--text-secondary); border-bottom: 1px dashed var(--border-subtle); padding-bottom: 4px;'
        },
          h('span', { style: 'font-weight: bold; color: var(--role-bridge);', textContent: `[${isOut ? 'OUT' : 'IN'}] ${alias.toUpperCase()}` }),
          h('span', { textContent: row.header || new Date(row.createdAt).toLocaleTimeString() })
        );

        const bodyEl = h('div', {
          style: 'white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-primary);',
          textContent: row.body
        });

        let artifactCard: HTMLElement | null = null;
        if (row.ptrCycle) {
          artifactCard = h('div', {
            style: 'margin-top: 8px; padding: 8px; background: rgba(34, 197, 94, 0.1); border: 1px solid var(--health-clear); border-radius: 4px; font-size: 0.8rem; color: var(--health-clear);'
          },
            h('strong', { textContent: `✓ Phase Transition Record (Cycle #${row.ptrCycle}.${row.ptrSeq})` }),
            h('div', { textContent: `Stance: ${row.ptrStance} | Health: ${row.ptrHealth}` })
          );
        } else if (row.body.includes('[RAISE]')) {
          artifactCard = h('div', {
            style: 'margin-top: 8px; padding: 8px; background: rgba(234, 179, 8, 0.1); border: 1px solid var(--health-raises); border-radius: 4px; font-size: 0.8rem; color: var(--health-raises);',
            textContent: '⚡ Structural RAISE Detected — Material Shear'
          });
        } else if (row.body.includes('# HALT')) {
          artifactCard = h('div', {
            style: 'margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--health-halted); border-radius: 4px; font-size: 0.8rem; color: var(--health-halted);',
            textContent: '🛑 Terminal HALT — Execution Boundary Intercepted'
          });
        }

        const actionsBar = h('div', { style: 'display: flex; gap: 10px; margin-top: 8px; font-size: 0.75rem; justify-content: flex-end;' });

        if (isOut) {
          const editBtn = h('button', {
            textContent: '✎ Edit Prompt',
            style: 'background: transparent; border: none; color: var(--text-muted); cursor: pointer;',
            on: { click: () => editingRowId.value = editingRowId.value === row.id ? null : row.id }
          });

          const reRunBtn = h('button', {
            textContent: '⟲ Re-run Turn',
            style: 'background: transparent; border: none; color: var(--role-bridge); cursor: pointer; font-weight: bold;',
            on: { click: async () => {
              await processSubmission(row.kind, row.warm, row.body);
            }}
          });

          actionsBar.append(editBtn, reRunBtn);
        } else {
          const isKept = row.kept ?? true;
          const keptLabel = h('label', {
            style: `cursor: pointer; font-weight: bold; color: ${isKept ? 'var(--health-clear)' : 'var(--text-muted)'}; display: flex; align-items: center; gap: 4px;`
          },
            h('input', {
              type: 'checkbox',
              checked: isKept,
              on: { change: async () => await markLedgerAnswerKept(view.id, row.id) }
            }),
            isKept ? '✓ Kept Answer (Context Active)' : 'Alternate Answer'
          );
          actionsBar.appendChild(keptLabel);
        }

        bubble.append(headerBadge, bodyEl);
        if (artifactCard) bubble.appendChild(artifactCard);
        bubble.appendChild(actionsBar);

        if (editingRowId.value === row.id) {
          const editArea = h('textarea', {
            value: row.body,
            style: 'width: 100%; height: 80px; margin-top: 8px; font-family: var(--font-mono); font-size: 0.85rem;'
          });
          const saveEditBtn = h('button', {
            textContent: 'Save Edit',
            className: 'k4-btn-primary',
            style: 'margin-top: 4px; padding: 4px 10px; font-size: 0.75rem;',
            on: { click: async () => {
              await editLedgerRow(row.id, { body: editArea.value });
              editingRowId.value = null;
            }}
          });
          bubble.append(editArea, saveEditBtn);
        }

        turnCard.appendChild(bubble);
      });

      logContainer.appendChild(turnCard);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  });

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'chat', label: 'Chat', order: 101, mount: mountChatScreen });

