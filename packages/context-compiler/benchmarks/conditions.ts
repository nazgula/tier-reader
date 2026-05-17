import type { Tree } from "@tier-reader/core";
import { type Embedder, type RouteTraceEvent, compile, route } from "../src/index.js";
import type { BenchAgent } from "./agents.js";

export type ConditionId =
  | "flat-broadcast"
  | "dacs-focus"
  | "tier-hybrid"
  | "tier-filter-only"
  | "tier-embed-only";

export interface ConditionContext {
  /** Full source message before any decomposition. */
  sourceMessage: string;
  /** Already-decomposed tree of the source. */
  tree: Tree;
  /** Roster for the current N. */
  roster: BenchAgent[];
  embedder: Embedder;
  /** Token budget passed to compile() for tier-* conditions. */
  budget: number;
  /** 200-token summary used by DACS focus-mode for non-focus agents. */
  dacsSummary: string;
  /** Optional route-trace hook; forwarded to `route()` for `tier-*` conditions. */
  trace?: (event: RouteTraceEvent) => void;
}

export interface AgentSlice {
  agentId: string;
  text: string;
}

/**
 * Build per-agent context slices for one condition. Pure function — no model
 * calls; caller pre-computes any summaries / embeddings the condition needs.
 */
export async function buildSlices(
  cond: ConditionId,
  ctx: ConditionContext,
): Promise<AgentSlice[]> {
  switch (cond) {
    case "flat-broadcast":
      return ctx.roster.map((a) => ({ agentId: a.id, text: ctx.sourceMessage }));

    case "dacs-focus": {
      const focusId = await pickFocusAgent(ctx);
      return ctx.roster.map((a) => ({
        agentId: a.id,
        text: a.id === focusId ? ctx.sourceMessage : ctx.dacsSummary,
      }));
    }

    case "tier-hybrid":
      return runTier(ctx, {});

    case "tier-filter-only":
      // Strict set-intersection ablation — disable fallback so a filter miss
      // genuinely returns empty rather than collapsing into embed-only.
      return runTier(ctx, { filterOnly: true, fallbackOnEmpty: false });

    case "tier-embed-only":
      return runTier(ctx, { embeddingOnly: true });

    default: {
      const _exhaustive: never = cond;
      throw new Error(`buildSlices: unknown condition ${String(_exhaustive)}`);
    }
  }
}

async function runTier(
  ctx: ConditionContext,
  opts: { filterOnly?: boolean; embeddingOnly?: boolean; fallbackOnEmpty?: boolean },
): Promise<AgentSlice[]> {
  const slices: AgentSlice[] = [];
  for (const agent of ctx.roster) {
    const matches = await route(ctx.tree, agent, {
      embedder: ctx.embedder,
      filterOnly: opts.filterOnly,
      embeddingOnly: opts.embeddingOnly,
      fallbackOnEmpty: opts.fallbackOnEmpty,
      trace: ctx.trace,
    });
    if (matches.length === 0) {
      slices.push({ agentId: agent.id, text: "" });
      continue;
    }
    const compiled = compile(
      ctx.tree,
      matches.map((m) => m.node),
      { budget: ctx.budget, format: "bullets" },
    );
    slices.push({ agentId: agent.id, text: compiled.text });
  }
  return slices;
}

/**
 * DACS focus heuristic: agent with the highest cosine similarity between its
 * description and any top-level subtree title becomes the focus agent.
 */
async function pickFocusAgent(ctx: ConditionContext): Promise<string> {
  let best: { id: string; score: number } | null = null;
  for (const agent of ctx.roster) {
    const matches = await route(ctx.tree, agent, {
      embedder: ctx.embedder,
      embeddingOnly: true,
      threshold: 0,
    });
    const top = matches[0]?.similarity ?? 0;
    if (!best || top > best.score) best = { id: agent.id, score: top };
  }
  if (!best) throw new Error("pickFocusAgent: empty roster");
  return best.id;
}
