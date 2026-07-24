// wasm/src/screens/languages.ts

import { createEffect } from '../reactive';
import { screenRegistry } from './registry';
import { vocabGrid, selectedLanguageId, languagesGrid, activeWorldConfig, addVocabTerm } from '../ledger/grid-state';
import { autoMapDomain } from '../ledger/ontology-compiler';
import { h } from '../dom';

export function mountLanguagesScreen(container: HTMLElement): () => void {
    const layout = h('div', { style: 'padding: 20px; height: 100%; display: flex; flex-direction: column;' });
    container.appendChild(layout);

    createEffect(() => {
        const lId = selectedLanguageId.value;
        const level = languagesGrid.value.find(l => l.id === lId);
        layout.replaceChildren();

        if (!level) {
            layout.appendChild(h('div', { 
                style: 'margin: auto; color: var(--text-muted); font-style: italic; text-align: center;',
                textContent: '🔒 Select a Language from the context pane to manage its Lexicon.'
            }));
            return;
        }

        const header = h('div', { style: 'border-bottom: 1px solid var(--border-strong); padding-bottom: 10px; margin-bottom: 20px;' },
            h('h2', { style: 'margin: 0; color: var(--text-primary);', textContent: `📖 Lexicon: ${level.name}` })
        );

        // --- VOCABULARY TABLE ---
        const table = h('table', { className: 'numbers-table', style: 'margin-bottom: 20px;' });
        table.appendChild(h('thead', {}, h('tr', {}, 
            h('th', { textContent: 'Term (Noun)' }), h('th', { textContent: 'K4 Pole' }), h('th', { textContent: 'Role' })
        )));
        const tbody = h('tbody');
        vocabGrid.value.forEach(v => {
            tbody.appendChild(h('tr', {}, 
                h('td', { textContent: v.term }),
                h('td', {}, h('span', { className: `badge pole-${v.k4Type}`, textContent: v.k4Type })),
                h('td', {}, h('span', { className: `badge role-${v.role}`, textContent: v.role }))
            ));
        });
        table.appendChild(tbody);

        // --- AUTO-MAP WORKSPACE ---
        const autoMapCard = h('div', { style: 'background: var(--bg-surface); border: 1px solid var(--border-strong); padding: 15px; border-radius: 6px;' },
            h('h4', { textContent: 'Auto-Map via Algebraic Sweeps', style: 'margin-top: 0; color: var(--role-bridge);' }),
            h('p', { style: 'color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 15px;', textContent: 'Enter 4 raw domain concepts. The machine will test them against the 12 equations to determine the exact P, U, I, R topology.' })
        );

        const rawInput = h('input', { placeholder: 'e.g. Plot, Character, Dialogue, Pacing', style: 'width: 100%; max-width: 400px; margin-right: 10px;' });
        const mapBtn = h('button', { textContent: 'Run Test-Cycle', className: 'k4-btn-primary' });
        const auditLog = h('div', { style: 'display: none; margin-top: 15px; font-family: var(--font-mono); font-size: 0.85rem; padding: 10px; border-radius: 4px;' });

        mapBtn.addEventListener('click', async () => {
            const terms = rawInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
            if (terms.length !== 4) return alert("Please provide exactly 4 comma-separated terms.");
            
            mapBtn.disabled = true; mapBtn.textContent = 'Running Sweeps...';
            auditLog.style.display = 'block'; auditLog.className = 'diagnostic-alert';
            auditLog.textContent = 'Executing 6-cell swap test across the Linear, Leverage, and Friction planes...';

            try {
                const result = await autoMapDomain(activeWorldConfig.value!, terms);
                auditLog.className = 'diagnostic-alert diag-resonance';
                auditLog.innerHTML = `<strong>Anchor Fixed:</strong> ${result.anchor.term} -> ${result.anchor.pole}<br><br><strong>Resolution:</strong> ${result.resolution}`;
                
                // Save terms to DB and trigger reactive refresh
                for (const [pole, term] of Object.entries(result.finalMapping)) {
                    await addVocabTerm(term, pole as any, pole === 'P' || pole === 'R' ? 'SPEC' : 'MATERIAL');
                }
                const lId = selectedLanguageId.value;
                selectedLanguageId.value = null; 
                setTimeout(() => selectedLanguageId.value = lId, 50); // Hard refresh
                
                mapBtn.textContent = 'Mapping Complete';
            } catch (err: any) {
                auditLog.className = 'diagnostic-alert diag-lagging';
                auditLog.textContent = `Algebraic Sweep Failed: ${err.message}`;
                mapBtn.disabled = false; mapBtn.textContent = 'Run Test-Cycle';
            }
        });

        autoMapCard.append(h('div', { style: 'display: flex; gap: 10px;' }, rawInput, mapBtn), auditLog);
        layout.append(header, table, autoMapCard);
    });

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({ id: 'languages', label: 'Languages', order: 12, mount: mountLanguagesScreen });

