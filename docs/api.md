# Engine API — sketch

Public surface of `@tier-reader/core`. Framework-agnostic. Consumers (Chrome extension, React renderer, context-compiler) build on this.

## Core functions

### `decompose`
Turn raw text into a `Tree`.

```ts
decompose(input: string, opts: DecomposeOpts): Promise<Tree>
decomposeStream(input: string, opts: DecomposeOpts): AsyncIterable<NodeOp>
```

Streaming variant emits `NodeOp` (add/patch) as nodes are produced. Non-streaming awaits and returns the full `Tree`.

```ts
interface DecomposeOpts {
  model: string;             // e.g. "claude-haiku-4-5-20251001"
  provider: Provider;        // pluggable; engine doesn't ship API keys
  maxDepth?: number;         // soft hint; default 3
  fanoutHint?: [number, number]; // soft, default [3, 7]
  starterKinds?: string[];   // override default kind starter set
  signal?: AbortSignal;
}
```

### `route` — for context-compiler
Select nodes relevant to one agent's domain.

```ts
route(tree: Tree, agent: AgentSpec): Node[]

interface AgentSpec {
  id: string;
  domain: string;            // natural-language description; embedded for matching
  tagFilters?: string[];     // hard filters
  entityFilters?: string[];
}
```

### `compile` — for context-compiler
Take selected nodes + a token budget, walk each subtree to the depth that fits, and produce the per-agent context slice.

```ts
compile(nodes: Node[], tree: Tree, opts: CompileOpts): string

interface CompileOpts {
  budgetTokens: number;
  format: "bullets" | "prose"; // prose = linearize titles into paragraphs
}
```

### `renderAt` — for tier-reader
Single helper a renderer uses to ask "show me this node at depth D."

```ts
renderAt(tree: Tree, nodeId: NodeId, expandToDepth: number): RenderPlan
```

Returns a flat list of `{nodeId, indent, showDetail}` so the React layer stays dumb.

## Layering

```
@tier-reader/core         decompose, route, compile, renderAt, schema, providers
  ├─ context-compiler     thin wrapper exposing decompose + route + compile + benchmark
  ├─ @tier-reader/react   thin renderer over renderAt (replaces current JSX)
  └─ chrome-extension     content script + popup over @tier-reader/react
```

See `docs/architecture.md` § 3 for the on-disk repo layout and dependency direction.

---

For the *why* behind generation mode, large-text strategy, provenance, provider abstraction, and extension key handling, see `specs/tech-stack.md`. This document only describes the public function surface.
