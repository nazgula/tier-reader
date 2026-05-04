# Phase 1 — Engine core (small-tier decomposition)

## Why

Stand up `@tier-reader/core` with a working one-shot `decompose()` for small inputs — the substrate every later deliverable (context-compiler, React renderer, extension) builds on. Without this, no other phase can start.

## In scope

- pnpm + Turborepo monorepo scaffold (Node 22 LTS, Biome, Vitest, `tsc --noEmit`).
- `packages/core` with:
  - `schema.ts` — types per `docs/schema.md` (Node, Tree, NodeId).
  - Provider interface + adapters: `provider/ai-sdk.ts` (Vercel AI SDK / Anthropic) and `provider/byo.ts` (`{ call(prompt) }`).
  - `trace.ts` — Langfuse wrapping; all LLM calls go through it.
  - `decompose.ts` — one-shot small-tier decomposition (single-prompt → structured output → Tree assembly with structural ids).
  - `render.ts` — `renderAt(tree, nodeId, depth) → RenderPlan`.
- 5+ handcrafted fixtures (Wikipedia paragraph, AI chat answer, technical doc snippet, short essay, list-heavy snippet) with snapshot tests + structural-validity assertions.
- Prompt iteration loop until snapshots stable + spot-check passes.
- `examples/decompose-cli.ts` — stdin → printed tree.

## Out of scope

- `detectTier`, medium and large strategies (phase 2).
- `route` / `compile` (phase 3).
- `@tier-reader/react` package (phase 5).
- Chrome extension (phase 5).
- Streaming generation (deferred).
- LLM-as-judge evaluation (defer until benchmark phase or later).
- NPM publish + license decision (phase 3 gate).
- Moving `tier-reader.jsx` into `apps/playground/` — leave at repo root, untouched.

## Success signal

`pnpm test` is green and `pnpm tsx examples/decompose-cli.ts < fixtures/wikipedia-paragraph.txt` prints a valid tree where titles read as info-dense one-liners and leaf `detail` reconstructs the source.

## Open questions resolved this phase

- **[phase 1] Node version target** → Node 22 LTS, pinned in `engines` and `.nvmrc`.
- **[phase 1] Vitest browser mode** → Skipped this phase. Engine is pure Node logic; no DOM under test. Revisit when the React package lands.
- **[phase 1] Eval methodology for title quality** → Vitest snapshot tests on full trees + manual spot-check on diff. LLM-as-judge deferred.
- **[phase 1] Where does `tier-reader.jsx` live during phases 1–4** → Stays at repo root, untouched. Move into `apps/playground/` (or delete) is phase 5's call.

## Open questions

- None blocking. `fanoutHint` and `maxDepth` defaults from `docs/api.md` carry through; revisit if fixtures expose problems.
