# Node Schema v1

Contract shared by both consumers: tier-reader (human progressive disclosure) and context-compiler (per-agent context routing). Engine produces this; consumers read it.

## Shape

```ts
type NodeId = string; // dotted path, encodes structure: "0", "0.2", "0.2.1"

interface Node {
  id: NodeId;
  parentId: NodeId | null;
  depth: number;
  index: number;          // position among siblings

  // Content
  title: string;          // ALWAYS present. Info-dense, learn-from-it. ~12 words.
  detail?: string;        // Verbatim source. Only on leaves.

  // Structure
  hasChildren: boolean;   // known at emission, before children arrive
  childIds?: NodeId[];    // filled in when known

  // Semantic — for routing, filtering, styling
  kind?: string;          // free-form; prompt suggests a starter set
  kindSuggestion?: string;// only when kind === "other": model's proposed label
  tags?: string[];        // open-set domain tags ("physics", "biography")
  entities?: string[];    // named entities, lowercased

  // Provenance
  sourceSpan?: { start: number; end: number }; // char offsets into source

  // Routing meta
  tokenEstimate?: number;
}

interface Tree {
  rootIds: NodeId[];
  nodes: Record<NodeId, Node>;
  source: string;
  sourceHash: string;
  meta: { model: string; createdAt: string; version: 1 };
}
```

## Design decisions

### No `summary` field
The tree itself is the tier system. Each level is already a compression of the level below — adding a stored `summary` creates a parallel, competing compression that produces noise (validated empirically). When a consumer needs prose instead of a hierarchy, the engine linearizes a subtree's titles into prose at render time. Reintroduce only if benchmarks force it.

### `kind` is free-form, not an enum
Bottom-up taxonomy. Prompt provides a recommended starter set (`definition | claim | example | evidence | caveat | citation | narrative | data | procedure`). Model picks the closest fit; if nothing matches, sets `kind: "other"` AND `kindSuggestion: "<label>"`. The separation cleanly distinguishes "picked from menu" from "invented." Mine `kindSuggestion` frequencies offline; promote recurring ones into the starter set in v2.

### `kind` (closed-ish), `tags` (open), `entities` (open) are separate
- `kind` styles renderers (citations look different from claims).
- `tags` route to agents by domain.
- `entities` route by named-entity match.
Collapsing them into one `tags[]` loses the distinction.

### Flat node map, not nested JSON
`nodes: Record<id, Node>` with parent/child pointers. Reasons:
- Streaming: emit nodes as decomposed; render on arrival.
- Routing: context-compiler iterates, doesn't traverse.
- Overrides: tier-reader's UI override map keys cleanly off stable ids.

### Stable structural ids ("0.2.1")
Encodes position, depth, lineage. Easier to debug than uuids. Survives re-decomposes for stable user overrides.

### `hasChildren` separate from `childIds`
Streaming need: you know "this is a parent" before you know which children. Renderers show a chevron immediately; resolve children later. Without this, streaming UI flickers.

### Adaptive structure, no hard fanout/depth in schema
Schema permits any shape. Per-level fanout and depth limits live in the *prompt* as soft guidance ("aim 3–7 children, deeper only when content warrants"), not in the type. Lets unusual inputs (50-section legal doc, 3-paragraph essay) get appropriate trees.

### `sourceSpan` alongside `detail` (intentional redundancy)
Leaves have both: `detail` is what renderers display; `sourceSpan` lets non-leaf nodes reference their range without duplicating text (saves tokens), supports highlighting in original, and verifies the "concat all leaves = original input" invariant.

## Streaming wire format

NDJSON of operations against the node map:

```
{"op":"add","node":{"id":"0","parentId":null,"hasChildren":true,...}}
{"op":"add","node":{"id":"0.0","parentId":"0",...}}
{"op":"patch","id":"0","fields":{"childIds":["0.0","0.1"]}}
```

Engine emits, consumer reduces into `Tree`. Replaces the current code's monolithic `JSON.parse` (which is what truncates today on large inputs).

## Open questions

See `docs/api.md` § Open questions.
