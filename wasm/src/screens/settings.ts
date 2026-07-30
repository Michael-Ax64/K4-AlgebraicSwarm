// wasm/src/screens/settings.ts

import {
  systemSettings, recalculateTrashCounters,
  circuitTrashCount, languageTrashCount, documentTrashCount
} from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { screenRegistry } from './registry';
import { runSeedImport } from '../ledger/seed';
import { providers, catalogDefaultId } from '../config';
import { createEffect } from '../reactive';
import { h } from '../dom';

export function mountSettingsScreen(container: HTMLElement): () => void {
  const layout = h('div', { className: 'k4-screen-layout narrow' });
  container.appendChild(layout);

  const curSettings = systemSettings.value;

  // ── API Provider Global Default ────────────────────────────────────────
  const catalog     = providers.value;
  const shippedFall = catalogDefaultId.value;
  const currentPick = curSettings.defaultProviderId || '';

  const providerSel = h('select', {
    style: 'width: 100%; max-width: 500px; margin-top: 6px; font-family: var(--font-mono);'
  },
    h('option', {
      value: '',
      textContent: `Use catalog default (${shippedFall})`,
      selected: currentPick === ''
    }),
    ...catalog.map(p => h('option', {
      value: p.id,
      textContent: `${p.name}  [${p.transport}]`,
      selected: currentPick === p.id
    }))
  );

  const providerNote = h('div', {
    style: 'font-size: 0.78rem; color: var(--text-muted); margin-top: 6px; font-style: italic;',
    textContent: 'Each World falls back to this global default unless it selects a specific provider or Manual.'
  });

  // ── Seed Data ──────────────────────────────────────────────────────────
  const autoSeedCheck = h('input', {
    type: 'checkbox',
    checked: curSettings.autoLoadSeedData,
    className: 'k4-checkbox-large', style: 'margin-right: 8px;'
  });

  const fileNamesInput = h('input', {
    type: 'text',
    value: curSettings.seedDataFileNames || 'seed-data.json',
    style: 'width: 100%; margin-top: 6px; font-family: var(--font-mono);'
  });

  const triggerSeedBtn = h('button', {
    textContent: '🚀 Trigger Seed Import',
    className: 'k4-btn-primary',
    style: 'margin-top: 10px;',
    on: { click: async () => {
      triggerSeedBtn.textContent = 'Importing...';
      await runSeedImport(fileNamesInput.value.trim());
      triggerSeedBtn.textContent = '✓ Seed Data Loaded!';
      setTimeout(() => triggerSeedBtn.textContent = '🚀 Trigger Seed Import', 2000);
    }}
  });

  // ── Trash Management ───────────────────────────────────────────────────
  const trashCountsDisplay = h('div', {
    style: 'font-size: 0.85rem; color: var(--text-secondary); font-family: var(--font-mono); margin-bottom: 10px;'
  });

  createEffect(() => {
    const c = circuitTrashCount.value;
    const d = documentTrashCount.value;
    const l = languageTrashCount.value;
    trashCountsDisplay.textContent = `Trash-counts: Circuits ${c}, Docs ${d}, Languages ${l}`;
  });

  const recalcTrashBtn = h('button', {
    textContent: '↺ Recalculate Trash Counters',
    className: 'k4-btn-secondary',
    on: { click: async () => {
      await recalculateTrashCounters();
      recalcTrashBtn.textContent = '✓ Counters Recalculated!';
      setTimeout(() => recalcTrashBtn.textContent = '↺ Recalculate Trash Counters', 2000);
    }}
  });

  // ── General Actions ────────────────────────────────────────────────────
  const saveSettingsBtn = h('button', {
    textContent: 'Save Settings',
    className: 'k4-btn-primary',
    style: 'margin-top: 15px;',
    on: { click: async () => {
      const updated = {
        autoLoadSeedData:   autoSeedCheck.checked,
        seedDataFileNames:  fileNamesInput.value.trim(),
        telemetryMaxEntries: 0,
        defaultProviderId:  providerSel.value  // '' means "fall through to catalog default"
      };
      await vfsDb.upsertSettings(updated);
      systemSettings.value = updated;
      alert('Settings saved.');
    }}
  });

  const resetBtn = h('button', {
    textContent: 'Factory Reset Database',
    className: 'k4-btn-danger', style: 'padding: 8px 16px; border-radius: 4px; margin-top: 10px;',
    on: { click: async () => {
      if (confirm("Factory Reset: Destroy all Circuits, Documents, Languages, and Ledgers?")) {
        await vfsDb.factoryReset();
        location.reload();
      }
    }}
  });

  layout.append(
    h('h2', { className: 'k4-screen-title underline', style: 'margin-bottom: 20px;', textContent: 'System Settings' }),

    // ── API Provider Panel ─────────────────────────────────────────────
    h('div', { className: 'k4-card' },
      h('h3', { className: 'k4-section-title small', textContent: '🔌 API Provider — Global Default' }),
      h('label', { className: 'k4-form-label-small', textContent: 'Default Provider (from src/config.json catalog)' }),
      providerSel,
      providerNote
    ),

    // ── Seed Data Panel ────────────────────────────────────────────────
    h('div', { className: 'k4-card' },
      h('h3', { className: 'k4-section-title small', textContent: '🌱 Seed Data Mechanics' }),
      h('label', { style: 'display: flex; align-items: center; font-size: 0.85rem; color: var(--text-secondary); cursor: pointer;' },
        autoSeedCheck,
        ' Auto-load seed data on cold boot'
      ),
      h('label', { className: 'k4-form-label-small', style: 'margin-top: 12px;', textContent: 'Seed Data Source File(s)' }),
      fileNamesInput,
      triggerSeedBtn
    ),

    // ── Trash Management Panel ──────────────────────────────────────────
    h('div', { className: 'k4-card' },
      h('h3', { className: 'k4-section-title small', textContent: '🗑️ Trash Management' }),
      trashCountsDisplay,
      recalcTrashBtn
    ),

    saveSettingsBtn,

    // ── Danger Zone ────────────────────────────────────────────────────
    h('div', { className: 'k4-panel-danger', style: 'margin-top: 40px;' },
      h('h3', { className: 'k4-section-title small k4-heading-danger', style: 'margin-bottom: 0;', textContent: 'Danger Zone' }),
      h('p', { style: 'color: var(--text-secondary); font-size: 0.82rem; margin-bottom: 10px;', textContent: 'Permanently wipes IndexedDB and reloads the application.' }),
      resetBtn
    )
  );

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'settings', label: 'Settings', order: 60, mount: mountSettingsScreen });

