// wasm/src/main.ts

window.addEventListener('submit', (e) => e.preventDefault(), { capture: true });

import { bootLedger } from './ledger/grid-state';
import { bootAirlock } from './bridge';
import { bootSystemOS } from './router';
import { DefaultShell } from './shell/default';
import { screenRegistry } from './screens/registry';

// Dynamic screen imports — Registers all workspace screens
import './screens/circuit';
import './screens/project';
import './screens/languages';
import './screens/view';
import './screens/kinds';
import './screens/chat';
import './screens/console';
import './screens/documents';
import './screens/doc-editor';
import './screens/doc0';
import './screens/arena';
import './screens/api-log';
import './screens/ledger';
import './screens/manifold';
import './screens/settings';
import './screens/world';

async function init() {
  try {
    console.log("🟢 [Boot] Initializing OS...");

    await bootLedger();
    await bootAirlock();
    
    screenRegistry.beginUpdates();
    screenRegistry.endUpdates();

    document.body.style.margin = '0';
    document.body.innerHTML = ''; 
    
    const appRoot = document.createElement('div');
    appRoot.id = 'k4-app-root';
    appRoot.style.height = '100vh';
    appRoot.style.display = 'flex';
    appRoot.style.flexDirection = 'column';
    document.body.appendChild(appRoot);
    
    bootSystemOS(appRoot, DefaultShell);

  } catch (err) {
    console.error("🔴 [Boot] Fatal initialization error:", err);
  }
}

init();
