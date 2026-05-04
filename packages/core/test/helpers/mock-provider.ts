import type { z } from "zod";
import type { Provider } from "../../src/provider/index.js";
import type { RawTree } from "../../src/schema.js";

function extractSource(prompt: string): string {
  const m = prompt.match(/<<<\n([\s\S]*?)\n>>>/);
  if (!m?.[1]) throw new Error("mock: could not extract source from prompt");
  return m[1];
}

export function mockProvider(canned: Map<string, RawTree>): Provider {
  return {
    async call() {
      throw new Error("mock: text call not implemented");
    },
    async callStructured<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
      const source = extractSource(prompt);
      const out = canned.get(source);
      if (!out) {
        throw new Error(
          `mock: no canned output for source starting with "${source.slice(0, 80)}..."`,
        );
      }
      return schema.parse(out);
    },
  };
}
