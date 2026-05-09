import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiSdkProvider, decompose } from "@tier-reader/core";
import { cachedEmbedder, voyageEmbedder } from "../src/index.js";
import { ROSTERS, type RosterSize } from "./agents.js";
import { type AgentSlice, type ConditionId, buildSlices } from "./conditions.js";
import { DATASET, type DatasetEntry } from "./dataset.js";
import {
  type JudgeVerdict,
  buildOutputPrompt,
  buildSteeringPrompt,
  parseVerdict,
} from "./judge-prompts.js";
import { BENCH_MODELS, type LLMRunner, anthropicRunner } from "./runner.js";

const here = dirname(fileURLToPath(import.meta.url));

const CONDITIONS: ConditionId[] = [
  "flat-broadcast",
  "dacs-focus",
  "tier-hybrid",
  "tier-filter-only",
  "tier-embed-only",
];

const DEFAULT_BUDGET = Number(process.env.BENCH_BUDGET ?? 500);
const DEFAULT_ROSTERS: RosterSize[] = [3, 5, 10];

interface CellResult {
  entryId: string;
  rosterSize: RosterSize;
  condition: ConditionId;
  agentId: string;
  expected: boolean;
  contextChars: number;
  inputTokens: number;
  outputTokens: number;
  output: string;
  steering: JudgeVerdict;
  outputQuality: JudgeVerdict;
}

interface BenchOutput {
  generatedAt: string;
  budget: number;
  models: typeof BENCH_MODELS;
  conditions: ConditionId[];
  rosterSizes: RosterSize[];
  cells: CellResult[];
}

export async function runBench(opts: {
  agentRunner: LLMRunner;
  judgeRunner: LLMRunner;
  /** Optional override; defaults to all dataset entries. */
  entries?: DatasetEntry[];
  rosterSizes?: RosterSize[];
  budget?: number;
  /** Where to write results.json. Default: benchmarks/results.json. */
  outPath?: string;
  /** Hook for progress logging (tests pass a no-op). */
  log?: (msg: string) => void;
}): Promise<BenchOutput> {
  const log = opts.log ?? ((m: string) => process.stderr.write(`${m}\n`));
  const entries = opts.entries ?? DATASET;
  const rosterSizes = opts.rosterSizes ?? DEFAULT_ROSTERS;
  const budget = opts.budget ?? DEFAULT_BUDGET;
  const outPath = opts.outPath ?? resolve(here, "results.json");

  const provider = aiSdkProvider();
  const embedder = cachedEmbedder(voyageEmbedder(), {
    path: resolve(here, ".cache/embed.json"),
    namespace: "voyage-3-lite",
  });

  const cells: CellResult[] = [];

  for (const entry of entries) {
    log(`[entry] ${entry.id}`);
    const tree = await decompose(entry.text, { provider });
    const dacsSummary = await summarize(opts.agentRunner, entry.text);

    for (const N of rosterSizes) {
      const roster = ROSTERS[N];
      for (const cond of CONDITIONS) {
        const slices = await buildSlices(cond, {
          sourceMessage: entry.text,
          tree,
          roster,
          embedder,
          budget,
          dacsSummary,
        });

        for (const agent of roster) {
          const slice = slices.find((s) => s.agentId === agent.id);
          if (!slice) continue;

          const cell = await runOneCell({
            entry,
            agent,
            slice,
            condition: cond,
            rosterSize: N,
            agentRunner: opts.agentRunner,
            judgeRunner: opts.judgeRunner,
          });
          cells.push(cell);
          log(
            `  N=${N} ${cond} ${agent.id} steering=${cell.steering.score} output=${cell.outputQuality.score}`,
          );
        }
      }
    }
  }

  const out: BenchOutput = {
    generatedAt: new Date().toISOString(),
    budget,
    models: BENCH_MODELS,
    conditions: CONDITIONS,
    rosterSizes,
    cells,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  log(`[done] wrote ${outPath} (${cells.length} cells)`);
  return out;
}

async function summarize(runner: LLMRunner, text: string): Promise<string> {
  const { text: summary } = await runner.run({
    systemPrompt:
      "You compress messages into 200-token summaries that preserve all task-relevant content. No commentary.",
    userPrompt: `Summarize the following message in at most 200 tokens, preserving every distinct task, request, or decision. Return only the summary.\n\n"""\n${text}\n"""`,
    temperature: 0,
  });
  return summary.trim();
}

async function runOneCell(args: {
  entry: DatasetEntry;
  agent: { id: string; description: string; systemPrompt: string };
  slice: AgentSlice;
  condition: ConditionId;
  rosterSize: RosterSize;
  agentRunner: LLMRunner;
  judgeRunner: LLMRunner;
}): Promise<CellResult> {
  const { entry, agent, slice, condition, rosterSize } = args;
  const expected = entry.expectedAgents.includes(agent.id);
  const expectedTask =
    entry.expectedTasks.find((t) => t.agentId === agent.id)?.expectedTask ?? "(no expected task)";

  let agentText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  if (slice.text.trim().length > 0) {
    const result = await args.agentRunner.run({
      systemPrompt: agent.systemPrompt,
      userPrompt: slice.text,
      temperature: 0,
    });
    agentText = result.text;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  }

  const steering = await judge(args.judgeRunner, "steering", {
    sourceMessage: entry.text,
    agentId: agent.id,
    agentDescription: agent.description,
    expectedTask,
    contextGiven: slice.text,
  });

  const outputQuality = await judge(args.judgeRunner, "output", {
    sourceMessage: entry.text,
    agentId: agent.id,
    agentDescription: agent.description,
    expectedTask,
    contextGiven: slice.text,
    agentOutput: agentText,
  });

  return {
    entryId: entry.id,
    rosterSize,
    condition,
    agentId: agent.id,
    expected,
    contextChars: slice.text.length,
    inputTokens,
    outputTokens,
    output: agentText,
    steering,
    outputQuality,
  };
}

async function judge(
  runner: LLMRunner,
  kind: "steering" | "output",
  input: Parameters<typeof buildSteeringPrompt>[0],
): Promise<JudgeVerdict> {
  const prompt = kind === "steering" ? buildSteeringPrompt(input) : buildOutputPrompt(input);
  const { text } = await runner.run({
    systemPrompt:
      "You are a strict evaluator. Respond with valid JSON only — no commentary, no code fences.",
    userPrompt: prompt,
    model: BENCH_MODELS.judge,
    temperature: 0,
  });
  return parseVerdict(text);
}

// CLI entry — `tsx benchmarks/run.ts`
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const runner = anthropicRunner({ defaultModel: BENCH_MODELS.agent });
  runBench({ agentRunner: runner, judgeRunner: runner }).catch((err) => {
    process.stderr.write(`bench failed: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
