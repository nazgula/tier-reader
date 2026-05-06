import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { chunkByStructure } from "../src/chunk.js";
import { decompose } from "../src/decompose.js";
import type { Provider } from "../src/provider/index.js";
import type { RawTree, Tree } from "../src/schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(resolve(here, "fixtures/wikipedia-50k.txt"), "utf8");

function buildLargeProvider(): {
  provider: Provider;
  calls: { kind: string }[];
} {
  const calls: { kind: string }[] = [];
  const provider: Provider = {
    async call() {
      throw new Error("not used");
    },
    async callStructured<T>(
      prompt: string,
      schema: z.ZodType<T>,
      o?: { traceName?: string },
    ): Promise<T> {
      const trace = o?.traceName ?? "";
      calls.push({ kind: trace });

      if (trace === "decompose.large.synthesis") {
        // Parse chunk-titles from the prompt and group into 3 merged sections.
        const lines = prompt.split("\n").filter((l) => /^\[\d+\] /.test(l));
        const total = lines.length;
        const third = Math.max(1, Math.ceil(total / 3));
        const ranges: number[][] = [];
        for (let i = 0; i < total; i += third) {
          const slice: number[] = [];
          for (let j = i; j < Math.min(i + third, total); j++) slice.push(j);
          ranges.push(slice);
        }
        return schema.parse({
          sections: ranges.map((indices, i) => ({
            title: `Merged section ${i + 1}`,
            rootIndices: indices,
          })),
        });
      }

      // Per-chunk small-tier call: produce a single-root tree carrying the chunk
      // verbatim as one leaf (so source-reconstruction holds).
      const source = extractSource(prompt);
      return schema.parse({
        roots: [
          {
            title: firstHeading(source) ?? "Untitled chunk",
            children: [{ title: "Verbatim", detail: source }],
          },
        ],
      } satisfies RawTree);
    },
  };
  return { provider, calls };
}

function extractSource(prompt: string): string {
  const m = prompt.match(/<<<\n([\s\S]*?)\n>>>/);
  if (!m?.[1]) throw new Error("could not extract source");
  return m[1];
}

function firstHeading(s: string): string | null {
  const m = s.match(/^#{1,6}\s+(.+)$/m);
  return m?.[1] ?? null;
}

function leavesInOrder(tree: Tree): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    const n = tree.nodes[id]!;
    if (!n.hasChildren) {
      if (n.detail !== undefined) out.push(n.detail);
      return;
    }
    for (const c of n.childIds ?? []) visit(c);
  };
  for (const r of tree.rootIds) visit(r);
  return out;
}

describe("chunkByStructure()", () => {
  it("splits the 50KB Wikipedia fixture on markdown headings", () => {
    const chunks = chunkByStructure(fixture);
    expect(chunks.length).toBeGreaterThan(1);
    // contiguous coverage
    expect(chunks[0]!.sourceStart).toBe(0);
    expect(chunks[chunks.length - 1]!.sourceEnd).toBe(fixture.length);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.sourceStart).toBe(chunks[i - 1]!.sourceEnd);
    }
    // text fields concatenate to the original
    expect(chunks.map((c) => c.text).join("")).toBe(fixture);
  });

  it("falls back to paragraph packing when no headings are present", () => {
    const noHeadings = "Lorem ipsum dolor.\n\nSit amet consectetur.\n\nAdipiscing elit sed.\n";
    const chunks = chunkByStructure(noHeadings);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.map((c) => c.text).join("")).toBe(noHeadings);
  });
});

describe("decompose() — large tier", () => {
  it("with synthesisMerge: true produces a single cohesive top-level outline", async () => {
    const { provider, calls } = buildLargeProvider();
    const tree = await decompose(fixture, { provider, synthesisMerge: true });

    // One synthesis call + N chunk calls.
    expect(calls.some((c) => c.kind === "decompose.large.synthesis")).toBe(true);
    const chunkCalls = calls.filter((c) => c.kind === "decompose").length;
    expect(chunkCalls).toBeGreaterThan(1);

    // Top level: 3 merged sections (matches buildLargeProvider's synthesis stub).
    expect(tree.rootIds.length).toBeLessThanOrEqual(7);
    expect(tree.rootIds.length).toBeGreaterThanOrEqual(1);

    // Schema validity: id format + parent/child consistency
    for (const id of Object.keys(tree.nodes)) expect(id).toMatch(/^\d+(\.\d+)*$/);
    for (const node of Object.values(tree.nodes)) {
      if (node.hasChildren) {
        for (const cid of node.childIds!) {
          const child = tree.nodes[cid];
          expect(child).toBeDefined();
          expect(child!.parentId).toBe(node.id);
          expect(child!.depth).toBe(node.depth + 1);
        }
      }
    }

    // Source-reconstruction invariant: concatenated leaf details equal the source.
    expect(leavesInOrder(tree).join("")).toBe(fixture);
  });

  it("with synthesisMerge: false produces N chunk roots under a synthetic root", async () => {
    const { provider, calls } = buildLargeProvider();
    const tree = await decompose(fixture, { provider, synthesisMerge: false });

    // No synthesis call this time.
    expect(calls.some((c) => c.kind === "decompose.large.synthesis")).toBe(false);

    // Top level is exactly one synthetic root.
    expect(tree.rootIds.length).toBe(1);
    const root = tree.nodes[tree.rootIds[0]!]!;
    expect(root.hasChildren).toBe(true);
    const chunkCount = chunkByStructure(fixture).length;
    expect((root.childIds ?? []).length).toBe(chunkCount);

    expect(leavesInOrder(tree).join("")).toBe(fixture);
  });
});
