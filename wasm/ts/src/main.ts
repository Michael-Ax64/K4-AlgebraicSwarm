// wasm/ui/src/main.ts

import { bootLedger } from './ledger/grid-state';
import './ui';
import './ledger/ledger-ui';

async function init() {
  console.log("🟢 [Boot] Initializing K4-Manifold Semantic OS...");
  await bootLedger();
  console.log("🟢 [Boot] Ledger initialized. Airlock active.");
}

init().catch(err => console.error("🔴 [Boot] Fatal initialization error:", err));
