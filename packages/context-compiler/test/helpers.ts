import type { Node, NodeId, Tree } from "@tier-reader/core";
import type { Embedder } from "../src/index.js";

export interface NodeSpec {
  title: string;
  detail?: string;
  tags?: string[];
  entities?: string[];
  children?: NodeSpec[];
}

/**
 * Build a Tree from a hand-written nested spec. Single-root: spec describes the
 * root. ids are assigned as "0", "0.0", "0.0.1", ... matching the engine's
 * structural id convention.
 */
export function buildTree(spec: NodeSpec): Tree {
  const nodes: Record<NodeId, Node> = {};
  const rootId = "0";
  attach(spec, rootId, null, 0, 0, nodes);
  return {
    rootIds: [rootId],
    nodes,
    source: "synthetic",
    sourceHash: "test",
    meta: { model: "stub", createdAt: "1970-01-01T00:00:00Z", version: 1 },
  };
}

function attach(
  spec: NodeSpec,
  id: NodeId,
  parentId: NodeId | null,
  depth: number,
  index: number,
  nodes: Record<NodeId, Node>,
): void {
  const childIds: NodeId[] = (spec.children ?? []).map((_, i) => `${id}.${i}`);
  nodes[id] = {
    id,
    parentId,
    depth,
    index,
    title: spec.title,
    detail: spec.detail,
    tags: spec.tags,
    entities: spec.entities,
    hasChildren: childIds.length > 0,
    childIds: childIds.length ? childIds : undefined,
  };
  (spec.children ?? []).forEach((child, i) => {
    attach(child, childIds[i] as NodeId, id, depth + 1, i, nodes);
  });
}

/**
 * Deterministic stubbed embedder. Maps each token (lowercased word) to a slot
 * in a 32-dim vector via a stable hash. Cosine over these reflects shared
 * vocabulary — enough for tests to assert ranking is title-driven.
 */
export function stubEmbedder(): Embedder {
  return {
    async embed(texts: string[]): Promise<number[][]> {
      return texts.map(toVector);
    },
  };
}

function toVector(text: string): number[] {
  const dim = 32;
  const v = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    const idx = hashStr(tok) % dim;
    v[idx] = (v[idx] ?? 0) + 1;
  }
  return v;
}

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Build an embedder that maps texts to caller-specified vectors. */
export function fixedEmbedder(map: Record<string, number[]>): Embedder {
  return {
    async embed(texts: string[]): Promise<number[][]> {
      return texts.map((t) => {
        const v = map[t];
        if (!v) throw new Error(`fixedEmbedder: no vector for ${JSON.stringify(t)}`);
        return v;
      });
    },
  };
}
