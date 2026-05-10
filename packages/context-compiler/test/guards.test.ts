import { describe, expect, it } from "vitest";
import {
  TokenBudgetExceededError,
  budgetedEmbedder,
  budgetedRunner,
} from "../benchmarks/guards.js";
import type { LLMRunner } from "../benchmarks/runner.js";
import type { Embedder } from "../src/index.js";

function fakeRunner(per: { in: number; out: number } = { in: 100, out: 50 }): LLMRunner {
  return {
    async run() {
      return { text: "ok", inputTokens: per.in, outputTokens: per.out };
    },
  };
}

describe("budgetedRunner", () => {
  it("passes calls through and tallies tokens", async () => {
    const seen: { inputTokens: number; outputTokens: number }[] = [];
    const r = budgetedRunner(fakeRunner(), {
      maxInputTokens: 1000,
      maxOutputTokens: 500,
      onSpend: (t) => seen.push(t),
    });
    await r.run({ systemPrompt: "x", userPrompt: "y" });
    await r.run({ systemPrompt: "x", userPrompt: "y" });
    expect(seen).toEqual([
      { inputTokens: 100, outputTokens: 50 },
      { inputTokens: 200, outputTokens: 100 },
    ]);
  });

  it("throws TokenBudgetExceededError once the input cap is crossed", async () => {
    const r = budgetedRunner(fakeRunner({ in: 600, out: 10 }), {
      maxInputTokens: 1000,
      maxOutputTokens: 1_000_000,
    });
    await r.run({ systemPrompt: "x", userPrompt: "y" });
    await r.run({ systemPrompt: "x", userPrompt: "y" });
    await expect(r.run({ systemPrompt: "x", userPrompt: "y" })).rejects.toBeInstanceOf(
      TokenBudgetExceededError,
    );
  });

  it("throws on output cap independently", async () => {
    const r = budgetedRunner(fakeRunner({ in: 1, out: 600 }), {
      maxInputTokens: 1_000_000,
      maxOutputTokens: 1000,
    });
    await r.run({ systemPrompt: "x", userPrompt: "y" });
    await r.run({ systemPrompt: "x", userPrompt: "y" });
    await expect(r.run({ systemPrompt: "x", userPrompt: "y" })).rejects.toThrow(
      /llm-output budget/,
    );
  });
});

describe("budgetedEmbedder", () => {
  function fakeEmbedder(): Embedder {
    return {
      async embed(texts) {
        return texts.map(() => [0]);
      },
    };
  }

  it("rejects *before* calling the inner embedder when the batch overshoots", async () => {
    let called = false;
    const inner: Embedder = {
      async embed(texts) {
        called = true;
        return texts.map(() => [0]);
      },
    };
    const e = budgetedEmbedder(inner, { maxTokens: 5 });
    // Estimator default = ceil(chars/4); a 100-char string is 25 tokens, > cap.
    await expect(e.embed(["x".repeat(100)])).rejects.toBeInstanceOf(TokenBudgetExceededError);
    expect(called).toBe(false);
  });

  it("permits batches that fit under the cap", async () => {
    const e = budgetedEmbedder(fakeEmbedder(), { maxTokens: 100 });
    const out = await e.embed(["short", "also-short"]);
    expect(out).toHaveLength(2);
  });
});
