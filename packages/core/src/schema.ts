import { z } from "zod";

export type NodeId = string;

export interface Node {
  id: NodeId;
  parentId: NodeId | null;
  depth: number;
  index: number;

  title: string;
  detail?: string;

  hasChildren: boolean;
  childIds?: NodeId[];

  kind?: string;
  kindSuggestion?: string;
  tags?: string[];
  entities?: string[];

  sourceSpan?: { start: number; end: number };
  tokenEstimate?: number;
}

export interface Tree {
  rootIds: NodeId[];
  nodes: Record<NodeId, Node>;
  source: string;
  sourceHash: string;
  meta: { model: string; createdAt: string; version: 1 };
}

export interface RenderEntry {
  nodeId: NodeId;
  indent: number;
  showDetail: boolean;
}

export type RenderPlan = RenderEntry[];

export const STARTER_KINDS = [
  "definition",
  "claim",
  "example",
  "evidence",
  "caveat",
  "citation",
  "narrative",
  "data",
  "procedure",
] as const;

export interface RawNode {
  title: string;
  detail?: string;
  kind?: string;
  kindSuggestion?: string;
  tags?: string[];
  entities?: string[];
  children?: RawNode[];
}

export interface RawTree {
  roots: RawNode[];
}

/**
 * JSON-Schema-friendly finite-depth Raw schema. Recursion is unrolled to MAX_DEPTH
 * so AI SDK's structured-output translation produces a concrete schema (not `any`),
 * giving the model a proper hint about nested shape. Runtime trees deeper than this
 * are not rejected — the validator stops describing structure beyond MAX_DEPTH and
 * lets `z.unknown()` accept whatever arrives.
 */
const MAX_SCHEMA_DEPTH = 4;

const baseFields = {
  title: z.string().min(1),
  detail: z.string().optional(),
  kind: z.string().optional(),
  kindSuggestion: z.string().optional(),
  tags: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(),
} as const;

function buildRawNodeSchema(depth: number): z.ZodType<RawNode> {
  if (depth <= 0) {
    return z.object({
      ...baseFields,
      children: z.array(z.unknown()).optional(),
    }) as unknown as z.ZodType<RawNode>;
  }
  return z.object({
    ...baseFields,
    children: z.array(buildRawNodeSchema(depth - 1)).optional(),
  }) as unknown as z.ZodType<RawNode>;
}

export const RawNodeSchema: z.ZodType<RawNode> = buildRawNodeSchema(MAX_SCHEMA_DEPTH);

export const RawTreeSchema: z.ZodType<RawTree> = z.object({
  roots: z.array(RawNodeSchema).min(1),
}) as unknown as z.ZodType<RawTree>;
