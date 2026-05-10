import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Tree } from "@tier-reader/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runBench } from "../benchmarks/run.js";
import type { LLMRunner } from "../benchmarks/runner.js";
import type { DatasetEntry } from "../benchmarks/dataset.js";
import type { Embedder } from "../src/index.js";
import { buildTree, fixedEmbedder } from "./helpers.js";
import { ROSTER_3 } from "../benchmarks/agents.js";

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

const ENTRY: DatasetEntry = {
  id: "test-entry-1",
  text: "synthetic source message",
  source: "test",
  synthetic: true,
  domain: "dev",
  expectedAgents: ["backend-api", "frontend-ui", "customer-support"],
  expectedTasks: ROSTER_3.map((a) => ({ agentId: a.id, expectedTask: `do ${a.id} thing` })),
};

function stubAgentRunner(callLog: string[]): LLMRunner {
  return {
    async run({ userPrompt }) {
      callLog.push(`agent:${userPrompt.slice(0, 16)}`);
      return { text: "agent reply", inputTokens: 100, outputTokens: 20 };
    },
  };
}

function stubJudgeRunner(callLog: string[]): LLMRunner {
  return {
    async run({ userPrompt }) {
      callLog.push(`judge:${userPrompt.slice(0, 16)}`);
      return {
        text: JSON.stringify({ score: 4, rationale: "stubbed" }),
        inputTokens: 200,
        outputTokens: 10,
      };
    },
  };
}

const EMBED: Embedder = fixedEmbedder({
  [ROSTER_3[0]?.description ?? ""]: [1, 0, 0],
  [ROSTER_3[1]?.description ?? ""]: [0, 1, 0],
  [ROSTER_3[2]?.description ?? ""]: [0, 0, 1],
  "Mobile checkout duplicate render": [0, 1, 0],
  "POST /v1/refunds endpoint spec": [1, 0, 0],
  "Help-center FAQ on partial refunds": [0, 0, 1],
});

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("runBench", () => {
  it("produces a cell per (entry × roster × condition × agent) and writes results.json", async () => {
    const calls: string[] = [];
    const out = await runBench({
      agentRunner: stubAgentRunner(calls),
      judgeRunner: stubJudgeRunner(calls),
      embedder: EMBED,
      entries: [ENTRY],
      rosterSizes: [3],
      outPath: join(tmp, "results.json"),
      decomposeFn: async () => TREE,
      log: () => {},
    });

    // 1 entry × 1 roster (N=3) × 5 conditions × 3 agents = 15 cells
    expect(out.cells).toHaveLength(15);
    const persisted = JSON.parse(readFileSync(join(tmp, "results.json"), "utf8"));
    expect(persisted.cells).toHaveLength(15);
  });

  it("skips already-completed cells when resume=true", async () => {
    const path = join(tmp, "results.json");
    const calls1: string[] = [];
    await runBench({
      agentRunner: stubAgentRunner(calls1),
      judgeRunner: stubJudgeRunner(calls1),
      embedder: EMBED,
      entries: [ENTRY],
      rosterSizes: [3],
      outPath: path,
      decomposeFn: async () => TREE,
      log: () => {},
    });

    const calls2: string[] = [];
    const out = await runBench({
      agentRunner: stubAgentRunner(calls2),
      judgeRunner: stubJudgeRunner(calls2),
      embedder: EMBED,
      entries: [ENTRY],
      rosterSizes: [3],
      outPath: path,
      resume: true,
      decomposeFn: async () => TREE,
      log: () => {},
    });

    // Resume should produce zero new agent or judge calls.
    expect(calls2).toEqual([]);
    expect(out.cells).toHaveLength(15);
  });

  it("persists partial results when an LLM call throws (e.g., budget exceeded)", async () => {
    const path = join(tmp, "results.json");
    let callCount = 0;
    const failingAgent: LLMRunner = {
      async run() {
        callCount++;
        if (callCount > 3) throw new Error("simulated budget exceeded");
        return { text: "ok", inputTokens: 1, outputTokens: 1 };
      },
    };
    const judge = stubJudgeRunner([]);

    await expect(
      runBench({
        agentRunner: failingAgent,
        judgeRunner: judge,
        embedder: EMBED,
        entries: [ENTRY],
        rosterSizes: [3],
        outPath: path,
        decomposeFn: async () => TREE,
        log: () => {},
      }),
    ).rejects.toThrow(/simulated budget/);

    const persisted = JSON.parse(readFileSync(path, "utf8"));
    expect(persisted.cells.length).toBeGreaterThan(0);
    expect(persisted.cells.length).toBeLessThan(15);
  });
});
