// wasm/src/config.ts
//
// Source-interface for src/config.json. Exposes the LLM provider catalog
// as signals, matching the reactive convention used everywhere else. No
// operator UI touches config.json directly — the Settings screen picks a
// default from the catalog and Worlds inherit or override.

import { Signal } from './reactive';

export type Transport = 'openai-chat' | 'window-ai';

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  transport: Transport;
  endpoint: string | null;
  model: string | null;
  temperature: { text: number; json: number } | null;
  supportsJsonMode: boolean;
  requiresApiKey: boolean;
  notes?: string;
}

export interface ConfigShape {
  providers: ProviderCatalogEntry[];
  defaultProviderId: string;
}

// Signals — every consumer reads .value or subscribes via createEffect.
export const providers         = new Signal<ProviderCatalogEntry[]>([]);
export const catalogDefaultId  = new Signal<string>('');

/** Called once from main.ts before bootLedger / bootAirlock. */
export function bootConfig(data: ConfigShape): void {
  providers.value        = data.providers;
  catalogDefaultId.value = data.defaultProviderId;
}

/** Lookup by catalog id. Returns null when the id isn't in the catalog. */
export function getProvider(id: string): ProviderCatalogEntry | null {
  return providers.peek().find(p => p.id === id) ?? null;
}

/**
 * The effective global default. SystemSettings.defaultProviderId (operator
 * choice, persisted to IndexedDB) takes precedence; config.json's
 * defaultProviderId is the fallback shipped in source.
 *
 * Caller passes the SystemSettings signal's peeked value so this module
 * stays free of ledger imports (avoids circular deps).
 */
export function getEffectiveDefaultProviderId(operatorChoice?: string): string {
  return (operatorChoice && operatorChoice.length > 0)
    ? operatorChoice
    : catalogDefaultId.peek();
}
