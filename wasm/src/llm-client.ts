// wasm/src/llm-client.ts

import { WorldSettings } from './ledger/schema';
import {
  ProviderCatalogEntry,
  getProvider,
  getEffectiveDefaultProviderId,
} from './config';

import { systemSettings } from './ledger/grid-state';

/**
 * Resolve which provider a world should use. Rules:
 *   - world.apiProvider === 'manual' → null (bridge.ts routes to manual paste)
 *   - world.apiProvider === '' or 'default' → global default (systemSettings
 *     override, falling back to config.json's defaultProviderId)
 *   - otherwise → treat world.apiProvider as a catalog id
 *   - unknown catalog id → null (bridge.ts routes to manual paste)
 */

export function resolveProviderForWorld(world: WorldSettings): ProviderCatalogEntry | null {
  if (world.apiProvider === 'manual') return null;

  const operatorDefault = systemSettings.peek()?.defaultProviderId;
  const providerId =
    (world.apiProvider && world.apiProvider !== 'default')
      ? world.apiProvider
      : getEffectiveDefaultProviderId(operatorDefault);

  return getProvider(providerId);
}

export async function callBuiltInAPI(
  world: WorldSettings,
  prompt: string,
  jsonMode: boolean = false,
  signal?: AbortSignal
): Promise<string> {
  const provider = resolveProviderForWorld(world);
  if (!provider) {
    throw new Error("No provider resolved for this world. Manual paste path.");
  }

  switch (provider.transport) {
    case 'openai-chat':
      return callOpenAIChat(provider, world, prompt, jsonMode, signal);
    case 'window-ai':
      return callWindowAI(provider, prompt, jsonMode, signal);
    default: {
      const _exhaustive: never = provider.transport;
      throw new Error(`Transport '${_exhaustive}' declared in catalog but not implemented.`);
    }
  }
}

// ── Transports ─────────────────────────────────────────────────────────────

async function callOpenAIChat(
  provider: ProviderCatalogEntry,
  world: WorldSettings,
  prompt: string,
  jsonMode: boolean,
  signal?: AbortSignal
): Promise<string> {
  const endpoint = world.apiBaseUrl || provider.endpoint;
  if (!endpoint) {
    throw new Error(`Provider '${provider.id}' has no endpoint.`);
  }
  if (provider.requiresApiKey && !world.apiKey) {
    throw new Error(`Provider '${provider.id}' requires an API key on the world.`);
  }

  const temp =
    provider.temperature
      ? (jsonMode ? provider.temperature.json : provider.temperature.text)
      : (jsonMode ? 0.1 : 0.3);

  const body: any = {
    model: provider.model,
    messages: [{ role: 'system', content: prompt }],
    temperature: temp,
  };
  if (jsonMode && provider.supportsJsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (world.apiKey) headers['Authorization'] = `Bearer ${world.apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`API Request Failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callWindowAI(
  _provider: ProviderCatalogEntry,
  prompt: string,
  jsonMode: boolean,
  signal?: AbortSignal
): Promise<string> {
  const w = window as any;
  if (!('ai' in window) || !w.ai?.languageModel) {
    throw new Error("Chrome On-Device AI is not available in this browser. Enable chrome://flags/#optimization-guide-on-device-model.");
  }
  if (signal?.aborted) throw new Error("Request cancelled by operator.");

  const session = await w.ai.languageModel.create({
    systemPrompt: jsonMode ? "Output valid JSON only." : "You are the K4 Manifold Semantic OS."
  });
  try {
    return await session.prompt(prompt);
  } finally {
    session.destroy?.();
  }
}

