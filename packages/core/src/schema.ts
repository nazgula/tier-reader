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

export const RawNodeSchema: z.ZodType<RawNode> = z.lazy(() =>
  z.object({
    title: z.string().min(1),
    detail: z.string().optional(),
    kind: z.string().optional(),
    kindSuggestion: z.string().optional(),
    tags: z.array(z.string()).optional(),
    entities: z.array(z.string()).optional(),
    children: z.array(RawNodeSchema).optional(),
  }),
);

export interface RawNode {
  title: string;
  detail?: string;
  kind?: string;
  kindSuggestion?: string;
  tags?: string[];
  entities?: string[];
  children?: RawNode[];
}

export const RawTreeSchema = z.object({
  roots: z.array(RawNodeSchema).min(1),
});

export type RawTree = z.infer<typeof RawTreeSchema>;
