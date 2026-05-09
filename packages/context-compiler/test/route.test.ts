import { describe, expect, it } from "vitest";
import { type AgentSpec, route } from "../src/index.js";
import { buildTree, fixedEmbedder, stubEmbedder } from "./helpers.js";

const TREE = buildTree({
  title: "Multi-topic ask",
  children: [
    {
      title: "Stripe ACH integration plan",
      tags: ["payments"],
      entities: ["Stripe", "ACH"],
      children: [{ title: "Webhook signing requirements" }],
    },
    {
      title: "KYC document upload UI",
      tags: ["compliance", "kyc"],
      entities: ["Persona"],
      children: [{ title: "File-size validation" }],
    },
    {
      title: "On-call rotation policy",
      tags: ["ops"],
      entities: ["PagerDuty"],
      children: [{ title: "Holiday coverage" }],
    },
  ],
});

describe("route — Step A filter-only", () => {
  it("returns subtrees overlapping the agent tagFilters", async () => {
    const agent: AgentSpec = {
      id: "payments",
      domain: "payments",
      description: "Handles billing and payment integrations",
      tagFilters: ["payments"],
    };
    const out = await route(TREE, agent, {
      embedder: stubEmbedder(),
      filterOnly: true,
    });
    expect(out.map((e) => e.node.title)).toEqual(["Stripe ACH integration plan"]);
    expect(out[0]?.similarity).toBeNull();
    expect(out[0]?.filterMatches).toBeGreaterThan(0);
  });

  it("matches by entity intersection", async () => {
    const agent: AgentSpec = {
      id: "kyc",
      domain: "compliance",
      description: "Identity verification flows",
      entityFilters: ["Persona"],
    };
    const out = await route(TREE, agent, {
      embedder: stubEmbedder(),
      filterOnly: true,
    });
    expect(out.map((e) => e.node.title)).toEqual(["KYC document upload UI"]);
  });

  it("returns all candidates when filters are empty (auto-pass)", async () => {
    const agent: AgentSpec = {
      id: "generalist",
      domain: "any",
      description: "Anything goes",
    };
    const out = await route(TREE, agent, {
      embedder: stubEmbedder(),
      filterOnly: true,
    });
    expect(out).toHaveLength(3);
  });
});

describe("route — Step B embedding-only", () => {
  it("ranks by cosine similarity and drops below threshold", async () => {
    const embedder = fixedEmbedder({
      "Payments specialist": [1, 0, 0],
      "Stripe ACH integration plan": [0.9, 0.1, 0],
      "KYC document upload UI": [0, 1, 0],
      "On-call rotation policy": [0, 0, 1],
    });
    const agent: AgentSpec = {
      id: "payments",
      domain: "payments",
      description: "Payments specialist",
    };
    const out = await route(TREE, agent, {
      embedder,
      embeddingOnly: true,
      threshold: 0.5,
    });
    expect(out.map((e) => e.node.title)).toEqual(["Stripe ACH integration plan"]);
    expect(out[0]?.similarity).toBeCloseTo(0.9 / Math.sqrt(0.81 + 0.01), 3);
  });

  it("skips Step A entirely when embeddingOnly is set", async () => {
    // Agent has bogus tagFilters that don't match anything, but embeddingOnly bypasses A.
    const embedder = fixedEmbedder({
      ops: [0, 0, 1],
      "Stripe ACH integration plan": [1, 0, 0],
      "KYC document upload UI": [0, 1, 0],
      "On-call rotation policy": [0, 0, 1],
    });
    const agent: AgentSpec = {
      id: "ops",
      domain: "ops",
      description: "ops",
      tagFilters: ["does-not-exist"],
    };
    const out = await route(TREE, agent, {
      embedder,
      embeddingOnly: true,
      threshold: 0.5,
    });
    expect(out.map((e) => e.node.title)).toEqual(["On-call rotation policy"]);
  });
});

describe("route — hybrid", () => {
  it("filters first, then ranks the survivors", async () => {
    const embedder = fixedEmbedder({
      "Payments person": [1, 0, 0],
      "Stripe ACH integration plan": [1, 0, 0],
      "KYC document upload UI": [0, 1, 0],
    });
    const agent: AgentSpec = {
      id: "payments",
      domain: "payments",
      description: "Payments person",
      // Tag filter passes Stripe subtree; KYC and Ops are dropped before embedding.
      tagFilters: ["payments"],
    };
    const out = await route(TREE, agent, { embedder, threshold: 0.5 });
    expect(out.map((e) => e.node.title)).toEqual(["Stripe ACH integration plan"]);
    expect(out[0]?.similarity).toBeCloseTo(1, 5);
  });

  it("rejects when filterOnly + embeddingOnly are both set", async () => {
    const agent: AgentSpec = { id: "x", domain: "x", description: "x" };
    await expect(
      route(TREE, agent, {
        embedder: stubEmbedder(),
        filterOnly: true,
        embeddingOnly: true,
      }),
    ).rejects.toThrow(/mutually exclusive/);
  });

  it("is deterministic across runs given a fixed embedder", async () => {
    const agent: AgentSpec = {
      id: "g",
      domain: "g",
      description: "general purpose",
    };
    const opts = { embedder: stubEmbedder(), threshold: 0 } as const;
    const a = await route(TREE, agent, opts);
    const b = await route(TREE, agent, opts);
    expect(a.map((e) => e.node.id)).toEqual(b.map((e) => e.node.id));
  });
});
