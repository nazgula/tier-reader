import type { Node, NodeId, Tree } from "@tier-reader/core";
import type { AgentSpec, RouteOpts, RouteResultEntry } from "./types.js";

const DEFAULT_THRESHOLD = 0.3;

/**
 * Hybrid route: Step A is a tag/entity intersection filter; Step B is a
 * cosine-similarity rank between the agent's description and each surviving
 * subtree's title. Returns the matching subtree-root nodes.
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
  const candidates = collectCandidates(tree, maxDepth);

  // Step A — hard filter by tag/entity intersection over the whole subtree.
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

  if (opts.filterOnly || stepA.length === 0) {
    return stepA.map(({ node, filterMatches }) => ({
      node,
      similarity: null,
      filterMatches,
    }));
  }

  // Step B — cosine similarity between agent description and subtree title.
  const titles = stepA.map(({ node }) => node.title);
  const vectors = await opts.embedder.embed([agent.description, ...titles]);
  const agentVec = vectors[0];
  if (!agentVec) throw new Error("route: embedder returned no vector for agent description");

  const out: RouteResultEntry[] = [];
  for (let i = 0; i < stepA.length; i++) {
    const entry = stepA[i];
    const titleVec = vectors[i + 1];
    if (!entry || !titleVec) continue;
    const sim = cosine(agentVec, titleVec);
    if (sim >= threshold) {
      out.push({ node: entry.node, similarity: sim, filterMatches: entry.filterMatches });
    }
  }

  // Stable sort by descending similarity; ties preserve source order.
  out.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
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
  const tagSet = new Set(tagFilters ?? []);
  const entSet = new Set(entityFilters ?? []);
  let matches = 0;
  walk(tree, rootId, (node) => {
    if (tagSet.size && node.tags?.length) {
      for (const t of node.tags) if (tagSet.has(t)) matches++;
    }
    if (entSet.size && node.entities?.length) {
      for (const e of node.entities) if (entSet.has(e)) matches++;
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
