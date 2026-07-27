// wasm/src/screens/circuit.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import {
  activeCircuit, selectedCircuitId, circuitsGrid,
  startRehoming, resolveCircuitLineage,
  purgeCircuitPermanent, refreshAllGrids, activeSovereignSpace
} from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { CircuitNode, CircuitSpecialization, K4Pole } from '../ledger/schema';
import { h } from '../dom';

const POLES: K4Pole[] = ['P', 'I', 'U', 'R'];

export function mountCircuitScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; max-width: 650px; overflow-y: auto; height: 100%;' });
  container.appendChild(layout);

  let currentRenderedCircuitId: string | null = null;

  createEffect(() => {
    const c = activeCircuit.value;
    const allCircuits = circuitsGrid.value;

    if (!c) {
      currentRenderedCircuitId = null;
      layout.replaceChildren(h('div', {
        style: 'margin-top: 40px; color: var(--text-muted); font-style: italic; text-align: center;',
        textContent: 'Select a Circuit from the context graph.'
      }));
      return;
    }

    if (currentRenderedCircuitId !== c.id) {
      currentRenderedCircuitId = c.id;
      layout.replaceChildren();

      // Trash Banner
      const trashBannerHost = h('div', {});
      resolveCircuitLineage(c.id).then(({ lineage }) => {
        const trashedAncestor = lineage.find(node => node.priorId === '__TRASH__');
        const isTrashed = c.priorId === '__TRASH__' || !!trashedAncestor;

        if (isTrashed) {
          const isDirect = c.priorId === '__TRASH__';
          const causeText = isDirect 
            ? 'This item was moved to Trash.' 
            : `This item is in Trash because ancestor '${trashedAncestor?.name}' is in Trash.`;

          const restoreBtn = h('button', {
            textContent: '↺ Restore to Root',
            style: 'background: var(--role-bridge); color: #fff; border: none; padding: 6px 12px; border-radius: 3px; font-weight: bold; cursor: pointer;',
            on: { click: async () => {
              c.priorId = null;
              c.updatedAt = Date.now();
              await vfsDb.upsertCircuit(c);
              await refreshAllGrids();
            }}
          });

          const rehomeActionBtn = h('button', {
            textContent: '⇄ Re-Home Elsewhere',
            style: 'background: var(--role-paradox); color: #fff; border: none; padding: 6px 12px; border-radius: 3px; font-weight: bold; cursor: pointer;',
            on: { click: () => startRehoming(c.id) }
          });

          const purgeBtn = h('button', {
            textContent: '🗑️ Purge Permanently',
            style: 'background: var(--health-halted); color: #fff; border: none; padding: 6px 12px; border-radius: 3px; font-weight: bold; cursor: pointer;',
            on: { click: async () => {
              if (confirm(`Permanently delete '${c.name}'? This cannot be undone.`)) {
                await purgeCircuitPermanent(c.id);
              }
            }}
          });

          trashBannerHost.replaceChildren(h('div', {
            style: 'background: rgba(239, 68, 68, 0.15); border: 1px solid var(--health-halted); border-radius: 6px; padding: 12px; margin-bottom: 20px;'
          },
            h('div', { style: 'font-weight: bold; color: var(--health-halted); margin-bottom: 6px;', textContent: `⚠️ TRASHED NODE: ${causeText}` }),
            h('div', { style: 'display: flex; gap: 10px; margin-top: 8px;' }, restoreBtn, rehomeActionBtn, purgeBtn)
          ));
        }
      });

      // Inputs with Autosizing Textareas
      const nameInput = h('input', { value: c.name, style: 'width: 100%; margin-bottom: 12px; font-weight: bold;' });
      const descInput = createAutosizingTextarea({ value: c.description || '', placeholder: 'Description...', style: 'width: 100%; margin-bottom: 12px; min-height: 50px;' });
      const doc0Input = createAutosizingTextarea({ value: c.doc0 || '', placeholder: 'Default doc0 prompt draft...', style: 'width: 100%; margin-bottom: 12px; min-height: 60px; font-family: var(--font-mono);' });

      // Specialization Class Picker — HIDE IF IN DOCUMENTS OR LANGUAGES SPACE, OR IF DOCUMENT/LANGUAGE NODE
      const currentSpace = activeSovereignSpace.value;
      const hideSpecialization = currentSpace === 'documents' || currentSpace === 'languages' || ['document', 'language'].includes(c.specialization);

      const specLabel = hideSpecialization ? null : h('label', { textContent: 'Specialization Class', style: labelStyle });
      const specSel = hideSpecialization ? null : h('select', { style: 'width: 100%; margin-bottom: 12px;' },
        h('option', { value: 'circuit', textContent: '⌖ Circuit (Base Node)', selected: c.specialization === 'circuit' }),
        h('option', { value: 'world', textContent: '🌍 World (Class with API Panel)', selected: c.specialization === 'world' }),
        h('option', { value: 'project', textContent: '📁 Project (Class)', selected: c.specialization === 'project' }),
        h('option', { value: 'view', textContent: '👁️ View (Class)', selected: c.specialization === 'view' })
      );

      // Prior Parent Selector
      const priorSel = h('select', { style: 'width: 100%; margin-bottom: 12px;' },
        h('option', { value: '', textContent: 'Root (No Home)', selected: c.priorId === null }),
        ...allCircuits.filter(other => other.id !== c.id && other.priorId !== '__TRASH__').map(other => 
          h('option', { value: other.id, textContent: `${other.name} (${other.specialization})`, selected: c.priorId === other.id })
        )
      );

      // Physics Sliders Inputs
      const wIn = h('input', { type: 'number', step: '0.1', value: String(c.physics.omega), style: 'width: 100%;' });
      const rIn = h('input', { type: 'number', step: '1', value: String(c.physics.r), style: 'width: 100%;' });
      const lIn = h('input', { type: 'number', step: '1', value: String(c.physics.l), style: 'width: 100%;' });
      const cIn = h('input', { type: 'number', step: '0.001', value: String(c.physics.c), style: 'width: 100%;' });

      const activeFaceSel = h('select', { style: 'margin-right: 12px;' },
        ...POLES.map(f => h('option', { value: f, textContent: f, selected: c.activeFace === f }))
      );
      const heldAbsentSel = h('select', {},
        ...POLES.map(f => h('option', { value: f, textContent: f, selected: c.heldAbsentVar === f }))
      );

      const saveBtn = h('button', { textContent: 'Save Changes', className: 'k4-btn-primary', style: 'margin-top: 15px;' });
      const rehomeBtn = h('button', {
        textContent: '⇄ Re-Home Mode',
        style: 'margin-top: 15px; margin-left: 10px; background: var(--role-paradox); color: #fff; border: none; padding: 8px 12px; border-radius: 4px; font-weight: bold; cursor: pointer;',
        on: { click: () => startRehoming(c.id) }
      });

      const status = h('span', { style: 'margin-left: 12px; font-size: 0.8rem; font-weight: bold;' });

      saveBtn.addEventListener('click', async () => {
        const updated: CircuitNode = {
          ...c,
          name: nameInput.value.trim() || c.name,
          description: descInput.value.trim(),
          doc0: doc0Input.value,
          specialization: specSel ? (specSel.value as CircuitSpecialization) : c.specialization,
          priorId: priorSel.value || null,
          physics: {
            omega: parseFloat(wIn.value) || 1.0,
            r: parseFloat(rIn.value) || 10,
            l: parseFloat(lIn.value) || 10,
            c: parseFloat(cIn.value) || 0.1,
          },
          activeFace: activeFaceSel.value as K4Pole,
          heldAbsentVar: heldAbsentSel.value as K4Pole,
          updatedAt: Date.now(),
        };

        if (updated.specialization === 'world' && !updated.specializationData) {
          updated.specializationData = {
            apiProvider: 'manual',
            apiKey: '',
            apiBaseUrl: '',
            worldDirectives: ''
          };
        }

        await vfsDb.upsertCircuit(updated);
        await refreshAllGrids();
        status.textContent = '✓ Saved';
        status.style.color = 'var(--health-clear)';
        setTimeout(() => { status.textContent = ''; }, 2000);
      });

      layout.append(
        trashBannerHost,
        h('h2', { style: 'margin-top: 0; color: var(--text-primary); border-bottom: 1px solid var(--border-strong); padding-bottom: 8px;', textContent: `Circuit Node Details: ${c.name}` }),
        h('label', { textContent: 'Name', style: labelStyle }), nameInput,
        specLabel || h('span'), specSel || h('span'),
        h('label', { textContent: 'Prior Circuit (Home)', style: labelStyle }), priorSel,
        h('label', { textContent: 'Description', style: labelStyle }), descInput,
        h('label', { textContent: 'Draft doc0 Prompt', style: labelStyle }), doc0Input,
        
        h('div', { style: 'margin-top: 15px; border-top: 1px solid var(--border-subtle); padding-top: 12px;' },
          h('strong', { textContent: 'Active Poles', style: 'display: block; color: var(--text-primary); margin-bottom: 8px;' }),
          h('label', { textContent: 'Active Face: ', style: sublabelStyle }), activeFaceSel,
          h('label', { textContent: 'Held Absent Variable: ', style: sublabelStyle }), heldAbsentSel
        ),

        h('div', { style: 'margin-top: 15px; border-top: 1px solid var(--border-subtle); padding-top: 12px;' },
          h('strong', { textContent: 'AC Baseline Physics Substrate', style: 'display: block; color: var(--text-primary); margin-bottom: 8px;' }),
          h('div', { style: 'display: grid; grid-template-columns: max-content 1fr; column-gap: 12px; row-gap: 8px; align-items: center;' },
            h('label', { textContent: 'ω (Pacing)', style: sublabelStyle }), wIn,
            h('label', { textContent: 'R (Friction)', style: sublabelStyle }), rIn,
            h('label', { textContent: 'L (Momentum)', style: sublabelStyle }), lIn,
            h('label', { textContent: 'C (Tension)', style: sublabelStyle }), cIn
          )
        ),

        h('div', { style: 'display: flex; align-items: center;' }, saveBtn, rehomeBtn, status)
      );
    }
  });

  return () => { container.innerHTML = ''; };
}

function createAutosizingTextarea(props: any): HTMLTextAreaElement {
  const area = h('textarea', props) as HTMLTextAreaElement;
  const autoResize = () => {
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  };
  area.addEventListener('input', autoResize);
  setTimeout(autoResize, 0);
  return area;
}

const labelStyle = 'display: block; color: var(--text-secondary); margin-bottom: 4px; font-weight: bold; font-size: 0.85rem;';
const sublabelStyle = 'font-size: 0.78rem; color: var(--text-muted);';

screenRegistry.register({ id: 'circuit', label: 'Circuit', order: 10, mount: mountCircuitScreen });
