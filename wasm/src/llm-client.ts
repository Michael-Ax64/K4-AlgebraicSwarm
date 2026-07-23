// wasm/ts/src/llm-client.ts
import { World } from './ledger/schema';

export async function callBuiltInAPI(world: World, prompt: string, jsonMode: boolean = false): Promise<string> {
    if (world.apiProvider === 'manual') {
        throw new Error("Manual mode selected.");
    }

    // 1. The Network Route: If an API key is explicitly provided, use it.
    if (world.apiKey) {
        const url = world.apiBaseUrl || "https://api.openai.com/v1/chat/completions";
        const headers: Record<string, string> = { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${world.apiKey}` 
        };
        const body: any = {
            model: world.apiProvider === 'openai' ? "gpt-4o" : "local-model",
            messages: [{ role: "system", content: prompt }],
            temperature: jsonMode ? 0.1 : 0.3
        };
        if (jsonMode && world.apiProvider === 'openai') {
            body.response_format = { type: "json_object" };
        }
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`API Request Failed: ${res.status}`);
        const data = await res.json();
        return data.choices[0].message.content;
    }

    // 2. The On-Device Route: Chrome's Built-in AI (window.ai)
    if ('ai' in window && (window as any).ai?.languageModel) {
        const session = await (window as any).ai.languageModel.create({
            systemPrompt: jsonMode ? "Output valid JSON only." : "You are the K4 Manifold Semantic OS."
        });
        const res = await session.prompt(prompt);
        session.destroy();
        return res;
    }

    // 3. Fallback: No key, no built-in AI -> throw to trigger manual copy/paste
    throw new Error("No API key provided and Built-in AI is unavailable.");
}
