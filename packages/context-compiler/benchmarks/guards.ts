import type { Embedder } from "../src/index.js";
import type { LLMRunResult, LLMRunner } from "./runner.js";

/**
 * Hard token-budget guards. Default caps cover a comfortably-sized run with
 * ~10x headroom over the actual benchmark estimate. The whole point is "next
 * call throws" — partial results.json is preserved for resume.
 */
export const DEFAULT_BUDGETS = {
  /** Aggregate input tokens across all LLM agent + judge calls. */
  llmInputTokens: 5_000_000,
  /** Aggregate output tokens across all LLM agent + judge calls. */
  llmOutputTokens: 2_000_000,
  /** Voyage tokens (estimated as ceil(chars/4)). */
  embedderTokens: 200_000,
} as const;

export interface BudgetedRunnerOpts {
  maxInputTokens?: number;
  maxOutputTokens?: number;
  /** Called whenever a call lands. Useful for live logging. */
  onSpend?: (totals: { inputTokens: number; outputTokens: number }) => void;
}

export class TokenBudgetExceededError extends Error {
  constructor(
    public readonly kind: "llm-input" | "llm-output" | "embedder",
    public readonly used: number,
    public readonly cap: number,
  ) {
    super(`${kind} budget exceeded: used ${used} >= cap ${cap}`);
    this.name = "TokenBudgetExceededError";
  }
}

/**
 * Wraps an LLMRunner with a hard token cap. The next call after the cap is
 * crossed throws; in-flight calls already counted are preserved.
 */
export function budgetedRunner(inner: LLMRunner, opts: BudgetedRunnerOpts = {}): LLMRunner {
  const maxIn = opts.maxInputTokens ?? DEFAULT_BUDGETS.llmInputTokens;
  const maxOut = opts.maxOutputTokens ?? DEFAULT_BUDGETS.llmOutputTokens;
  let usedIn = 0;
  let usedOut = 0;

  return {
    async run(runOpts): Promise<LLMRunResult> {
      if (usedIn >= maxIn) throw new TokenBudgetExceededError("llm-input", usedIn, maxIn);
      if (usedOut >= maxOut) throw new TokenBudgetExceededError("llm-output", usedOut, maxOut);
      const res = await inner.run(runOpts);
      usedIn += res.inputTokens;
      usedOut += res.outputTokens;
      opts.onSpend?.({ inputTokens: usedIn, outputTokens: usedOut });
      return res;
    },
  };
}

export interface BudgetedEmbedderOpts {
  maxTokens?: number;
  /** Token estimator for input strings. Default: ceil(chars/4). */
  tokenEstimate?: (text: string) => number;
  onSpend?: (used: number) => void;
}

/**
 * Wraps an Embedder with a hard token cap. Tokens are pre-estimated from input
 * char length so we can reject *before* the API call rather than after — which
 * matters because Voyage doesn't return per-call usage in the shape we parse.
 */
export function budgetedEmbedder(inner: Embedder, opts: BudgetedEmbedderOpts = {}): Embedder {
  const max = opts.maxTokens ?? DEFAULT_BUDGETS.embedderTokens;
  const estimate = opts.tokenEstimate ?? ((s: string) => Math.ceil(s.length / 4));
  let used = 0;

  return {
    async embed(texts: string[]): Promise<number[][]> {
      const batch = texts.reduce((sum, t) => sum + estimate(t), 0);
      if (used + batch > max) {
        throw new TokenBudgetExceededError("embedder", used + batch, max);
      }
      const out = await inner.embed(texts);
      used += batch;
      opts.onSpend?.(used);
      return out;
    },
  };
}
