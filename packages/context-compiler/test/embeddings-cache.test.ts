import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cachedEmbedder, type Embedder } from "../src/index.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ccache-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function counterEmbedder(): Embedder & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async embed(texts) {
      calls.push([...texts]);
      return texts.map((t) => [t.length, t.charCodeAt(0) || 0, 0]);
    },
  };
}

describe("cachedEmbedder", () => {
  it("delegates on a cold cache and persists results", async () => {
    const inner = counterEmbedder();
    const path = join(tmp, "embed.json");
    const cache = cachedEmbedder(inner, { path, namespace: "voyage-3-lite" });

    const out = await cache.embed(["alpha", "beta"]);
    expect(out).toHaveLength(2);
    expect(inner.calls).toHaveLength(1);
    expect(inner.calls[0]).toEqual(["alpha", "beta"]);
    expect(existsSync(path)).toBe(true);
  });

  it("serves cache hits on the second call", async () => {
    const inner = counterEmbedder();
    const path = join(tmp, "embed.json");
    const cache = cachedEmbedder(inner, { path, namespace: "ns" });

    await cache.embed(["alpha", "beta"]);
    await cache.embed(["alpha", "beta"]);
    expect(inner.calls).toHaveLength(1); // second call was a full hit
  });

  it("only delegates the missing texts on partial hits", async () => {
    const inner = counterEmbedder();
    const path = join(tmp, "embed.json");
    const cache = cachedEmbedder(inner, { path, namespace: "ns" });

    await cache.embed(["alpha"]);
    inner.calls.length = 0;

    const out = await cache.embed(["alpha", "gamma"]);
    expect(out).toHaveLength(2);
    expect(inner.calls).toHaveLength(1);
    expect(inner.calls[0]).toEqual(["gamma"]);
  });

  it("isolates by namespace", async () => {
    const inner = counterEmbedder();
    const path = join(tmp, "embed.json");
    const a = cachedEmbedder(inner, { path, namespace: "voyage-3-lite" });
    const b = cachedEmbedder(inner, { path, namespace: "voyage-3" });

    await a.embed(["alpha"]);
    await b.embed(["alpha"]);
    expect(inner.calls).toHaveLength(2); // different namespace ⇒ miss
  });

  it("survives a corrupt cache file by reinitializing", async () => {
    const path = join(tmp, "embed.json");
    const fs = await import("node:fs");
    fs.writeFileSync(path, "not json at all");
    const inner = counterEmbedder();
    const cache = cachedEmbedder(inner, { path, namespace: "ns" });
    const out = await cache.embed(["alpha"]);
    expect(out).toHaveLength(1);
    const after = JSON.parse(readFileSync(path, "utf8"));
    expect(after.version).toBe(1);
  });
});
