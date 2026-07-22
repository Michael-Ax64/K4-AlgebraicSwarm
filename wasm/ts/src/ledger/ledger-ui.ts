// wasm/ui/src/ledger/ledger-ui.ts

import { createEffect } from '../reactive';
import { 
  worldsGrid, levelsGrid, vocabGrid, circuitGrid, ledgerGrid, 
  selectedWorldId, selectedLevelId, activeTab, 
  addVocabTerm 
} from './grid-state';
import { vfsDb } from './fs';
import { K4Type, ElementRole, CircuitState } from './schema';

const sidebarEl = document.getElementById('ledger-sidebar')!;
const gridHeaderEl = document.getElementById('ledger-tabs')!;
const gridBodyEl = document.getElementById('ledger-grid-body')!;

// ─── Sidebar (Worlds & Levels) ──────────────────────────────
createEffect(() => {
  const worlds = worldsGrid.value;
  const levels = levelsGrid.value;
  const activeW = selectedWorldId.value;
  const activeL = selectedLevelId.value;

  sidebarEl.innerHTML = ''; 

  worlds.forEach(w => {
    const wDiv = document.createElement('div');
    wDiv.className = `world-item ${w.id === activeW ? 'active' : ''}`;
    wDiv.textContent = `🌍 ${w.name}`;
    wDiv.onclick = () => selectedWorldId.value = w.id;
    sidebarEl.appendChild(wDiv);

    if (w.id === activeW) {
      const lContainer = document.createElement('div');
      lContainer.className = 'level-container';
      levels.forEach(l => {
        const lDiv = document.createElement('div');
        lDiv.className = `level-item ${l.id === activeL ? 'active' : ''}`;
        lDiv.textContent = `↳ ${l.name}`;
        lDiv.onclick = (e) => {
          e.stopPropagation();
          selectedLevelId.value = l.id;
        };
        lContainer.appendChild(lDiv);
      });
      sidebarEl.appendChild(lContainer);
    }
  });
});

// ─── Tabs ──────────────────────────────────────────────────
createEffect(() => {
  const tab = activeTab.value;
  gridHeaderEl.innerHTML = `
    <button class="${tab === 'vocab' ? 'active' : ''}" onclick="window.setTab('vocab')">Vocabulary</button>
    <button class="${tab === 'circuit' ? 'active' : ''}" onclick="window.setTab('circuit')">Circuit</button>
    <button class="${tab === 'ledger' ? 'active' : ''}" onclick="window.setTab('ledger')">Ledger</button>
    <button class="${tab === 'settings' ? 'active' : ''}" onclick="window.setTab('settings')">Settings</button>
  `;
});

(window as any).setTab = (tab: 'vocab' | 'circuit' | 'ledger') => activeTab.value = tab;

// ─── Grid Body Router ──────────────────────────────────────
createEffect(() => {
  const tab = activeTab.value;
  gridBodyEl.innerHTML = '';

  if (!selectedLevelId.value) {
    gridBodyEl.innerHTML = '<div class="empty">Select a Level to view data.</div>';
    return;
  }

  if (tab === 'vocab') renderVocabGrid();
  else if (tab === 'circuit') renderCircuitWorkbench();
  else if (tab === 'ledger') renderLedgerGrid();
  else if (tab === 'settings') renderSettings();

});

// ... [renderSettings] ...

function renderSettings() {
  const activeW = activeWorldConfig.value;
  if (!activeW) return;

  const html = `
    <div class="circuit-card" style="max-width: 500px;">
      <h4>World API Configuration</h4>
      
      <label>Provider:</label><br>
      <select id="set-provider" onchange="window.saveSettings()">
        <option value="manual" ${activeW.apiProvider === 'manual' ? 'selected' : ''}>Manual (Copy/Paste)</option>
        <option value="openai" ${activeW.apiProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
        <option value="custom" ${activeW.apiProvider === 'custom' ? 'selected' : ''}>Custom / Local</option>
      </select>
      <br><br>

      <label>API Key:</label><br>
      <input type="password" id="set-key" value="${activeW.apiKey || ''}" onchange="window.saveSettings()">
      <br><br>

      <label>Base URL (Optional):</label><br>
      <input type="text" id="set-url" value="${activeW.apiBaseUrl || ''}" placeholder="https://api.openai.com/v1/chat/completions" onchange="window.saveSettings()">
    </div>
  `;
  gridBodyEl.innerHTML = html;
}


(window as any).saveSettings = async () => {
  const activeW = activeWorldConfig.value;
  if (!activeW) return;

  const updatedWorld = {
    ...activeW,
    apiProvider: (document.getElementById('set-provider') as HTMLSelectElement).value as any,
    apiKey: (document.getElementById('set-key') as HTMLInputElement).value,
    apiBaseUrl: (document.getElementById('set-url') as HTMLInputElement).value,
    updatedAt: Date.now()
  };

  await vfsDb.upsertWorld(updatedWorld);
  activeWorldConfig.value = updatedWorld; // Update local signal
};


// ... [renderVocabGrid and renderLedgerGrid] ...

function renderVocabGrid() {
  const table = document.createElement('table');
  table.innerHTML = `
    <tr>
      <th>Term (Noun)</th>
      <th>K4 Pole/Edge</th>
      <th>Role</th>
    </tr>
  `;
  
  vocabGrid.value.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${v.term}</td>
      <td><span class="badge pole-${v.k4Type}">${v.k4Type}</span></td>
      <td><span class="badge role-${v.role}">${v.role}</span></td>
    `;
    table.appendChild(tr);
  });

  // Add Row Input
  const trAdd = document.createElement('tr');
  trAdd.innerHTML = `
    <td><input type="text" id="new-vocab-term" placeholder="New Noun..."></td>
    <td>
      <select id="new-vocab-k4">
        <option value="P">P (Fire/Drive)</option>
        <option value="U">U (Air/Structure)</option>
        <option value="I">I (Water/Flow)</option>
        <option value="R">R (Earth/Ground)</option>
        <option value="P-U">P-U (Exteriorize)</option>
      </select>
    </td>
    <td>
      <select id="new-vocab-role">
        <option value="MATERIAL">MATERIAL</option>
        <option value="SPEC">SPEC</option>
        <option value="NIL">NIL</option>
      </select>
    </td>
    <td><button onclick="window.submitNewVocab()">Add</button></td>
  `;
  table.appendChild(trAdd);
  gridBodyEl.appendChild(table);
}

function renderLedgerGrid() {
  const table = document.createElement('table');
  table.innerHTML = `
    <tr>
      <th>Cycle.Seq</th>
      <th>Stance</th>
      <th>Health</th>
      <th>P</th>
      <th>U</th>
      <th>I</th>
      <th>R</th>
    </tr>
  `;
  
  ledgerGrid.value.forEach(l => {
    const snap = l.snapshotJson ? JSON.parse(l.snapshotJson) : {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.cycle}.${l.seq}</td>
      <td>${l.stance}</td>
      <td>${l.health}</td>
      <td class="state-${snap['P']?.state}">${snap['P']?.content || '-'}</td>
      <td class="state-${snap['U']?.state}">${snap['U']?.content || '-'}</td>
      <td class="state-${snap['I']?.state}">${snap['I']?.content || '-'}</td>
      <td class="state-${snap['R']?.state}">${snap['R']?.content || '-'}</td>
    `;
    table.appendChild(tr);
  });
  gridBodyEl.appendChild(table);
}


// ─── The Circuit Modeler ───────────────────────────────────

function renderCircuitWorkbench() {
  const circuits = circuitGrid.value;
  if (circuits.length === 0) {
    gridBodyEl.innerHTML = '<div class="empty">No circuits defined for this level.</div>';
    return;
  }

  const c = circuits[0];

  // Render the static HTML framework first. 
  // We attach IDs to the spans so we can mutate their text without destroying the DOM.
  const html = `
    <div class="circuit-dash">
      <div class="circuit-card">
        <h4>AC Inputs (Physical Substrate)</h4>
        
        <div class="slider-group">
          <label><span>Driving Freq (ω)</span> <span id="val-omega">${c.drivingOmega.toFixed(2)} rad/s</span></label>
          <input type="range" id="slider-omega" min="0.1" max="20" step="0.1" value="${c.drivingOmega}" 
                 oninput="window.calcAC()" onchange="window.saveAC('${c.id}')">
        </div>

        <div class="slider-group">
          <label><span>Resistance (R) - Ground</span> <span id="val-R">${c.resistanceR.toFixed(1)} Ω</span></label>
          <input type="range" id="slider-R" min="1" max="200" step="1" value="${c.resistanceR}" 
                 oninput="window.calcAC()" onchange="window.saveAC('${c.id}')">
        </div>

        <div class="slider-group">
          <label><span>Inductance (L) - Memory</span> <span id="val-L">${c.inductanceL.toFixed(1)} H</span></label>
          <input type="range" id="slider-L" min="1" max="200" step="1" value="${c.inductanceL}" 
                 oninput="window.calcAC()" onchange="window.saveAC('${c.id}')">
        </div>

        <div class="slider-group">
          <label><span>Capacitance (C) - Tension</span> <span id="val-C">${c.capacitanceC.toFixed(3)} F</span></label>
          <input type="range" id="slider-C" min="0.001" max="0.5" step="0.001" value="${c.capacitanceC}" 
                 oninput="window.calcAC()" onchange="window.saveAC('${c.id}')">
        </div>
      </div>

      <div class="circuit-card">
        <h4>Topological Readout</h4>
        <div class="metric-row"><span>Reactance (X_L - X_C)</span> <span id="out-X">0.00 Ω</span></div>
        <div class="metric-row"><span>Total Impedance (|Z|)</span> <span id="out-Z">0.00 Ω</span></div>
        <div class="metric-row"><span>Phase Angle (θ)</span> <span id="out-theta">0.00°</span></div>
        <div class="metric-row"><span>Power Factor (cos θ)</span> <span id="out-pf">0.000</span></div>
        <br>
        <div class="metric-row"><span>Resonant Freq (ω₀)</span> <span id="out-omega0">0.00 rad/s</span></div>
        <div class="metric-row"><span>Quality Factor (Q)</span> <span id="out-qfactor">0.00</span></div>

        <div id="diag-box" class="diagnostic-alert"></div>
      </div>
    </div>
  `;

  gridBodyEl.innerHTML = html;
  
  // Run the math once to populate the initial state
  (window as any).calcAC();
}

// ─── Local Math Calculator (Fires on Drag) ───
(window as any).calcAC = () => {
  const omega = parseFloat((document.getElementById('slider-omega') as HTMLInputElement).value);
  const R = parseFloat((document.getElementById('slider-R') as HTMLInputElement).value);
  const L = parseFloat((document.getElementById('slider-L') as HTMLInputElement).value);
  const C = parseFloat((document.getElementById('slider-C') as HTMLInputElement).value);

  // Update Input Labels
  document.getElementById('val-omega')!.textContent = `${omega.toFixed(2)} rad/s`;
  document.getElementById('val-R')!.textContent = `${R.toFixed(1)} Ω`;
  document.getElementById('val-L')!.textContent = `${L.toFixed(1)} H`;
  document.getElementById('val-C')!.textContent = `${C.toFixed(3)} F`;

  // Perform AC Math
  const X_L = omega * L;
  const X_C = 1 / (omega * C);
  const X = X_L - X_C;
  const Z = Math.sqrt(R * R + X * X);
  const thetaRad = Math.atan2(X, R);
  const thetaDeg = thetaRad * (180 / Math.PI);
  const PF = Math.cos(thetaRad);
  const omega_0 = 1 / Math.sqrt(L * C);
  const qFactor = (1 / R) * Math.sqrt(L / C);

  // Update Output Labels
  document.getElementById('out-X')!.textContent = `${X.toFixed(2)} Ω`;
  document.getElementById('out-Z')!.textContent = `${Z.toFixed(2)} Ω`;
  document.getElementById('out-theta')!.textContent = `${thetaDeg.toFixed(2)}°`;
  document.getElementById('out-pf')!.textContent = PF.toFixed(3);
  document.getElementById('out-omega0')!.textContent = `${omega_0.toFixed(2)} rad/s`;
  document.getElementById('out-qfactor')!.textContent = qFactor.toFixed(2);

  // Diagnostics Update
  const diagBox = document.getElementById('diag-box')!;
  diagBox.className = 'diagnostic-alert'; // reset classes
  if (Math.abs(thetaDeg) < 5) {
    diagBox.classList.add('diag-resonance');
    diagBox.textContent = 'RESONANCE ACHIEVED. Markov Blanket is transparent. Optimal Trajectory Contact.';
  } else if (thetaDeg > 5) {
    diagBox.classList.add('diag-lagging');
    diagBox.textContent = `TORSIONAL SHEAR (Lagging). Dominated by Inductive Memory. High I²R exhaust.`;
  } else {
    diagBox.classList.add('diag-leading');
    diagBox.textContent = `TORSIONAL SHEAR (Leading). Paralyzed by Capacitive Anticipation. High Q circulation.`;
  }
};

// ─── Database Commit (Fires on Mouse Release) ───
import { vfsDb } from './fs';
(window as any).saveAC = async (circuitId: string) => {
  const circuits = circuitGrid.value;
  if (circuits.length === 0) return;
  
  const updatedCircuit = { 
    ...circuits[0], 
    drivingOmega: parseFloat((document.getElementById('slider-omega') as HTMLInputElement).value),
    resistanceR: parseFloat((document.getElementById('slider-R') as HTMLInputElement).value),
    inductanceL: parseFloat((document.getElementById('slider-L') as HTMLInputElement).value),
    capacitanceC: parseFloat((document.getElementById('slider-C') as HTMLInputElement).value)
  };
  
  await vfsDb.upsertCircuitState(updatedCircuit);
  // We do not force circuitGrid.value replacement here to prevent unnecessary DOM destruction,
  // as the visual state is already perfectly synced by calcAC().
};



// Helper to handle slider drag and save to DB
(window as any).updateCircuit = async (cycleId: number, field: keyof CircuitState, value: string) => {
  const circuits = circuitGrid.value;
  if (circuits.length === 0) return;
  
  const updatedCircuit = { ...circuits[0], [field]: parseFloat(value) };
  await vfsDb.upsertCircuitState(updatedCircuit);
  
  // Force reactivity reload
  circuitGrid.value = [updatedCircuit];
};

