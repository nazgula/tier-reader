import type { z } from "zod";

export interface ProviderCallOpts {
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  traceName?: string;
}

export interface Provider {
  /** Free-form text completion. */
  call(prompt: string, opts?: ProviderCallOpts): Promise<string>;
  /** Structured output validated against a Zod schema. */
  callStructured<T>(prompt: string, schema: z.ZodType<T>, opts?: ProviderCallOpts): Promise<T>;
}
