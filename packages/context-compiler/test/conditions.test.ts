import type { Tree } from "@tier-reader/core";
import { describe, expect, it } from "vitest";
import type { Embedder } from "../src/index.js";
import { ROSTER_3 } from "../benchmarks/agents.js";
import { buildSlices } from "../benchmarks/conditions.js";
import { buildTree, fixedEmbedder } from "./helpers.js";

const TREE: Tree = buildTree({
  title: "Multi-topic",
  children: [
    {
      title: "Mobile checkout duplicate render",
      tags: ["frontend", "ui"],
      children: [{ title: "Lighthouse drop on /checkout" }],
    },
    {
      title: "POST /v1/refunds endpoint spec",
      tags: ["backend", "api"],
      children: [{ title: "Idempotency on (order_id, reason_code)" }],
    },
    {
      title: "Help-center FAQ on partial refunds",
      tags: ["support", "faq"],
      children: [{ title: "Eventual consistency window" }],
    },
  ],
});

const SOURCE = "the original message verbatim";
const SUMMARY = "two-hundred-token summary stub";

const EMBED = fixedEmbedder({
  // agent descriptions (full text from agents.ts)
  [ROSTER_3[0]?.description ?? ""]: [1, 0, 0],
  [ROSTER_3[1]?.description ?? ""]: [0, 1, 0],
  [ROSTER_3[2]?.description ?? ""]: [0, 0, 1],
  // subtree titles
  "Mobile checkout duplicate render": [0, 1, 0],
  "POST /v1/refunds endpoint spec": [1, 0, 0],
  "Help-center FAQ on partial refunds": [0, 0, 1],
});

const CTX = {
  sourceMessage: SOURCE,
  tree: TREE,
  roster: ROSTER_3,
  embedder: EMBED as Embedder,
  budget: 500,
  dacsSummary: SUMMARY,
};

describe("buildSlices", () => {
  it("flat-broadcast hands every agent the full source", async () => {
    const slices = await buildSlices("flat-broadcast", CTX);
    expect(slices).toHaveLength(3);
    for (const s of slices) expect(s.text).toBe(SOURCE);
  });

  it("dacs-focus gives full source only to the highest-similarity agent", async () => {
    const slices = await buildSlices("dacs-focus", CTX);
    const focus = slices.filter((s) => s.text === SOURCE);
    const summarized = slices.filter((s) => s.text === SUMMARY);
    expect(focus).toHaveLength(1);
    expect(summarized).toHaveLength(2);
  });

  it("tier-hybrid produces non-empty slices for matching agents only", async () => {
    const slices = await buildSlices("tier-hybrid", CTX);
    const byId = Object.fromEntries(slices.map((s) => [s.agentId, s]));
    expect(byId["backend-api"]?.text).toContain("POST /v1/refunds");
    expect(byId["frontend-ui"]?.text).toContain("Mobile checkout");
    expect(byId["customer-support"]?.text).toContain("Help-center FAQ");
  });

  it("tier-filter-only honors tag intersection without calling the embedder", async () => {
    let calls = 0;
    const probe: Embedder = {
      async embed(texts) {
        calls++;
        return texts.map(() => [0, 0, 0]);
      },
    };
    const slices = await buildSlices("tier-filter-only", { ...CTX, embedder: probe });
    expect(calls).toBe(0);
    const byId = Object.fromEntries(slices.map((s) => [s.agentId, s]));
    expect(byId["backend-api"]?.text).toContain("POST /v1/refunds");
    expect(byId["frontend-ui"]?.text).toContain("Mobile checkout");
  });

  it("tier-embed-only ignores tag filters", async () => {
    const slices = await buildSlices("tier-embed-only", { ...CTX, budget: 5000 });
    // Each agent gets the highest-similarity subtree, not necessarily the tag-matching one.
    const lengths = slices.map((s) => s.text.length);
    expect(lengths.every((n) => n > 0)).toBe(true);
  });

  it("is deterministic across runs given fixed inputs", async () => {
    const a = await buildSlices("tier-hybrid", CTX);
    const b = await buildSlices("tier-hybrid", CTX);
    expect(a).toEqual(b);
  });
});
