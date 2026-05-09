import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Embedder } from "../types.js";

export interface CacheOpts {
  /** Path to the JSON cache file. Parent dir is created if missing. */
  path: string;
  /** Cache namespace — typically the model name, mixed into the key. */
  namespace: string;
}

interface CacheBlob {
  version: 1;
  entries: Record<string, number[]>;
}

/**
 * Wraps an embedder with a content-hash JSON cache. Keys are
 * `<namespace>:<sha256(text)>`. Misses call the inner embedder; the cache
 * file is rewritten on each miss-batch (atomic via tmp + rename would be
 * nicer; for benchmarks the simple write is fine).
 */
export function cachedEmbedder(inner: Embedder, opts: CacheOpts): Embedder {
  const blob = loadOrInit(opts.path);

  return {
    async embed(texts: string[]): Promise<number[][]> {
      const keys = texts.map((t) => keyFor(opts.namespace, t));
      const out: (number[] | undefined)[] = keys.map((k) => blob.entries[k]);

      const missIdx: number[] = [];
      const missTexts: string[] = [];
      out.forEach((v, i) => {
        if (!v) {
          missIdx.push(i);
          missTexts.push(texts[i] as string);
        }
      });

      if (missTexts.length > 0) {
        const fresh = await inner.embed(missTexts);
        if (fresh.length !== missTexts.length) {
          throw new Error(
            `cachedEmbedder: inner returned ${fresh.length} vectors for ${missTexts.length} inputs`,
          );
        }
        missIdx.forEach((idx, j) => {
          const vec = fresh[j];
          if (!vec) return;
          out[idx] = vec;
          blob.entries[keys[idx] as string] = vec;
        });
        persist(opts.path, blob);
      }

      return out.map((v, i) => {
        if (!v) throw new Error(`cachedEmbedder: missing vector at index ${i}`);
        return v;
      });
    },
  };
}

function keyFor(namespace: string, text: string): string {
  const h = createHash("sha256").update(text).digest("hex");
  return `${namespace}:${h}`;
}

function loadOrInit(path: string): CacheBlob {
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as CacheBlob;
      if (parsed.version === 1 && parsed.entries) return parsed;
    } catch {
      // fall through to fresh init
    }
  }
  return { version: 1, entries: {} };
}

function persist(path: string, blob: CacheBlob): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(blob));
}
