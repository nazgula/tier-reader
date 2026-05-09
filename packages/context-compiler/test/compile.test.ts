import { describe, expect, it } from "vitest";
import { compile } from "../src/index.js";
import { buildTree } from "./helpers.js";

const TREE = buildTree({
  title: "root",
  children: [
    {
      title: "Alpha section",
      children: [
        { title: "Alpha-1 detail point one", detail: "alpha 1 detail body" },
        { title: "Alpha-2 detail point two", detail: "alpha 2 detail body" },
      ],
    },
    {
      title: "Beta section",
      children: [{ title: "Beta-1 only child", detail: "beta 1 detail body" }],
    },
  ],
});

const ALPHA = TREE.nodes["0.0"];
const BETA = TREE.nodes["0.1"];
if (!ALPHA || !BETA) throw new Error("test fixture: subtree lookup failed");

describe("compile", () => {
  it("emits bullet markdown by default", () => {
    const out = compile(TREE, [ALPHA], { budget: 10_000 });
    expect(out.format).toBe("bullets");
    expect(out.text).toMatch(/^- Alpha section$/m);
    expect(out.text).toMatch(/^ {2}- Alpha-1 detail point one$/m);
  });

  it("emits prose when format=prose, joining titles into paragraphs", () => {
    const out = compile(TREE, [ALPHA, BETA], { budget: 10_000, format: "prose" });
    expect(out.format).toBe("prose");
    const paragraphs = out.text.split("\n\n");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toContain("Alpha section");
    expect(paragraphs[1]).toContain("Beta section");
  });

  it("preserves source order across subtrees regardless of input order", () => {
    const reversed = compile(TREE, [BETA, ALPHA], { budget: 10_000 });
    expect(reversed.subtreeIds).toEqual(["0.0", "0.1"]);
    const idxAlpha = reversed.text.indexOf("Alpha section");
    const idxBeta = reversed.text.indexOf("Beta section");
    expect(idxAlpha).toBeGreaterThanOrEqual(0);
    expect(idxBeta).toBeGreaterThanOrEqual(0);
    expect(idxAlpha).toBeLessThan(idxBeta);
  });

  it("honors the budget by binary-searching depth down", () => {
    const full = compile(TREE, [ALPHA, BETA], { budget: 10_000 });
    // Pick a budget tight enough to force depth 0 (titles only).
    const tight = compile(TREE, [ALPHA, BETA], { budget: 8 });
    expect(tight.depth).toBeLessThan(full.depth);
    expect(tight.tokenEstimate).toBeLessThanOrEqual(full.tokenEstimate);
    expect(tight.text).not.toContain("Alpha-1 detail point one");
    expect(tight.text).toContain("Alpha section");
  });

  it("returns empty output for an empty subtree set", () => {
    const out = compile(TREE, [], { budget: 1000 });
    expect(out.text).toBe("");
    expect(out.tokenEstimate).toBe(0);
    expect(out.subtreeIds).toEqual([]);
  });

  it("uses a custom token estimator when provided", () => {
    let calls = 0;
    const out = compile(TREE, [ALPHA], {
      budget: 1_000_000,
      tokenEstimate: (text) => {
        calls++;
        return text.length;
      },
    });
    expect(calls).toBeGreaterThan(0);
    expect(out.tokenEstimate).toBe(out.text.length);
  });
});
