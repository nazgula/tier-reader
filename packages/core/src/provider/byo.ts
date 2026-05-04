import type { z } from "zod";
import { withTrace } from "../trace.js";
import type { Provider, ProviderCallOpts } from "./index.js";

export interface ByoProviderOpts {
  call: (prompt: string, opts?: ProviderCallOpts) => Promise<string>;
  defaultModel?: string;
}

/**
 * Wraps a user-supplied call() into a Provider. Structured calls fall back to
 * JSON.parse + Zod validation on the model's text output.
 */
export function byoProvider(opts: ByoProviderOpts): Provider {
  return {
    async call(prompt, callOpts = {}) {
      return withTrace(
        {
          name: callOpts.traceName ?? "provider.call",
          model: callOpts.model ?? opts.defaultModel,
          input: prompt,
        },
        () => opts.call(prompt, callOpts),
      );
    },
    async callStructured<T>(
      prompt: string,
      schema: z.ZodType<T>,
      callOpts: ProviderCallOpts = {},
    ): Promise<T> {
      return withTrace(
        {
          name: callOpts.traceName ?? "provider.callStructured",
          model: callOpts.model ?? opts.defaultModel,
          input: prompt,
        },
        async () => {
          const text = await opts.call(prompt, callOpts);
          const parsed = extractJson(text);
          return schema.parse(parsed);
        },
      );
    },
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip markdown fences if present.
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) return JSON.parse(fenced[1]);
    // Last-ditch: find first { ... last }.
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error("BYO provider response is not valid JSON");
  }
}
