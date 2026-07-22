// wasm/ts/src/ledger/ledger-ui.ts
import { createEffect } from '../reactive';
import {
  worldsGrid, levelsGrid, vocabGrid, circuitGrid, ledgerGrid, corpusGrid,
  selectedWorldId, selectedLevelId, activeTab, activeWorldConfig, LedgerTab,
  addVocabTerm, addCorpusDoc, deleteCorpusDoc
} from './grid-state';
import { vfsDb } from './fs';
import { K4Type, ElementRole } from './schema';

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
    el('option', { value: 'openai', textContent: 'OpenAI', selected: activeW.apiProvider === 'openai' }),
    el('option', { value: 'custom', textContent: 'Custom / Local', selected: activeW.apiProvider === 'custom' })
  ]);
  
  const keyInput = el('input', { type: 'password', value: activeW.apiKey || '' });
  const urlInput = el('input', { type: 'text', value: activeW.apiBaseUrl || '', placeholder: 'https://api.openai.com/v1/chat/completions' });
  
  const saveBtn = el('button', { textContent: 'Save Configuration' });
  saveBtn.addEventListener('click', async () => {
    const updatedWorld = {
      ...activeW,
      apiProvider: providerSelect.value as any,
      apiKey: keyInput.value,
      apiBaseUrl: urlInput.value,
      updatedAt: Date.now()
    };
    await vfsDb.upsertWorld(updatedWorld);
    activeWorldConfig.value = updatedWorld;
  });

  card.append(
    el('h4', { textContent: 'World API Configuration' }),
    el('label', { textContent: 'Provider:' }), el('br'), providerSelect, el('br'), el('br'),
    el('label', { textContent: 'API Key:' }), el('br'), keyInput, el('br'), el('br'),
    el('label', { textContent: 'Base URL (Optional):' }), el('br'), urlInput, el('br'), el('br'),
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

  table.appendChild(el('tr', {}, [
    el('td', {}, [termInput]), el('td', {}, [k4Select]), el('td', {}, [roleSelect]), el('td', {}, [addBtn])
  ]));

  gridBodyEl.appendChild(table);
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

function renderCircuitWorkbench() {
  const circuits = circuitGrid.value;
  if (circuits.length === 0) { 
    gridBodyEl.appendChild(el('div', { className: 'empty', textContent: 'No circuits defined.' })); 
    return; 
  }
  
  const c = circuits[0];
  
  // Safe HTML template for the static parts
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
        <br>
        <div class="metric-row"><span>Resonant Freq (ω₀)</span> <span id="out-omega0">0.00 rad/s</span></div>
        <div class="metric-row"><span>Quality Factor (Q)</span> <span id="out-qfactor">0.00</span></div>
        <div id="diag-box" class="diagnostic-alert"></div>
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
    document.getElementById('out-omega0')!.textContent = `${(1 / Math.sqrt(L * C)).toFixed(2)} rad/s`;
    document.getElementById('out-qfactor')!.textContent = ((1 / R) * Math.sqrt(L / C)).toFixed(2);
    
    const diagBox = document.getElementById('diag-box')!;
    diagBox.className = 'diagnostic-alert';
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

  const saveAC = async () => {
    if (circuitGrid.value.length === 0) return;
    await vfsDb.upsertCircuitState({
      ...circuitGrid.value[0],
      drivingOmega: parseFloat(omegaS.input.value),
      resistanceR: parseFloat(rS.input.value),
      inductanceL: parseFloat(lS.input.value),
      capacitanceC: parseFloat(cS.input.value)
    });
  };

  [omegaS, rS, lS, cS].forEach(s => {
    s.input.addEventListener('input', calcAC);
    s.input.addEventListener('change', saveAC);
  });

  calcAC(); // Init calculation
}
