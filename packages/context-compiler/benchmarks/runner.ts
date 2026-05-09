import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export interface LLMRunOpts {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
}

export interface LLMRunResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMRunner {
  run(opts: LLMRunOpts): Promise<LLMRunResult>;
}

const DEFAULT_AGENT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_JUDGE_MODEL = "claude-sonnet-4-6-20251022";

export interface AnthropicRunnerOpts {
  apiKey?: string;
  defaultModel?: string;
}

export function anthropicRunner(opts: AnthropicRunnerOpts = {}): LLMRunner {
  const anthropic = createAnthropic({
    apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY,
  });
  const defaultModel = opts.defaultModel ?? DEFAULT_AGENT_MODEL;

  return {
    async run({ systemPrompt, userPrompt, model, temperature = 0 }) {
      const result = await generateText({
        model: anthropic(model ?? defaultModel),
        system: systemPrompt,
        prompt: userPrompt,
        temperature,
      });
      // CodeRabbit: AI SDK v4 uses promptTokens/completionTokens; the
      // inputTokens/outputTokens names belong to v5 and would silently read
      // undefined here. Verified against ai@4.3.19 type defs.
      return {
        text: result.text,
        inputTokens: result.usage?.promptTokens ?? 0,
        outputTokens: result.usage?.completionTokens ?? 0,
      };
    },
  };
}

export const BENCH_MODELS = {
  agent: DEFAULT_AGENT_MODEL,
  judge: DEFAULT_JUDGE_MODEL,
};
