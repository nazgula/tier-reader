import type { Node, NodeId, Tree } from "@tier-reader/core";

export interface AgentSpec {
  id: string;
  domain: string;
  description: string;
  tagFilters?: string[];
  entityFilters?: string[];
}

/** Embeds a batch of texts into vectors. Tests pass a deterministic stub. */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

export interface RouteOpts {
  embedder: Embedder;
  /** Cosine similarity floor for Step B. Default 0.3. */
  threshold?: number;
  /**
   * Relative depth from each top-level subtree at which to evaluate candidates.
   * 0 (default) = top-level subtrees only; 1 = also descend one level; etc.
   * Each candidate is at most one selected ancestor per resulting set.
   */
  maxDepth?: number;
  /** When true, skip Step B (similarity). Only tag/entity filter applies. */
  filterOnly?: boolean;
  /** When true, skip Step A (filter). Only similarity rank applies. */
  embeddingOnly?: boolean;
  /**
   * When Step A returns zero survivors, fall through to Step B over all
   * candidates instead of returning empty. Default true. Set false to
   * preserve strict set-intersection semantics (used by the
   * `tier-filter-only` benchmark ablation).
   */
  fallbackOnEmpty?: boolean;
  /** Optional instrumentation hook. Library stays log-free; callers wire it. */
  trace?: (event: RouteTraceEvent) => void;
}

export interface RouteTraceEvent {
  agentId: string;
  candidateIds: NodeId[];
  stepASurvivorIds: NodeId[];
  /** Whether Step A was empty and fallback engaged (treats all candidates as survivors for Step B). */
  fallbackEngaged: boolean;
  stepBSurvivorIds: NodeId[];
}

export interface RouteResultEntry {
  node: Node;
  /** Cosine similarity vs agent description. `null` if Step B was skipped. */
  similarity: number | null;
  /** Tag/entity overlap counted in Step A. 0 if filter empty (auto-pass). */
  filterMatches: number;
}

export type CompileFormat = "bullets" | "prose";

export interface CompileOpts {
  /** Token budget. Char/4 estimator unless `tokenEstimate` is set. */
  budget: number;
  format?: CompileFormat;
  /**
   * Optional token estimator. Default approximates 1 token ≈ 4 chars.
   */
  tokenEstimate?: (text: string) => number;
  /** Hard ceiling on `renderAt` depth used during the binary search. Default 6. */
  maxDepth?: number;
}

export interface CompileResult {
  text: string;
  tokenEstimate: number;
  /** Relative depth used for the renderAt walk on each subtree. */
  depth: number;
  subtreeIds: NodeId[];
  format: CompileFormat;
}

export type { Node, NodeId, Tree };
