import { createHash } from "node:crypto";
import { buildDecomposePrompt } from "./prompt.js";
import type { Provider } from "./provider/index.js";
import {
  type Node,
  type NodeId,
  type RawNode,
  RawTreeSchema,
  STARTER_KINDS,
  type Tree,
} from "./schema.js";

export interface DecomposeOpts {
  provider: Provider;
  model?: string;
  maxDepth?: number;
  fanoutHint?: [number, number];
  starterKinds?: readonly string[];
  signal?: AbortSignal;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export async function decompose(input: string, opts: DecomposeOpts): Promise<Tree> {
  if (!input.trim()) throw new Error("decompose: input is empty");

  const model = opts.model ?? DEFAULT_MODEL;
  const maxDepth = opts.maxDepth ?? 3;
  const fanoutHint = opts.fanoutHint ?? [3, 7];
  const starterKinds = opts.starterKinds ?? STARTER_KINDS;

  const prompt = buildDecomposePrompt(input, { maxDepth, fanoutHint, starterKinds });
  const raw = await opts.provider.callStructured(prompt, RawTreeSchema, {
    model,
    signal: opts.signal,
    traceName: "decompose",
  });

  const nodes: Record<NodeId, Node> = {};
  const rootIds: NodeId[] = [];

  raw.roots.forEach((rootRaw, i) => {
    const id = String(i);
    walk(rootRaw, id, null, 0, i, nodes);
    rootIds.push(id);
  });

  return {
    rootIds,
    nodes,
    source: input,
    sourceHash: hash(input),
    meta: {
      model,
      createdAt: new Date().toISOString(),
      version: 1,
    },
  };
}

function walk(
  raw: RawNode,
  id: NodeId,
  parentId: NodeId | null,
  depth: number,
  index: number,
  nodes: Record<NodeId, Node>,
): void {
  const children = raw.children ?? [];
  const hasChildren = children.length > 0;

  if (hasChildren && raw.detail !== undefined) {
    // Non-leaves must not have detail; drop quietly.
    raw.detail = undefined;
  }

  const node: Node = {
    id,
    parentId,
    depth,
    index,
    title: raw.title.trim(),
    hasChildren,
  };

  if (!hasChildren && raw.detail !== undefined) node.detail = raw.detail;
  if (raw.kind !== undefined) node.kind = raw.kind;
  if (raw.kindSuggestion !== undefined) node.kindSuggestion = raw.kindSuggestion;
  if (raw.tags !== undefined && raw.tags.length > 0) node.tags = raw.tags;
  if (raw.entities !== undefined && raw.entities.length > 0) {
    node.entities = raw.entities.map((e) => e.toLowerCase());
  }

  if (hasChildren) {
    const childIds: NodeId[] = [];
    children.forEach((childRaw, ci) => {
      const childId = `${id}.${ci}`;
      walk(childRaw, childId, id, depth + 1, ci, nodes);
      childIds.push(childId);
    });
    node.childIds = childIds;
  }

  nodes[id] = node;
}

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
