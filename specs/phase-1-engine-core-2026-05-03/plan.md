# Phase 1 — Plan

Status: 1 [x], 2 [x], 3 [x], 4 [x], 5 [x], 6 [x], 7 [x]

## 1. [x] Repo scaffold

- `package.json` workspace root, `pnpm-workspace.yaml` (`packages/*`, `apps/*`, `examples/*`).
- `turbo.json` with `build`, `test`, `lint`, `typecheck` pipelines.
- `tsconfig.base.json` (strict, ES2022, NodeNext).
- `biome.json` (formatter + linter).
- `.nvmrc` = 22; root `package.json` `engines.node = ">=22"`.
- Root scripts: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## 2. [x] `packages/core` skeleton

- `packages/core/package.json` (name `@tier-reader/core`, private for now; deps: `ai`, `@ai-sdk/anthropic`, `langfuse`, `zod`).
- `src/schema.ts` — `Node`, `Tree`, `NodeId`, `RenderPlan` types; Zod schema for the model's structured output (titles + structure).
- `src/provider/index.ts` — `Provider` interface (`call(prompt, opts) → Promise<string>` and structured-call variant).
- `src/trace.ts` — Langfuse wrapper; env-gated (`LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`); becomes a no-op if env missing so tests don't require Langfuse.
- `src/index.ts` — public exports.

## 3. [x] Provider adapters

- `src/provider/ai-sdk.ts` — wraps `ai` + `@ai-sdk/anthropic`; defaults to `claude-haiku-4-5-20251001`; supports `generateObject` for structured output.
- `src/provider/byo.ts` — accepts user-supplied `{ call(prompt): Promise<string> }`; falls back to JSON-parse when structured calls aren't available.
- Both routed through `trace.ts`.

## 4. [x] One-shot `decompose()`

- `src/decompose.ts` — `decompose(input, opts) → Promise<Tree>`.
- Prompt: instruct model to produce nested outline with info-dense titles, leaf `detail` = verbatim source spans, free-form `kind` with starter set hint, fanout 3–7, default depth 3.
- Use AI SDK `generateObject` with Zod schema for nested structure.
- Post-process: assign structural ids (`"0"`, `"0.1"`, `"0.1.0"`), flatten into `nodes` map, populate `parentId` / `depth` / `index` / `childIds` / `hasChildren`, compute `sourceHash`.
- Validation: leaves carry `detail`; non-leaves don't; `concat(leaf.detail) ≈ source` (whitespace-tolerant).

## 5. [x] `renderAt()`

- `src/render.ts` — `renderAt(tree, nodeId, expandToDepth) → RenderPlan`.
- Returns flat list `{ nodeId, indent, showDetail }` walking subtree to depth, marking `showDetail` on leaves at the boundary.

## 6. [x] Fixtures + tests

- `packages/core/test/fixtures/` — `wikipedia-paragraph.txt`, `ai-chat-answer.txt`, `tech-doc-snippet.txt`, `short-essay.txt`, `list-heavy.txt`.
- For deterministic tests: a `MockProvider` returning canned structured output keyed by `sourceHash`. Real Anthropic calls only run under `RUN_LIVE=1` (dev/iteration mode).
- Snapshot tests on rendered tree shape (titles + structure, not full detail blobs).
- Structural-validity tests: id format, parent/child consistency, leaf-only `detail`, source reconstruction.
- `renderAt` tests: depth 0/1/2 behavior, leaf boundary marking.

## 7. [x] Prompt iteration + CLI example

- `RUN_LIVE=1 pnpm vitest run --testNamePattern=live` to call real Haiku and refresh `MockProvider` canned outputs.
- Iterate prompt until: snapshots stable across 3 consecutive runs at temperature 0; spot-check titles read as one-liners (~12 words, info-dense).
- `examples/decompose-cli.ts` — reads stdin, calls `decompose()` with AI SDK provider, pretty-prints tree (indented title list).

## Architecture impact

Lands the §3 layout (`packages/core/` with `schema.ts`, `decompose.ts`, `render.ts`, `provider/`, `trace.ts`) exactly as already drawn. No changes to §0/§1/§2/Invariants. `/finish-phase` should mark these as "shipped" in §3 by removing the "← phase N" hints for `packages/core`.
