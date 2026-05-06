import { createHash } from "node:crypto";
import { decomposeLarge } from "./decompose-large.js";
import { decomposeMedium } from "./decompose-medium.js";
import { buildDecomposePrompt } from "./prompt.js";
import type { Provider } from "./provider/index.js";
import {
  type Node,
  type NodeId,
  type RawNode,
  type RawTree,
  RawTreeSchema,
  STARTER_KINDS,
  type Tree,
} from "./schema.js";
import { type Tier, type TierThresholds, detectTier } from "./tier.js";

export interface DecomposeOpts {
  provider: Provider;
  model?: string;
  maxDepth?: number;
  fanoutHint?: [number, number];
  starterKinds?: readonly string[];
  /**
   * When true, the prompt instructs the model to honor source structural units
   * (paragraphs, sections, lists) — paragraphs are kept whole, sections group
   * paragraphs, and the 3-6 top-level floor yields to structure. Default false.
   */
  respectStructure?: boolean;
  /** Force a specific tier; bypasses detectTier. */
  tier?: Tier;
  /** Override default char thresholds for tier detection. */
  tierThresholds?: Partial<TierThresholds>;
  /**
   * Large-tier only: when true (default), an extra LLM call merges the chunk
   * roots into a single cohesive top-level outline. When false, chunk roots
   * become siblings under a synthetic root in source order.
   */
  synthesisMerge?: boolean;
  signal?: AbortSignal;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export async function decompose(input: string, opts: DecomposeOpts): Promise<Tree> {
  if (!input.trim()) throw new Error("decompose: input is empty");

  const model = opts.model ?? DEFAULT_MODEL;
  const tier =
    opts.tier ?? detectTier(input, opts.tierThresholds ? { thresholds: opts.tierThresholds } : {});

  let raw: RawTree;
  if (tier === "small") {
    raw = await decomposeSmallRaw(input, opts, model);
  } else if (tier === "medium") {
    raw = await decomposeMedium(input, { ...opts, model }, decomposeSmallRaw);
  } else {
    raw = await decomposeLarge(input, { ...opts, model }, decomposeSmallRaw);
  }

  return rawToTree(raw, input, model);
}

/**
 * Single-shot decompose against an arbitrary source string. Returns the raw,
 * un-stitched tree shape so medium/large strategies can compose multiple calls
 * before final id-walking.
 */
export async function decomposeSmallRaw(
  input: string,
  opts: DecomposeOpts,
  model: string,
): Promise<RawTree> {
  const maxDepth = opts.maxDepth ?? 3;
  const fanoutHint = opts.fanoutHint ?? [3, 7];
  const starterKinds = opts.starterKinds ?? STARTER_KINDS;

  const prompt = buildDecomposePrompt(input, {
    maxDepth,
    fanoutHint,
    starterKinds,
    respectStructure: opts.respectStructure ?? false,
  });
  return opts.provider.callStructured(prompt, RawTreeSchema, {
    model,
    signal: opts.signal,
    traceName: "decompose",
  });
}

export function rawToTree(raw: RawTree, source: string, model: string): Tree {
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
    source,
    sourceHash: hash(source),
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

export type DecomposeSmallRawFn = typeof decomposeSmallRaw;
