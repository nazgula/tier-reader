import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { decompose } from "../src/decompose.js";
import type { Provider } from "../src/provider/index.js";
import type { RawTree, Tree } from "../src/schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(resolve(here, "fixtures/medium-multi-section.txt"), "utf8");

/**
 * Test provider for medium-tier flow:
 * - if traceName === "decompose.medium.outline" → return one outline section per
 *   markdown heading found in the source.
 * - if traceName === "decompose" → return a one-root tree where the root's child
 *   is a single leaf carrying the whole input as detail (so the schema-validity
 *   invariant holds without needing a real LLM).
 */
function buildMediumProvider(): { provider: Provider; calls: { kind: string }[] } {
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
      const source = extractSource(prompt);
      if (trace === "decompose.medium.outline") {
        return schema.parse(buildOutlineFromHeadings(source));
      }
      // small-tier per-section call
      return schema.parse({
        roots: [
          {
            title: firstSentence(source),
            children: [{ title: firstSentence(source), detail: source }],
          },
        ],
      } satisfies RawTree);
    },
  };
  return { provider, calls };
}

function extractSource(prompt: string): string {
  const m = prompt.match(/<<<\n([\s\S]*?)\n>>>/);
  if (!m?.[1]) throw new Error("could not extract source from prompt");
  return m[1];
}

function buildOutlineFromHeadings(source: string): {
  sections: { title: string; anchor: string }[];
} {
  const headingRe = /^# .+$/gm;
  const matches = [...source.matchAll(headingRe)];
  if (matches.length === 0) {
    return { sections: [{ title: "Whole document", anchor: source.slice(0, 40) }] };
  }
  return {
    sections: matches.map((m) => {
      const headingLine = m[0];
      return { title: headingLine.replace(/^#+\s*/, ""), anchor: headingLine };
    }),
  };
}

function firstSentence(s: string): string {
  const t = s
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = t.match(/^[^.!?]+[.!?]/);
  return (m?.[0] ?? t).slice(0, 120);
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

describe("decompose() — medium tier", () => {
  it("dispatches to medium for the multi-section fixture and returns a valid tree", async () => {
    const { provider, calls } = buildMediumProvider();
    const tree = await decompose(fixture, { provider });

    // Outline call + one small-tier call per section
    expect(calls[0]!.kind).toBe("decompose.medium.outline");
    expect(calls.filter((c) => c.kind === "decompose").length).toBe(tree.rootIds.length);

    // Multiple top-level sections — outline produced > 1 section.
    expect(tree.rootIds.length).toBeGreaterThan(1);

    // Each top-level node has children (no premature leaves at depth 1).
    for (const rid of tree.rootIds) {
      const root = tree.nodes[rid]!;
      expect(root.hasChildren).toBe(true);
      expect((root.childIds ?? []).length).toBeGreaterThan(0);
    }

    // Structural ids are consistent.
    for (const id of Object.keys(tree.nodes)) {
      expect(id).toMatch(/^\d+(\.\d+)*$/);
    }
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

    // Source reconstruction (concat all leaf detail) covers the full fixture.
    const concat = leavesInOrder(tree).join("");
    expect(concat.length).toBeGreaterThanOrEqual(fixture.length - 5);
  });

  it("respects an explicit `tier: 'medium'` override on small inputs", async () => {
    const { provider, calls } = buildMediumProvider();
    const small = "# Foo\n\nLorem ipsum.\n\n# Bar\n\nDolor sit amet.\n";
    const tree = await decompose(small, { provider, tier: "medium" });
    expect(calls[0]!.kind).toBe("decompose.medium.outline");
    expect(tree.rootIds.length).toBe(2);
  });
});
