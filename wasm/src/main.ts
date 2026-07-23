// wasm/src/main.ts

window.addEventListener('submit', (e) => e.preventDefault(), { capture: true });

import { bootLedger } from './ledger/grid-state';
import { bootAirlock } from './bridge';
import { bootSystemOS } from './router';
import { DefaultShell } from './shell/default';
import { screenRegistry } from './screens/registry';

// Dynamic screen imports
import './screens/chat';
import './screens/arena';
import './screens/api-log';
import './screens/ledger';
import './screens/manifold';
import './screens/settings';

async function init() {
    try {
        console.log("🟢 [Boot] Initializing OS...");

        // 1. Lock in the Database
        await bootLedger();
        
        // 2. Lock in the Geometry (Loads Wasm)
        await bootAirlock();
        
        // 3. Lock in the Screens (Atomically)
        screenRegistry.beginUpdates();
        // The side-effect imports above have already called .register() silently.
        // We close the batch, instantly triggering the UI to become aware of them.
        screenRegistry.endUpdates();

        // 4. Mount the physical DOM
        document.body.style.margin = '0';
        document.body.style.backgroundColor = '#F7F5F0';
        document.body.innerHTML = ''; 
        
        const appRoot = document.createElement('div');
        appRoot.id = 'k4-app-root';
        appRoot.style.height = '100vh';
        appRoot.style.display = 'flex';
        appRoot.style.flexDirection = 'column';
        document.body.appendChild(appRoot);
        
        // 5. Hand over to the Router & Shell
        bootSystemOS(appRoot, DefaultShell);

    } catch (err) {
        console.error("🔴 [Boot] Fatal initialization error:", err);
    }
}
init();

