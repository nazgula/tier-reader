import type { Embedder } from "../types.js";

export interface VoyageOpts {
  apiKey?: string;
  model?: string;
  /** Override the endpoint for testing. */
  endpoint?: string;
  /** Override fetch (defaults to global fetch). */
  fetchImpl?: typeof fetch;
  /** Optional input type tag — Voyage supports "query" | "document". */
  inputType?: "query" | "document";
}

const DEFAULT_MODEL = "voyage-3-lite";
const DEFAULT_ENDPOINT = "https://api.voyageai.com/v1/embeddings";

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
}

/**
 * Voyage embeddings adapter. Honors `VOYAGE_API_KEY` from env unless overridden.
 * Calls Voyage's HTTP API directly — Vercel's AI SDK does not ship an official
 * Voyage adapter, so we keep this as a thin fetch with no extra dep.
 */
export function voyageEmbedder(opts: VoyageOpts = {}): Embedder {
  const apiKey = opts.apiKey ?? process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("voyageEmbedder: VOYAGE_API_KEY is not set");
  }
  const model = opts.model ?? DEFAULT_MODEL;
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = opts.fetchImpl ?? fetch;

  return {
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const body: Record<string, unknown> = { input: texts, model };
      if (opts.inputType) body.input_type = opts.inputType;

      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`voyageEmbedder: ${res.status} ${res.statusText} ${text}`);
      }
      const json = (await res.json()) as VoyageResponse;
      if (json.data.length !== texts.length) {
        throw new Error(
          `voyageEmbedder: expected ${texts.length} embeddings, got ${json.data.length}`,
        );
      }
      const sorted = [...json.data].sort((a, b) => a.index - b.index);
      return sorted.map((d) => d.embedding);
    },
  };
}
