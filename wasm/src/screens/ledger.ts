// wasm/src/screens/ledger.ts

import { screenRegistry } from './registry';

// Note: Requires the legacy ledger to be appended to the container here.
// Currently serves as a routing stub while ledger logic migrates.
export function mountLedgerScreen(container: HTMLElement): () => void {
    const layout = document.createElement('div');
    layout.style.display = 'flex';
    layout.style.flexDirection = 'column';
    layout.style.height = '100%';
    
    layout.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px; flex: 0 0 auto;">
            <h2 style="margin: 0; color: #14161A;">Ledger</h2>
        </div>
        <div style="flex: 1; overflow-y: auto; background: #fff; border: 1px solid #DAD5CB; border-radius: 4px; padding: 15px;">
            <div style="color: #888; font-style: italic;">
                Ledger Screen (Pending Porting). Legacy Ledger UI still loads in background via ledger-ui.ts for now.
            </div>
        </div>
    `;
    
    container.appendChild(layout);

    return () => { container.innerHTML = ''; };
}

screenRegistry.register({
    id: 'ledger',
    label: 'Ledger',
    order: 40,
    mount: mountLedgerScreen
});
