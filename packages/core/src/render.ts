import type { NodeId, RenderEntry, RenderPlan, Tree } from "./schema.js";

/**
 * Walk the subtree rooted at nodeId, producing a flat RenderPlan.
 * Nodes at relative depth ≤ expandToDepth are included.
 * showDetail is set on leaves at the boundary (relative depth === expandToDepth)
 * and on true leaves (no children) inside the depth window.
 */
export function renderAt(tree: Tree, nodeId: NodeId, expandToDepth: number): RenderPlan {
  const root = tree.nodes[nodeId];
  if (!root) throw new Error(`renderAt: unknown nodeId "${nodeId}"`);
  if (expandToDepth < 0) throw new Error("renderAt: expandToDepth must be >= 0");

  const out: RenderPlan = [];
  walk(tree, nodeId, 0, expandToDepth, out);
  return out;
}

function walk(
  tree: Tree,
  nodeId: NodeId,
  relDepth: number,
  maxDepth: number,
  out: RenderEntry[],
): void {
  const node = tree.nodes[nodeId];
  if (!node) return;

  const atBoundary = relDepth === maxDepth;
  const isLeaf = !node.hasChildren;
  const showDetail = isLeaf || atBoundary;

  out.push({ nodeId, indent: relDepth, showDetail });

  if (atBoundary || isLeaf) return;

  for (const childId of node.childIds ?? []) {
    walk(tree, childId, relDepth + 1, maxDepth, out);
  }
}
