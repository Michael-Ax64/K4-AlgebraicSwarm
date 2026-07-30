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
import { h, createAutosizingTextarea } from '../dom';
import { mountPhysicsEditor } from '../circuit-detail';

const POLES: K4Pole[] = ['P', 'I', 'U', 'R'];

export function mountCircuitScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; max-width: 650px; overflow-y: auto; height: 100%;' });
  container.appendChild(layout);

  let currentRenderedCircuitId: string | null = null;

  createEffect(() => {
    // Circuit invariant: purgeCircuitPermanent auto-repicks so activeCircuit is
    // always non-null. The effect re-runs on selection changes and updates below.
    const c = activeCircuit.value!;
    const allCircuits = circuitsGrid.value;

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
            className: 'k4-btn-bridge',
            on: { click: async () => {
              c.priorId = null;
              c.updatedAt = Date.now();
              await vfsDb.upsertCircuit(c);
              await refreshAllGrids();
            }}
          });

          const rehomeActionBtn = h('button', {
            textContent: '⇄ Re-Home Elsewhere',
            className: 'k4-btn-paradox',
            on: { click: () => startRehoming(c.id) }
          });

          const purgeBtn = h('button', {
            textContent: '🗑️ Purge Permanently',
            className: 'k4-btn-danger',
            on: { click: async () => {
              if (confirm(`Permanently delete '${c.name}'? This cannot be undone.`)) {
                await purgeCircuitPermanent(c.id);
              }
            }}
          });

          trashBannerHost.replaceChildren(h('div', { className: 'k4-panel-trashed' },
            h('div', { className: 'k4-heading-danger', style: 'font-weight: bold; margin-bottom: 6px;', textContent: `⚠️ TRASHED NODE: ${causeText}` }),
            h('div', { style: 'display: flex; gap: 10px; margin-top: 8px;' }, restoreBtn, rehomeActionBtn, purgeBtn)
          ));
        }
      });

      const persist = async () => {
        c.updatedAt = Date.now();
        await vfsDb.upsertCircuit(c);
        await refreshAllGrids();
      };

      // Inputs with Autosizing Textareas
      const nameInput = h('input', { value: c.name, style: 'width: 100%; margin-bottom: 12px; font-weight: bold;' }) as HTMLInputElement;
      nameInput.addEventListener('change', () => { c.name = nameInput.value.trim() || c.name; persist(); });

      const descInput = createAutosizingTextarea({ value: c.description || '', placeholder: 'Description...', style: 'width: 100%; margin-bottom: 12px; min-height: 50px;' });
      descInput.addEventListener('change', () => { c.description = descInput.value.trim(); persist(); });

      const doc0Input = createAutosizingTextarea({ value: c.doc0 || '', placeholder: 'Default doc0 prompt draft...', style: 'width: 100%; margin-bottom: 12px; min-height: 60px; font-family: var(--font-mono);' });
      doc0Input.addEventListener('change', () => { c.doc0 = doc0Input.value; persist(); });

      // Specialization Class Picker — HIDE IF IN DOCUMENTS OR LANGUAGES SPACE, OR IF DOCUMENT/LANGUAGE NODE
      const currentSpace = activeSovereignSpace.value;
      const hideSpecialization = currentSpace === 'documents' || currentSpace === 'languages' || ['document', 'language'].includes(c.specialization);

      const specLabel = hideSpecialization ? null : h('label', { textContent: 'Specialization Class', className: 'k4-form-label' });
      const specSel = hideSpecialization ? null : h('select', { style: 'width: 100%; margin-bottom: 12px;' },
        h('option', { value: 'circuit', textContent: '⌖ Circuit (Base Node)', selected: c.specialization === 'circuit' }),
        h('option', { value: 'world', textContent: '🌍 World (Class with API Panel)', selected: c.specialization === 'world' }),
        h('option', { value: 'project', textContent: '📁 Project (Class)', selected: c.specialization === 'project' }),
        h('option', { value: 'view', textContent: '👁️ View (Class)', selected: c.specialization === 'view' })
      ) as HTMLSelectElement | null;
      if (specSel) {
        specSel.addEventListener('change', () => {
          c.specialization = specSel.value as CircuitSpecialization;
          if (c.specialization === 'world' && !c.specializationData) {
            c.specializationData = { apiProvider: 'manual', apiKey: '', apiBaseUrl: '', worldDirectives: '' };
          }
          persist();
        });
      }

      // Prior Parent Selector
      const priorSel = h('select', { style: 'width: 100%; margin-bottom: 12px;' },
        h('option', { value: '', textContent: 'Root (No Home)', selected: c.priorId === null }),
        ...allCircuits.filter(other => other.id !== c.id && other.priorId !== '__TRASH__').map(other =>
          h('option', { value: other.id, textContent: `${other.name} (${other.specialization})`, selected: c.priorId === other.id })
        )
      ) as HTMLSelectElement;
      priorSel.addEventListener('change', () => { c.priorId = priorSel.value || null; persist(); });

      // Physics Editor
      const phys = mountPhysicsEditor(c.physics, {
        onChange: (p) => { c.physics = p; persist(); }
      });

      const activeFaceSel = h('select', { style: 'margin-right: 12px;' },
        ...POLES.map(f => h('option', { value: f, textContent: f, selected: c.activeFace === f }))
      ) as HTMLSelectElement;
      activeFaceSel.addEventListener('change', () => { c.activeFace = activeFaceSel.value as K4Pole; persist(); });

      const heldAbsentSel = h('select', {},
        ...POLES.map(f => h('option', { value: f, textContent: f, selected: c.heldAbsentVar === f }))
      ) as HTMLSelectElement;
      heldAbsentSel.addEventListener('change', () => { c.heldAbsentVar = heldAbsentSel.value as K4Pole; persist(); });

      const rehomeBtn = h('button', {
        textContent: '⇄ Re-Home Mode',
        className: 'k4-btn-paradox', style: 'margin-top: 15px; padding: 8px 12px; border-radius: 4px;',
        on: { click: () => startRehoming(c.id) }
      });

      layout.append(
        trashBannerHost,
        h('h2', { className: 'k4-screen-title underline', textContent: `Circuit Node Details: ${c.name}` }),
        h('label', { textContent: 'Name', className: 'k4-form-label' }), nameInput,
        specLabel || h('span'), specSel || h('span'),
        h('label', { textContent: 'Prior Circuit (Home)', className: 'k4-form-label' }), priorSel,
        h('label', { textContent: 'Description', className: 'k4-form-label' }), descInput,
        h('label', { textContent: 'Draft doc0 Prompt', className: 'k4-form-label' }), doc0Input,
        
        h('div', { className: 'k4-section-divider' },
          h('strong', { textContent: 'Active Poles', className: 'k4-section-strong' }),
          h('label', { textContent: 'Active Face: ', className: 'k4-form-sublabel' }), activeFaceSel,
          h('label', { textContent: 'Held Absent Variable: ', className: 'k4-form-sublabel' }), heldAbsentSel
        ),

        phys.element,

        h('div', { style: 'display: flex; align-items: center;' }, rehomeBtn)
      );
    }
  });

  return () => { container.innerHTML = ''; };
}


screenRegistry.register({ id: 'circuit', label: 'Circuit', order: 10, mount: mountCircuitScreen });

