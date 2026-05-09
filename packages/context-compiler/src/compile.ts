import { type Node, type NodeId, type Tree, renderAt } from "@tier-reader/core";
import type { CompileFormat, CompileOpts, CompileResult } from "./types.js";

const DEFAULT_MAX_DEPTH = 6;

/**
 * Compile a set of subtree-root nodes into a single context string under a
 * token budget. The depth is chosen by binary search over `renderAt` depth on
 * each subtree: the largest depth where the joined output fits the budget.
 *
 * Source order is preserved across subtrees (sorted by structural id).
 */
export function compile(tree: Tree, subtrees: Node[], opts: CompileOpts): CompileResult {
  const format = opts.format ?? "bullets";
  const estimate = opts.tokenEstimate ?? defaultEstimate;
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;

  if (subtrees.length === 0) {
    return { text: "", tokenEstimate: 0, depth: 0, subtreeIds: [], format };
  }

  const ordered = [...subtrees].sort((a, b) => compareIds(a.id, b.id));
  const ids = ordered.map((n) => n.id);

  const renderAtDepth = (d: number): { text: string; tokens: number } => {
    const text = formatSubtrees(tree, ordered, d, format);
    return { text, tokens: estimate(text) };
  };

  // Floor at depth 0 — if it already exceeds budget we still emit it.
  let bestDepth = 0;
  let best = renderAtDepth(0);

  // Binary-search the largest depth where output fits the budget.
  let lo = 0;
  let hi = maxDepth;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = renderAtDepth(mid);
    if (candidate.tokens <= opts.budget) {
      bestDepth = mid;
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    text: best.text,
    tokenEstimate: best.tokens,
    depth: bestDepth,
    subtreeIds: ids,
    format,
  };
}

function formatSubtrees(
  tree: Tree,
  subtrees: Node[],
  depth: number,
  format: CompileFormat,
): string {
  if (format === "bullets") {
    const lines: string[] = [];
    for (const sub of subtrees) {
      const plan = renderAt(tree, sub.id, depth);
      for (const entry of plan) {
        const node = tree.nodes[entry.nodeId];
        if (!node) continue;
        const indent = "  ".repeat(entry.indent);
        let line = `${indent}- ${node.title}`;
        if (entry.showDetail && node.detail) {
          line += `\n${indent}  ${node.detail.trim()}`;
        }
        lines.push(line);
      }
    }
    return lines.join("\n");
  }

  // prose: linearize titles into paragraphs by source order.
  const paragraphs: string[] = [];
  for (const sub of subtrees) {
    const plan = renderAt(tree, sub.id, depth);
    const titles: string[] = [];
    for (const entry of plan) {
      const node = tree.nodes[entry.nodeId];
      if (node) titles.push(node.title);
    }
    if (titles.length) paragraphs.push(titles.join(" "));
  }
  return paragraphs.join("\n\n");
}

/** Approximate 1 token ≈ 4 chars (Anthropic/OpenAI rough heuristic). */
function defaultEstimate(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Compare structural ids like "0.2.1" lexicographically by numeric segment so
 * that "0.10" sorts after "0.2".
 */
function compareIds(a: NodeId, b: NodeId): number {
  const as = a.split(".").map(Number);
  const bs = b.split(".").map(Number);
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    const av = as[i] ?? -1;
    const bv = bs[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}
