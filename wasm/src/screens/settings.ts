// wasm/src/screens/settings.ts

import { systemSettings, recalculateTrashCounters } from '../ledger/grid-state';
import { vfsDb } from '../ledger/fs';
import { screenRegistry } from './registry';
import { runSeedImport } from '../ledger/seed';
import { h } from '../dom';

export function mountSettingsScreen(container: HTMLElement): () => void {
  const layout = h('div', { style: 'padding: 20px; max-width: 600px;' });
  container.appendChild(layout);

  const curSettings = systemSettings.value;

  const autoSeedCheck = h('input', {
    type: 'checkbox',
    checked: curSettings.autoLoadSeedData,
    style: 'cursor: pointer; transform: scale(1.1); margin-right: 8px;'
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

  const recalcTrashBtn = h('button', {
    textContent: '↺ Recalculate Trash Counters',
    className: 'k4-btn-primary',
    style: 'margin-top: 10px; background: var(--bg-surface); border: 1px solid var(--border-strong); color: var(--text-secondary);',
    on: { click: async () => {
      await recalculateTrashCounters();
      recalcTrashBtn.textContent = '✓ Counters Recalculated!';
      setTimeout(() => recalcTrashBtn.textContent = '↺ Recalculate Trash Counters', 2000);
    }}
  });

  const saveSettingsBtn = h('button', {
    textContent: 'Save Settings',
    className: 'k4-btn-primary',
    style: 'margin-top: 15px;',
    on: { click: async () => {
      const updated = {
        autoLoadSeedData: autoSeedCheck.checked,
        seedDataFileNames: fileNamesInput.value.trim(),
        telemetryMaxEntries: 0
      };
      await vfsDb.upsertSettings(updated);
      systemSettings.value = updated;
      alert('Settings saved.');
    }}
  });

  const resetBtn = h('button', {
    textContent: 'Factory Reset Database',
    style: 'background: var(--health-halted); color: #fff; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 10px;',
    on: { click: async () => {
      if (confirm("Factory Reset: Destroy all Circuits, Documents, Languages, and Ledgers?")) {
        await vfsDb.factoryReset();
        location.reload();
      }
    }}
  });

  layout.append(
    h('h2', { style: 'color: var(--text-primary); border-bottom: 1px solid var(--border-strong); padding-bottom: 8px; margin-bottom: 20px;', textContent: 'System Settings' }),
    
    // Seed Data Config Panel
    h('div', { style: 'background: var(--bg-surface); padding: 15px; border-radius: 6px; border: 1px solid var(--border-strong); margin-bottom: 20px;' },
      h('h3', { style: 'margin-top: 0; color: var(--text-primary); font-size: 0.95rem; margin-bottom: 10px;', textContent: '🌱 Seed Data Mechanics' }),
      h('label', { style: 'display: flex; align-items: center; font-size: 0.85rem; color: var(--text-secondary); cursor: pointer;' },
        autoSeedCheck,
        ' Auto-load seed data on cold boot'
      ),
      h('label', { style: 'display: block; margin-top: 12px; font-size: 0.8rem; color: var(--text-muted); font-weight: bold;', textContent: 'Seed Data Source File(s)' }),
      fileNamesInput,
      h('div', { style: 'display: flex; gap: 10px;' }, triggerSeedBtn, recalcTrashBtn)
    ),

    saveSettingsBtn,

    // Danger Zone
    h('div', { style: 'margin-top: 40px; padding: 15px; border: 1px dashed var(--health-halted); border-radius: 6px; background: rgba(239, 68, 68, 0.05);' },
      h('h3', { style: 'color: var(--health-halted); margin-top: 0; font-size: 0.95rem;', textContent: 'Danger Zone' }),
      h('p', { style: 'color: var(--text-secondary); font-size: 0.82rem; margin-bottom: 10px;', textContent: 'Permanently wipes IndexedDB and reloads the application.' }),
      resetBtn
    )
  );

  return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'settings', label: 'Settings', order: 60, mount: mountSettingsScreen });

