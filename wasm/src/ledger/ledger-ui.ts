// wasm/ts/src/ledger/ledger-ui.ts
import { createEffect } from '../reactive';
import {
  worldsGrid, levelsGrid, vocabGrid, circuitGrid, ledgerGrid, corpusGrid,
  selectedWorldId, selectedLevelId, activeTab, activeWorldConfig, LedgerTab,
  addVocabTerm, addCorpusDoc, deleteCorpusDoc
} from './grid-state';

import { vfsDb } from './fs';
import { K4Type, ElementRole } from './schema';
import { autoMapDomain, compileOntology, buildOntologyPrompt, parseAndSaveOntology } from './ontology-compiler';


function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in DOM`);
  return el as T;
}

const sidebarEl = requireEl('ledger-sidebar');
const gridHeaderEl = requireEl('ledger-tabs');
const gridBodyEl = requireEl('ledger-grid-body');

// Helper for XSS-safe DOM node creation
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { dataset?: Record<string, string> } = {},
  children: (string | Node)[] = []
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'dataset' && value) {
      for (const [dKey, dVal] of Object.entries(value)) {
        element.dataset[dKey] = dVal as string;
      }
    } else {
      (element as any)[key] = value;
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }
  return element;
}

createEffect(() => {
  const worlds = worldsGrid.value;
  const levels = levelsGrid.value;
  const activeW = selectedWorldId.value;
  const activeL = selectedLevelId.value;
  sidebarEl.innerHTML = '';
  
  worlds.forEach(w => {
    const wDiv = el('div', { className: `world-item ${w.id === activeW ? 'active' : ''}`, textContent: `🌍 ${w.name}` });
    wDiv.addEventListener('click', () => { selectedWorldId.value = w.id; });
    sidebarEl.appendChild(wDiv);
    
    if (w.id === activeW) {
      const lContainer = el('div', { className: 'level-container' });
      levels.forEach(l => {
        const lDiv = el('div', { className: `level-item ${l.id === activeL ? 'active' : ''}`, textContent: `↳ ${l.name}` });
        lDiv.addEventListener('click', (e) => { e.stopPropagation(); selectedLevelId.value = l.id; });
        lContainer.appendChild(lDiv);
      });
      sidebarEl.appendChild(lContainer);
    }
  });
});

createEffect(() => {
  const tab = activeTab.value;
  gridHeaderEl.innerHTML = '';
  
  const tabs: { id: LedgerTab, label: string }[] = [
    { id: 'vocab', label: 'Vocabulary' },
    { id: 'corpus', label: 'Corpus' },
    { id: 'circuit', label: 'Circuit' },
    { id: 'ledger', label: 'Ledger' },
    { id: 'settings', label: 'Settings' }
  ];

  tabs.forEach(t => {
    const btn = el('button', { textContent: t.label, className: tab === t.id ? 'active' : '' });
    btn.addEventListener('click', () => { activeTab.value = t.id; });
    gridHeaderEl.appendChild(btn);
  });
});

createEffect(() => {
  const tab = activeTab.value;
  gridBodyEl.innerHTML = '';
  
  if ((tab === 'vocab' || tab === 'circuit' || tab === 'ledger') && !selectedLevelId.value) {
    gridBodyEl.appendChild(el('div', { className: 'empty', textContent: 'Select a Level to view data.' }));
    return;
  }
  
  if (tab === 'vocab') renderVocabGrid();
  else if (tab === 'corpus') renderCorpusManager();
  else if (tab === 'circuit') renderCircuitWorkbench();
  else if (tab === 'ledger') renderLedgerGrid();
  else if (tab === 'settings') renderSettings();
});


function renderSettings() {
    const activeW = activeWorldConfig.value;
    if (!activeW) return;

    const card = el('div', { className: 'circuit-card' });
    card.style.maxWidth = '500px';

    const providerSelect = el('select', {}, [
        el('option', { value: 'manual', textContent: 'Manual (Copy/Paste)', selected: activeW.apiProvider === 'manual' }),
        el('option', { value: 'auto', textContent: 'Auto (Built-in AI / Local)', selected: activeW.apiProvider === 'auto' }),
        el('option', { value: 'openai', textContent: 'OpenAI', selected: activeW.apiProvider === 'openai' }),
        el('option', { value: 'custom', textContent: 'Custom / Local', selected: activeW.apiProvider === 'custom' })
    ]);

    const keyInput = el('input', { type: 'password', value: activeW.apiKey || '' });
    const urlInput = el('input', { type: 'text', value: activeW.apiBaseUrl || '', placeholder: 'https://api.openai.com/v1/chat/completions' });
    
    // Global Corpus Persistence Toggle
    const persistCheck = el('input', { type: 'checkbox', checked: activeW.persistCorpus });
    const persistLabel = el('label', { textContent: ' Persist Corpus Documents to IndexedDB' });
    persistLabel.style.cursor = 'pointer';
    persistLabel.addEventListener('click', () => { persistCheck.checked = !persistCheck.checked; });

    const saveBtn = el('button', { textContent: 'Save Configuration' });
    saveBtn.addEventListener('click', async () => {
        const updatedWorld = {
            ...activeW,
            apiProvider: providerSelect.value as any,
            apiKey: keyInput.value,
            apiBaseUrl: urlInput.value,
            persistCorpus: persistCheck.checked,
            updatedAt: Date.now()
        };
        await vfsDb.upsertWorld(updatedWorld);
        activeWorldConfig.value = updatedWorld;
        alert('Configuration saved.');
    });

    card.append(
        el('h4', { textContent: 'World API Configuration' }),
        el('label', { textContent: 'Provider:' }), el('br'), providerSelect, el('br'), el('br'),
        el('label', { textContent: 'API Key:' }), el('br'), keyInput, el('br'), el('br'),
        el('label', { textContent: 'Base URL (Optional):' }), el('br'), urlInput, el('br'), el('br'),
        el('hr'),
        el('h4', { textContent: 'Thermodynamic Environment' }),
        el('div', { style: 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;' }, [persistCheck, persistLabel]),
        saveBtn
    );
    gridBodyEl.appendChild(card);
}


function renderVocabGrid() {
  const table = el('table');
  const trHead = el('tr', {}, [
    el('th', { textContent: 'Term (Noun)' }), el('th', { textContent: 'K4 Pole/Edge' }), el('th', { textContent: 'Role' }), el('th')
  ]);
  table.appendChild(trHead);
  
  vocabGrid.value.forEach(v => {
    table.appendChild(el('tr', {}, [
      el('td', { textContent: v.term }),
      el('td', {}, [ el('span', { className: `badge pole-${v.k4Type}`, textContent: v.k4Type }) ]),
      el('td', {}, [ el('span', { className: `badge role-${v.role}`, textContent: v.role }) ]),
      el('td')
    ]));
  });

  const termInput = el('input', { type: 'text', placeholder: 'New Noun...' });
  const k4Select = el('select', {}, [
    el('option', { value: 'P', textContent: 'P (Fire/Drive)' }),
    el('option', { value: 'U', textContent: 'U (Air/Structure)' }),
    el('option', { value: 'I', textContent: 'I (Water/Flow)' }),
    el('option', { value: 'R', textContent: 'R (Earth/Ground)' }),
    el('option', { value: 'P-U', textContent: 'P-U (Exteriorize)' })
  ]);
  const roleSelect = el('select', {}, [
    el('option', { value: 'MATERIAL', textContent: 'MATERIAL' }),
    el('option', { value: 'SPEC', textContent: 'SPEC' }),
    el('option', { value: 'NIL', textContent: 'NIL' })
  ]);
  
  const addBtn = el('button', { textContent: 'Add' });
  addBtn.addEventListener('click', async () => {
    const term = termInput.value.trim();
    if (term) await addVocabTerm(term, k4Select.value as K4Type, roleSelect.value as ElementRole);
  });

  // table.appendChild(el('tr', {}, [
  //   el('td', {}, [termInput]), el('td', {}, [k4Select]), el('td', {}, [roleSelect]), el('td', {}, [addBtn])
  // ]));

  // gridBodyEl.appendChild(table);

  
  // Auto-Map Workspace
  const autoMapContainer = el('div', { className: 'circuit-card', style: 'margin-top: 2rem;' }, [
    el('h4', { textContent: 'Auto-Map via Algebraic Sweeps' }),
    el('p', { className: 'subtext', textContent: 'Enter 4 raw domain concepts. The machine will test them against the 12 equations (grouped by x + [0,3,6,9]) to determine the exact P, U, I, R topology.' })
  ]);

  const rawInput = el('input', { type: 'text', placeholder: 'e.g. Plot, Character, Dialogue, Pacing', style: 'width: 70%; margin-right: 1rem;' });
  const mapBtn = el('button', { textContent: 'Run Test-Cycle' });
  const auditLog = el('div', { className: 'diagnostic-alert', style: 'display: none; margin-top: 1rem; font-family: monospace; font-size: 0.85rem;' });

  mapBtn.addEventListener('click', async () => {
    const terms = rawInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (terms.length !== 4) {
      alert("Please provide exactly 4 comma-separated terms.");
      return;
    }

    mapBtn.disabled = true;
    mapBtn.textContent = 'Running Sweeps...';
    auditLog.style.display = 'block';
    auditLog.className = 'diagnostic-alert';
    auditLog.textContent = 'Executing 6-cell swap test across the Linear, Leverage, and Friction planes...';

    try {
      const result = await autoMapDomain(activeWorldConfig.value!, terms);
      
      // Render the Algebraic Proof
      auditLog.classList.add('diag-resonance'); // Green highlight
      auditLog.innerHTML = `
        <strong>Anchor Fixed:</strong> ${result.anchor.term} -> ${result.anchor.pole} (${result.anchor.reason})<br><br>
        <strong>Testing Contested Swap:</strong> ${result.contestedSwap.termA} vs ${result.contestedSwap.termB}<br>
        - <em>Sweep 1 (x=1, Linear):</em> ${result.sweepAudit.sweep1_Linear}<br>
        - <em>Sweep 2 (x=2, Leverage):</em> ${result.sweepAudit.sweep2_Leverage}<br>
        - <em>Sweep 3 (x=3, Friction):</em> ${result.sweepAudit.sweep3_Friction}<br><br>
        <strong>Resolution:</strong> ${result.resolution}<br><br>
        <strong>Final Mapping:</strong> P=${result.finalMapping.P}, U=${result.finalMapping.U}, I=${result.finalMapping.I}, R=${result.finalMapping.R}
      `;

      // Save the mapped terms directly to the VFS
      for (const [pole, term] of Object.entries(result.finalMapping)) {
        await addVocabTerm(term, pole as any, pole === 'P' || pole === 'R' ? 'SPEC' : 'MATERIAL');
      }

      mapBtn.textContent = 'Mapping Complete';
    } catch (err: any) {
      auditLog.classList.add('diag-lagging'); // Red highlight
      auditLog.textContent = `Algebraic Sweep Failed: ${err.message}`;
      mapBtn.disabled = false;
      mapBtn.textContent = 'Run Test-Cycle';
    }
  });

  autoMapContainer.append(rawInput, mapBtn, auditLog);
  gridBodyEl.appendChild(autoMapContainer);
}

function renderLedgerGrid() {
  const table = el('table');
  table.appendChild(el('tr', {}, [
    el('th', { textContent: 'Cycle.Seq' }), el('th', { textContent: 'Stance' }), el('th', { textContent: 'Health' }),
    el('th', { textContent: 'P' }), el('th', { textContent: 'U' }), el('th', { textContent: 'I' }), el('th', { textContent: 'R' })
  ]));
  
  ledgerGrid.value.forEach(l => {
    const snap = l.snapshotJson ? JSON.parse(l.snapshotJson) : {};
    table.appendChild(el('tr', {}, [
      el('td', { textContent: `${l.cycle}.${l.seq}` }),
      el('td', { textContent: l.stance }),
      el('td', { textContent: l.health }),
      el('td', { className: `state-${snap['P']?.state}`, textContent: snap['P']?.content || '-' }),
      el('td', { className: `state-${snap['U']?.state}`, textContent: snap['U']?.content || '-' }),
      el('td', { className: `state-${snap['I']?.state}`, textContent: snap['I']?.content || '-' }),
      el('td', { className: `state-${snap['R']?.state}`, textContent: snap['R']?.content || '-' })
    ]));
  });
  gridBodyEl.appendChild(table);
}

function renderCorpusManager() {
  const docs = corpusGrid.value;
  const container = el('div', { className: 'corpus-manager' });
  
  container.append(
    el('h4', { textContent: 'World Corpus Documents (D1..N)' }),
    el('p', { className: 'subtext', textContent: 'Attached to the Validator\'s Markov Blanket alongside Document 0.' })
  );

  const listEl = el('div');
  if (docs.length === 0) {
    listEl.appendChild(el('div', { className: 'empty', textContent: 'No corpus documents attached.' }));
  } else {
    docs.forEach(doc => {
      const rmBtn = el('button', { className: 'remove-corpus-btn', textContent: '✕ Remove' });
      rmBtn.addEventListener('click', () => deleteCorpusDoc(doc.id));
      
      const header = el('div', { className: 'corpus-header' }, [ el('strong', { textContent: doc.name }), rmBtn ]);
      const preview = el('pre', { className: 'corpus-preview', textContent: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : '') });
      listEl.appendChild(el('div', { className: 'corpus-row' }, [ header, preview ]));
    });
  }
  container.appendChild(listEl);

  const nameInput = el('input', { type: 'text', placeholder: 'Document Name (e.g., API_Specs.md)' });
  const contentInput = el('textarea', { placeholder: 'Document content...' });
  const addBtn = el('button', { textContent: 'Attach Document' });
  addBtn.addEventListener('click', () => {
    if (nameInput.value.trim() && contentInput.value.trim()) {
      addCorpusDoc(nameInput.value.trim(), contentInput.value.trim());
      nameInput.value = ''; contentInput.value = '';
    }
  });

  container.appendChild(el('div', { className: 'corpus-add-form' }, [ nameInput, contentInput, addBtn ]));
  gridBodyEl.appendChild(container);
}

//

function renderCircuitWorkbench() {
  const circuits = circuitGrid.value;
  
  if (circuits.length === 0) { 
    const emptyState = el('div', { className: 'circuit-card', style: 'max-width: 800px; margin: 0 auto;' });
    emptyState.appendChild(el('h4', { textContent: 'No Topology Compiled' }));
    emptyState.appendChild(el('p', { className: 'subtext', textContent: 'The vocabulary is defined. The Algebra must now unfold the 12-facet possibility space.' }));
    
    const isManual = activeWorldConfig.value?.apiProvider === 'manual';

    if (isManual) {
      // THE MANUAL "BRING YOUR OWN LLM" WORKFLOW
      emptyState.appendChild(el('p', { textContent: 'Manual Mode is active. Copy this prompt to an external LLM (e.g., ChatGPT or Claude), then paste the JSON response below:', style: 'margin-top: 1rem; color: #a3a3a3;' }));
      
      const promptStr = buildOntologyPrompt(vocabGrid.value);
      const promptArea = el('textarea', { readOnly: true, value: promptStr, style: 'width: 100%; height: 120px; font-family: monospace; font-size: 0.85rem; margin-bottom: 0.5rem;' });
      
      const copyBtn = el('button', { textContent: '📋 Copy Prompt' });
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(promptStr);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = '📋 Copy Prompt', 2000);
      });

      const pasteArea = el('textarea', { placeholder: 'Paste the generated JSON here...', style: 'width: 100%; height: 120px; font-family: monospace; font-size: 0.85rem; margin-top: 1rem; margin-bottom: 0.5rem;' });
      const errorMsg = el('p', { className: 'diagnostic-alert diag-leading', style: 'display: none;' });

      const saveBtn = el('button', { textContent: 'Parse & Save Topology' });
      saveBtn.addEventListener('click', async () => {
        if (!pasteArea.value.trim()) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Processing...';
        errorMsg.style.display = 'none';

        try {
          await parseAndSaveOntology(selectedLevelId.value!, pasteArea.value);
          // Force reload to pull new circuits
          const lId = selectedLevelId.value;
          selectedLevelId.value = null; 
          setTimeout(() => selectedLevelId.value = lId, 50);
        } catch (err: any) {
          errorMsg.textContent = `Invalid JSON or Parsing Error: ${err.message}`;
          errorMsg.style.display = 'block';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Parse & Save Topology';
        }
      });

      emptyState.append(promptArea, copyBtn, pasteArea, errorMsg, saveBtn);

    } else {
      // THE AUTOMATED API WORKFLOW
      const compileBtn = el('button', { textContent: 'Compile 12-Fold Ontology' });
      const errorMsg = el('p', { className: 'diagnostic-alert diag-lagging', style: 'display: none; margin-top: 1rem;' });

      compileBtn.addEventListener('click', async () => {
        compileBtn.textContent = 'Compiling Topology (Please Wait)...';
        compileBtn.disabled = true;
        errorMsg.style.display = 'none';

        try {
          await compileOntology(selectedLevelId.value!, activeWorldConfig.value!, vocabGrid.value);
          const lId = selectedLevelId.value;
          selectedLevelId.value = null; 
          setTimeout(() => selectedLevelId.value = lId, 50); 
        } catch (err: any) {
          errorMsg.textContent = err.message;
          errorMsg.style.display = 'block';
          compileBtn.textContent = 'Compile 12-Fold Ontology';
          compileBtn.disabled = false;
        }
      });

      emptyState.append(compileBtn, errorMsg);
    }
    
    gridBodyEl.appendChild(emptyState);
    return; 
  }
  
  const c = circuits[0]; // Active circuit loaded into workbench
  
  gridBodyEl.innerHTML = `
    <div class="circuit-dash">
      <div class="circuit-card" id="ac-inputs">
        <h4>AC Inputs (Physical Substrate)</h4>
      </div>
      <div class="circuit-card">
        <h4>Topological Readout</h4>
        <div class="metric-row"><span>Reactance (X_L - X_C)</span> <span id="out-X">0.00 Ω</span></div>
        <div class="metric-row"><span>Total Impedance (|Z|)</span> <span id="out-Z">0.00 Ω</span></div>
        <div class="metric-row"><span>Phase Angle (θ)</span> <span id="out-theta">0.00°</span></div>
        <div class="metric-row"><span>Power Factor (cos θ)</span> <span id="out-pf">0.000</span></div>
        <div id="diag-box" class="diagnostic-alert"></div>
      </div>
      <div class="circuit-card" id="semantic-payload" style="grid-column: 1 / -1;">
        <h4>Semantic Phenomenological State</h4>
        <h3 id="sem-name" style="margin: 0.5rem 0; color: var(--p-color);">${c.name}</h3>
        <p class="subtext"><strong>Diagnostic Signatures:</strong> <span id="sem-vocab">${c.diagnosticVocab?.join(', ') || ''}</span></p>
        <div class="prompt-workspace" style="display: block; margin-top: 1rem;">
          <strong>Reward Function (Diagnostic Question):</strong><br>
          <em id="sem-reward">${c.rewardQuestion || ''}</em>
        </div>
      </div>
    </div>
  `;

  const inputContainer = document.getElementById('ac-inputs')!;
  
  const makeSlider = (id: string, label: string, min: string, max: string, step: string, val: number, unit: string) => {
    const valSpan = el('span', { id: `val-${id}`, textContent: `${val.toFixed(id === 'C' ? 3 : (id === 'omega' ? 2 : 1))} ${unit}` });
    const lbl = el('label', {}, [ el('span', { textContent: label }), valSpan ]);
    const input = el('input', { type: 'range', id: `slider-${id}`, min, max, step, value: val.toString() });
    return { group: el('div', { className: 'slider-group' }, [ lbl, input ]), input, valSpan };
  };

  const omegaS = makeSlider('omega', 'Driving Freq (ω)', '0.1', '20', '0.1', c.drivingOmega, 'rad/s');
  const rS = makeSlider('R', 'Resistance (R) - Ground', '1', '200', '1', c.resistanceR, 'Ω');
  const lS = makeSlider('L', 'Inductance (L) - Memory', '1', '200', '1', c.inductanceL, 'H');
  const cS = makeSlider('C', 'Capacitance (C) - Tension', '0.001', '0.5', '0.001', c.capacitanceC, 'F');
  
  inputContainer.append(omegaS.group, rS.group, lS.group, cS.group);

  const calcAC = () => {
    const omega = parseFloat(omegaS.input.value);
    const R = parseFloat(rS.input.value);
    const L = parseFloat(lS.input.value);
    const C = parseFloat(cS.input.value);
    
    omegaS.valSpan.textContent = `${omega.toFixed(2)} rad/s`;
    rS.valSpan.textContent = `${R.toFixed(1)} Ω`;
    lS.valSpan.textContent = `${L.toFixed(1)} H`;
    cS.valSpan.textContent = `${C.toFixed(3)} F`;
    
    const X = (omega * L) - (1 / (omega * C));
    const Z = Math.sqrt(R * R + X * X);
    const thetaRad = Math.atan2(X, R);
    const thetaDeg = thetaRad * (180 / Math.PI);
    
    document.getElementById('out-X')!.textContent = `${X.toFixed(2)} Ω`;
    document.getElementById('out-Z')!.textContent = `${Z.toFixed(2)} Ω`;
    document.getElementById('out-theta')!.textContent = `${thetaDeg.toFixed(2)}°`;
    document.getElementById('out-pf')!.textContent = Math.cos(thetaRad).toFixed(3);
    
    const diagBox = document.getElementById('diag-box')!;
    diagBox.className = 'diagnostic-alert';

    // UI Logic to snap to the closest algebraic Circuit based on sliders
    // This connects the AC parameters back to the generated JSON!
    let activeIndex = 0; // Default to 1. Synthesis
    if (thetaDeg > 70 && R > 80 && omega < 2) activeIndex = 9;       // 10. Impedance (Analysis Paralysis)
    else if (thetaDeg > 45 && R > 40 && omega > 10) activeIndex = 2; // 3. Momentum (Brute Force)
    else if (thetaDeg < -45 && R > 100) activeIndex = 11;            // 12. Brittleness (Burnout)
    else if (Math.abs(thetaDeg) < 5) activeIndex = 5;                // 6. Resonance

    // Update the Semantic Payload display dynamically
    const activeCircuit = circuits[activeIndex] || circuits[0];
    document.getElementById('sem-name')!.textContent = activeCircuit.name;
    document.getElementById('sem-vocab')!.textContent = activeCircuit.diagnosticVocab?.join(', ') || '';
    document.getElementById('sem-reward')!.textContent = activeCircuit.rewardQuestion || '';

    if (Math.abs(thetaDeg) < 5) {
      diagBox.classList.add('diag-resonance');
      diagBox.textContent = 'RESONANCE ACHIEVED. Markov Blanket transparent.';
    } else if (thetaDeg > 5) {
      diagBox.classList.add('diag-lagging');
      diagBox.textContent = `TORSIONAL SHEAR (Lagging). Inductive Memory dominant.`;
    } else {
      diagBox.classList.add('diag-leading');
      diagBox.textContent = `TORSIONAL SHEAR (Leading). Capacitive Anticipation dominant.`;
    }
  };

  [omegaS, rS, lS, cS].forEach(s => {
    s.input.addEventListener('input', calcAC);
  });

  calcAC();
}
