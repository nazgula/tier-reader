# Architecture

Live map of how the system is wired. Updated by `/finish-phase` as components land. See `specs/mission.md` and `specs/tech-stack.md` for *why*; this doc is *what and where*.

## 1. System topology

```
+--------------------------+        +-------------------+        +--------------------+
| User's Chrome (phase 5+) |        | NPM consumers     |        | Anthropic API      |
|  - Extension popup       |        | (any Node + TS    |        | (api.anthropic.com)|
|  - Content script        |  --→   |  app importing    |  --→   +--------------------+
|  - chrome.storage.local  |        |  @tier-reader/* / |                  ↑
|    (API key, settings)   |        |  context-compiler)|                  | via Vercel AI SDK
+--------------------------+        +-------------------+                  | or BYO call()
              │ uses                          │ uses                       │
              ▼                               ▼                            │
       @tier-reader/react   ───→    @tier-reader/core   ─────────────────  ┘
                                          ▲
                                          │ uses
                                   context-compiler
                                          │ traces to
                                          ▼
                                   Langfuse cloud
```

## 2. Runtime workflow — one decomposition

```
input text
   │
   ▼
detectTier(input, model)
   │
   ├──── small ────► decompose() one-shot ──┐
   │                                         │
   ├──── medium ───► pass 1: top-level       │
   │                 outline (titles only)   │
   │                          │              │
   │                 pass 2: per-section     │
   │                 decompose in parallel ──┤
   │                                         │
   └──── large ────► chunkByStructure()      │
                              │              │
                     decompose each chunk    │
                              │              │
                     synthesize: merge ──────┤
                     chunk roots             │
                                             ▼
                                        Tree (in-memory)
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       ▼                     ▼                     ▼
                  renderAt(tree,       route(tree, agent)    serialize / cache
                  id, depth)                  │                     │
                       │                      ▼                     ▼
                       ▼               compile(nodes,         (future: persist
                  RenderPlan           budget, format)          decompositions)
                       │                      │
                       ▼                      ▼
                  React renderer        per-agent context slice
```

## 3. Repo layout

```
tier-reader/
├─ packages/
│  ├─ core/                        ← @tier-reader/core
│  │  ├─ src/
│  │  │  ├─ schema.ts              types per docs/schema.md
│  │  │  ├─ decompose.ts           one-shot + tiered dispatch
│  │  │  ├─ tier.ts                detectTier, small/medium/large
│  │  │  ├─ render.ts              renderAt
│  │  │  ├─ provider/
│  │  │  │  ├─ ai-sdk.ts           Vercel AI SDK adapter
│  │  │  │  └─ byo.ts              { call(prompt) } escape hatch
│  │  │  └─ trace.ts               Langfuse wrapping
│  │  └─ test/
│  ├─ context-compiler/            ← context-compiler
│  │  ├─ src/
│  │  │  ├─ route.ts               route(tree, agent) → Node[]
│  │  │  ├─ compile.ts             compile(nodes, budget, format) → string
│  │  │  └─ index.ts
│  │  ├─ benchmarks/               20-message benchmark + results.json
│  │  └─ test/
│  └─ react/                       ← @tier-reader/react
│     ├─ src/
│     └─ test/
├─ apps/
│  ├─ extension/                   ← phase 5
│  │  ├─ manifest.json             (manifest v3)
│  │  ├─ src/
│  │  │  ├─ content.tsx
│  │  │  ├─ options.tsx
│  │  │  └─ background.ts
│  │  └─ test/
│  └─ playground/                  ← optional, hosts current tier-reader.jsx during phases 1–4
├─ specs/                          ← constitution (mission, tech-stack, roadmap, per-phase folders)
├─ docs/                           ← live docs (this file, schema, api)
├─ package.json                    ← pnpm workspace root
├─ pnpm-workspace.yaml
├─ turbo.json
├─ biome.json
└─ tsconfig.base.json
```

**Dependency direction (no cycles):**

```
apps/extension              → packages/react
packages/react              → packages/core
packages/context-compiler   → packages/core
packages/core               → (no internal deps; only Vercel AI SDK + Langfuse)
```

## Invariants

- `core` has zero browser-only dependencies; runs in Node.
- `react` has no Anthropic / OpenAI client deps; calls into `core` only.
- The extension never embeds an API key; it reads from `chrome.storage.local`.
- All LLM calls in `core` go through the trace-wrapped provider interface (no direct fetches outside `provider/`).
- Schema version is the literal `1`; bumping requires a migration note here.
- `tier-reader.jsx` (root prototype) is *not* on any dependency path of the shipped packages — it's a pre-existing reference until phase 5 supersedes it.

## What this doc tracks going forward

`/finish-phase` updates this file when a phase changes any of:

- Routes / endpoints (extension messaging, etc.)
- Persistent state shape (`chrome.storage` keys, on-disk fixtures, NPM package boundaries)
- Runtime workflow (the diagram in §2)
- Invariants

Most phases will add to §1, §2, or §3.
