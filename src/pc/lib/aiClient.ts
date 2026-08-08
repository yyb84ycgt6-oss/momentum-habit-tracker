/**
 * Unified AI Client — the older call site, now on the gateway.
 *
 * This used to carry its own copy of the whole provider problem: five
 * hardcoded `callX` methods, keys read straight out of localStorage, and a
 * reactive fallback chain that only learned a provider was spent by failing
 * a request first. Five apps call `sendMessage`, so rather than edit them,
 * the body was replaced with one `chat()` through `lib/ai/gateway` — the
 * same move that put the ~25 `getAiClient` apps on the gateway.
 *
 * What survives is what the gateway does NOT do, and should not:
 *   • the Permission Broker gate — may this scope call a model at all,
 *   • the paid-provider gate — expressed as an exclusion the gateway honours
 *     BEFORE the call, rather than a refusal after money was already spent,
 *   • budget accounting, now recorded against the provider that actually
 *     answered instead of the one a router guessed would.
 *
 * Cost is estimated from characters, and says so. Providers report tokens
 * inconsistently or not at all, and a precise-looking number derived from a
 * guess is worse than an admitted estimate.
 */

import { modelRouter, type ModelProvider } from "./modelRouter";
import { permissions } from "./permissions";
import { budgetGuardian } from "./budgetGuardian";
import { chat, AllProvidersFailedError } from "./ai/gateway";
import { allProviders } from "./ai/catalog";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  content: string;
  /** The provider that actually answered. A plain string, because the
   *  gateway reaches 13 providers and `ModelProvider` only names five —
   *  casting "openrouter" into that union would be a comfortable lie. */
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  timestamp: number;
}

class AIClient {
  /**
   * Send a message and get a response.
   *
   * Provider selection, key rotation, cooldowns and fallback all live in the
   * gateway now. This method's remaining job is policy: who may call, what
   * they may spend, and recording what was spent.
   */
  async sendMessage(
    messages: AIMessage[],
    options: {
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      taskId?: string;
      /** App/agent identity used by the Permission Broker (defaults to 'system'). */
      scope?: string;
    } = {},
  ): Promise<AIResponse> {
    const scope = options.scope || "system";

    // Capability gate: is this app/agent allowed to call a model at all?
    if (!permissions.require(scope, "model_access", "aiClient.sendMessage")) {
      throw new Error(`Model access is disabled for "${scope}" in the Permission Broker.`);
    }

    // Paid providers are excluded up front rather than refused afterwards.
    // The old code checked one guessed provider and then let the fallback
    // chain reach a paid one anyway; an exclusion the gateway honours cannot
    // be routed around.
    const exclude = permissions.require(scope, "spend", "aiClient.sendMessage")
      ? []
      : allProviders()
          .filter((p) => p.tier === "paid")
          .map((p) => p.id);

    if (!budgetGuardian.canSpend(scope, 0)) {
      throw new Error(
        `Budget limit reached for "${scope}". Current month spend: $${budgetGuardian.getCurrentSpend(scope).toFixed(2)}`,
      );
    }
    if (budgetGuardian.isAutoStopActive(scope, 0)) {
      throw new Error(`Auto-stop active for "${scope}" — monthly budget exceeded.`);
    }

    const all: AIMessage[] = [];
    if (options.systemPrompt) all.push({ role: "system", content: options.systemPrompt });
    all.push(...messages);

    let result;
    try {
      result = await chat({
        messages: all,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        excludeProviders: exclude,
      });
    } catch (error) {
      // The gateway already tried every configured provider and key, so a
      // failure here is the real end of the road — report which ones were
      // tried instead of a bare "failed".
      if (error instanceof AllProvidersFailedError) {
        console.error("[AIClient] every provider failed:", error.attempts);
      }
      throw error;
    }

    // Character-based estimate, deliberately labelled as one. ~4 chars/token
    // is the usual rule of thumb across these tokenizers.
    const promptChars = all.reduce((n, m) => n + m.content.length, 0);
    const tokensUsed = Math.ceil((promptChars + result.text.length) / 4);
    const provider = result.provider;
    const cost = estimateCost(provider, tokensUsed);

    // modelRouter keeps stats only for the five providers it knows and
    // silently drops anything else, so only feed it what it can hold.
    // Every call — including the other eight providers — is already in
    // lib/ai/telemetry via the gateway, which is what Budget Radar reads.
    if (modelRouter.knowsProvider(provider)) {
      modelRouter.recordUsage(provider as ModelProvider, tokensUsed, cost);
    }
    budgetGuardian.recordSpend(scope, provider as ModelProvider, cost);

    return {
      content: result.text,
      provider,
      model: result.model,
      tokensUsed,
      cost,
      timestamp: Date.now(),
    };
  }
}

/** Rough per-1k-token prices. Free and local tiers cost nothing, and the
 *  gateway prefers them, so most calls land at zero. */
const PRICE_PER_1K: Record<string, number> = {
  anthropic: 0.008,
  openai: 0.005,
  xai: 0.0012,
  deepseek: 0.0003,
  mistral: 0.0006,
  together: 0.0009,
};

function estimateCost(providerId: string, tokens: number): number {
  return ((PRICE_PER_1K[providerId] ?? 0) * tokens) / 1000;
}

export const aiClient = new AIClient();
