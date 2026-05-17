import type { Node, NodeId, Tree } from "@tier-reader/core";
import type { AgentSpec, RouteOpts, RouteResultEntry } from "./types.js";

const DEFAULT_THRESHOLD = 0.3;

/**
 * Hybrid route: Step A is a tag/entity overlap filter; Step B is a
 * cosine-similarity rank between the agent's description and each surviving
 * subtree's title. Returns the matching subtree-root nodes.
 *
 * Step A vocabulary policy: lowercased substring match in either direction
 * (filter ⊆ tag or tag ⊆ filter). Strict set-intersection is too brittle for
 * model-emitted free-form tags vs. human-curated agent filters — e.g. an
 * agent filter `"frontend"` will not exact-match an emitted tag like
 * `"frontend-bug"`. Strict semantics are still reachable via
 * `fallbackOnEmpty: false` for the benchmark ablation.
 *
 * `fallbackOnEmpty` (default true): when Step A returns zero survivors, fall
 * through to Step B over all candidates rather than returning empty. Real
 * agent filters won't be perfectly aligned with model tags either, and a
 * silent empty result is a worse failure than a similarity-only fallback.
 *
 * Determinism: given a fixed embedder + threshold, the output is fully
 * determined by the input tree and agent spec.
 */
export async function route(
  tree: Tree,
  agent: AgentSpec,
  opts: RouteOpts,
): Promise<RouteResultEntry[]> {
  if (opts.filterOnly && opts.embeddingOnly) {
    throw new Error("route: filterOnly and embeddingOnly are mutually exclusive");
  }

  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const maxDepth = opts.maxDepth ?? 0;
  const fallbackOnEmpty = opts.fallbackOnEmpty ?? true;
  const candidates = collectCandidates(tree, maxDepth);

  // Step A — overlap filter (lowercased substring) over the whole subtree.
  const stepA: { node: Node; filterMatches: number }[] = [];
  const filterEmpty = !agent.tagFilters?.length && !agent.entityFilters?.length;
  for (const node of candidates) {
    if (opts.embeddingOnly || filterEmpty) {
      stepA.push({ node, filterMatches: 0 });
      continue;
    }
    const overlap = countOverlap(tree, node.id, agent.tagFilters, agent.entityFilters);
    if (overlap > 0) stepA.push({ node, filterMatches: overlap });
  }

  // Decide Step B input: Step A survivors, optionally falling back to all
  // candidates when Step A is empty and fallback is enabled. Filter-only
  // skips Step B entirely and returns Step A as-is (no fallback).
  let stepBInput = stepA;
  let fallbackEngaged = false;
  if (
    !opts.filterOnly &&
    !opts.embeddingOnly &&
    !filterEmpty &&
    stepA.length === 0 &&
    fallbackOnEmpty
  ) {
    stepBInput = candidates.map((node) => ({ node, filterMatches: 0 }));
    fallbackEngaged = true;
  }

  if (opts.filterOnly || stepBInput.length === 0) {
    const out = stepA.map(({ node, filterMatches }) => ({
      node,
      similarity: null,
      filterMatches,
    }));
    opts.trace?.({
      agentId: agent.id,
      candidateIds: candidates.map((n) => n.id),
      stepASurvivorIds: stepA.map(({ node }) => node.id),
      fallbackEngaged: false,
      stepBSurvivorIds: out.map((e) => e.node.id),
    });
    return out;
  }

  // Step B — cosine similarity between agent description and subtree title.
  const titles = stepBInput.map(({ node }) => node.title);
  const vectors = await opts.embedder.embed([agent.description, ...titles]);
  const agentVec = vectors[0];
  if (!agentVec) throw new Error("route: embedder returned no vector for agent description");

  const out: RouteResultEntry[] = [];
  for (let i = 0; i < stepBInput.length; i++) {
    const entry = stepBInput[i];
    const titleVec = vectors[i + 1];
    if (!entry || !titleVec) continue;
    const sim = cosine(agentVec, titleVec);
    if (sim >= threshold) {
      out.push({ node: entry.node, similarity: sim, filterMatches: entry.filterMatches });
    }
  }

  // Stable sort by descending similarity; ties preserve source order.
  out.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  opts.trace?.({
    agentId: agent.id,
    candidateIds: candidates.map((n) => n.id),
    stepASurvivorIds: stepA.map(({ node }) => node.id),
    fallbackEngaged,
    stepBSurvivorIds: out.map((e) => e.node.id),
  });
  return out;
}

function collectCandidates(tree: Tree, maxDepth: number): Node[] {
  // Default candidates: children of a single root, otherwise the roots themselves.
  const seeds: Node[] = [];
  if (tree.rootIds.length === 1) {
    const root = tree.nodes[tree.rootIds[0] as NodeId];
    if (root && root.hasChildren && root.childIds?.length) {
      for (const childId of root.childIds) {
        const child = tree.nodes[childId];
        if (child) seeds.push(child);
      }
    } else if (root) {
      seeds.push(root);
    }
  } else {
    for (const rid of tree.rootIds) {
      const n = tree.nodes[rid];
      if (n) seeds.push(n);
    }
  }

  if (maxDepth <= 0) return seeds;

  // Descend further: replace each seed with its descendants at relative depth maxDepth
  // (or itself, if it has no descendants at that depth).
  const out: Node[] = [];
  for (const seed of seeds) {
    out.push(...descendantsAt(tree, seed, maxDepth));
  }
  return out;
}

function descendantsAt(tree: Tree, root: Node, relDepth: number): Node[] {
  if (relDepth <= 0 || !root.hasChildren || !root.childIds?.length) return [root];
  const out: Node[] = [];
  for (const cid of root.childIds) {
    const child = tree.nodes[cid];
    if (!child) continue;
    out.push(...descendantsAt(tree, child, relDepth - 1));
  }
  return out.length ? out : [root];
}

function countOverlap(
  tree: Tree,
  rootId: NodeId,
  tagFilters: string[] | undefined,
  entityFilters: string[] | undefined,
): number {
  const tagFs = (tagFilters ?? []).map((f) => f.toLowerCase()).filter((f) => f.length > 0);
  const entFs = (entityFilters ?? []).map((f) => f.toLowerCase()).filter((f) => f.length > 0);
  let matches = 0;
  walk(tree, rootId, (node) => {
    if (tagFs.length && node.tags?.length) {
      for (const t of node.tags) {
        const tl = t.toLowerCase();
        if (tagFs.some((f) => tl.includes(f) || f.includes(tl))) matches++;
      }
    }
    if (entFs.length && node.entities?.length) {
      for (const e of node.entities) {
        const el = e.toLowerCase();
        if (entFs.some((f) => el.includes(f) || f.includes(el))) matches++;
      }
    }
  });
  return matches;
}

function walk(tree: Tree, nodeId: NodeId, visit: (n: Node) => void): void {
  const node = tree.nodes[nodeId];
  if (!node) return;
  visit(node);
  if (node.hasChildren && node.childIds?.length) {
    for (const cid of node.childIds) walk(tree, cid, visit);
  }
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
