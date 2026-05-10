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

describe("route — Step A vocabulary policy", () => {
  it("matches via lowercased substring (filter ⊆ tag)", async () => {
    // Realistic case: model emits "payments-flow" / "Payments-Refund"; agent filter is "payments".
    const tree = buildTree({
      title: "Multi-topic ask",
      children: [
        {
          title: "Refund flow rework",
          tags: ["Payments-Refund", "billing"],
        },
        {
          title: "Holiday on-call schedule",
          tags: ["ops", "scheduling"],
        },
      ],
    });
    const agent: AgentSpec = {
      id: "payments",
      domain: "payments",
      description: "Payments specialist",
      tagFilters: ["payments"],
    };
    const out = await route(tree, agent, {
      embedder: stubEmbedder(),
      filterOnly: true,
    });
    expect(out.map((e) => e.node.title)).toEqual(["Refund flow rework"]);
  });

  it("matches via lowercased substring (tag ⊆ filter)", async () => {
    // Inverse case: model emits short generic tag; agent filter is more specific.
    const tree = buildTree({
      title: "Multi-topic ask",
      children: [
        {
          title: "Audit log schema",
          tags: ["auth"],
        },
      ],
    });
    const agent: AgentSpec = {
      id: "security",
      domain: "security",
      description: "Security engineer",
      tagFilters: ["authentication"],
    };
    const out = await route(tree, agent, {
      embedder: stubEmbedder(),
      filterOnly: true,
    });
    expect(out.map((e) => e.node.title)).toEqual(["Audit log schema"]);
  });
});

describe("route — fallbackOnEmpty", () => {
  const tree = buildTree({
    title: "Multi-topic ask",
    children: [
      { title: "Topic A", tags: ["unrelated"] },
      { title: "Topic B", tags: ["unrelated"] },
    ],
  });

  it("falls through to Step B over all candidates when Step A is empty (default)", async () => {
    const embedder = fixedEmbedder({
      "Specialist X": [1, 0, 0],
      "Topic A": [1, 0, 0],
      "Topic B": [0, 1, 0],
    });
    const agent: AgentSpec = {
      id: "x",
      domain: "x",
      description: "Specialist X",
      tagFilters: ["does-not-match"],
    };
    const out = await route(tree, agent, { embedder, threshold: 0.5 });
    // Step A returns []; fallback runs Step B over all candidates; only Topic A
    // clears the threshold.
    expect(out.map((e) => e.node.title)).toEqual(["Topic A"]);
  });

  it("returns strict empty in hybrid mode when fallbackOnEmpty: false", async () => {
    // Hybrid mode (no filterOnly) — exercises the fallback branch directly:
    // step A is empty, fallback is disabled, step B is skipped, return [].
    const embedder = fixedEmbedder({
      "Specialist X": [1, 0, 0],
      "Topic A": [1, 0, 0],
      "Topic B": [0, 1, 0],
    });
    const agent: AgentSpec = {
      id: "x",
      domain: "x",
      description: "Specialist X",
      tagFilters: ["does-not-match"],
    };
    const out = await route(tree, agent, {
      embedder,
      threshold: 0.5,
      fallbackOnEmpty: false,
    });
    expect(out).toEqual([]);
  });

  it("preserves strict empty in filterOnly ablation regardless of fallbackOnEmpty", async () => {
    // The benchmark `tier-filter-only` ablation passes both flags. Exact-shape regression test.
    const agent: AgentSpec = {
      id: "x",
      domain: "x",
      description: "Specialist X",
      tagFilters: ["does-not-match"],
    };
    const out = await route(tree, agent, {
      embedder: stubEmbedder(),
      filterOnly: true,
      fallbackOnEmpty: false,
    });
    expect(out).toEqual([]);
  });
});

describe("route — trace", () => {
  it("emits one trace event per call with survivor counts and fallback flag", async () => {
    const tree = buildTree({
      title: "Multi-topic ask",
      children: [
        { title: "Topic A", tags: ["unrelated"] },
        { title: "Topic B", tags: ["unrelated"] },
      ],
    });
    const embedder = fixedEmbedder({
      "Specialist X": [1, 0, 0],
      "Topic A": [1, 0, 0],
      "Topic B": [0, 1, 0],
    });
    const events: Array<{
      agentId: string;
      stepA: number;
      stepB: number;
      fallback: boolean;
    }> = [];
    const agent: AgentSpec = {
      id: "agent-x",
      domain: "x",
      description: "Specialist X",
      tagFilters: ["does-not-match"],
    };
    await route(tree, agent, {
      embedder,
      threshold: 0.5,
      trace: (ev) =>
        events.push({
          agentId: ev.agentId,
          stepA: ev.stepASurvivorIds.length,
          stepB: ev.stepBSurvivorIds.length,
          fallback: ev.fallbackEngaged,
        }),
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ agentId: "agent-x", stepA: 0, stepB: 1, fallback: true });
  });
});
