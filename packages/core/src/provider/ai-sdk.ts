import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import type { z } from "zod";
import { withTrace } from "../trace.js";
import type { Provider, ProviderCallOpts } from "./index.js";

export interface AiSdkProviderOpts {
  apiKey?: string;
  defaultModel?: string;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function aiSdkProvider(opts: AiSdkProviderOpts = {}): Provider {
  const anthropic = createAnthropic({
    apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY,
  });
  const defaultModel = opts.defaultModel ?? DEFAULT_MODEL;

  return {
    async call(prompt: string, callOpts: ProviderCallOpts = {}) {
      const model = callOpts.model ?? defaultModel;
      return withTrace(
        { name: callOpts.traceName ?? "provider.call", model, input: prompt },
        async () => {
          const { text } = await generateText({
            model: anthropic(model),
            prompt,
            temperature: callOpts.temperature ?? 0,
            abortSignal: callOpts.signal,
          });
          return text;
        },
      );
    },

    async callStructured<T>(
      prompt: string,
      schema: z.ZodType<T>,
      callOpts: ProviderCallOpts = {},
    ): Promise<T> {
      const model = callOpts.model ?? defaultModel;
      return withTrace(
        {
          name: callOpts.traceName ?? "provider.callStructured",
          model,
          input: prompt,
        },
        async () => {
          const { object } = await generateObject({
            model: anthropic(model),
            prompt,
            schema,
            temperature: callOpts.temperature ?? 0,
            abortSignal: callOpts.signal,
          });
          return object;
        },
      );
    },
  };
}
