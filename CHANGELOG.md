# Changelog

User-visible changes per phase. Newest first.

## 2026-05-05 — Phase 2: Engine large-text strategy

- `detectTier(input, opts?)` — char-based classifier returning `"small" | "medium" | "large"` with overridable thresholds (defaults: `< 8k` small, `< 40k` medium, `≥ 40k` large). Phase 2.5 may revisit with token-accurate logic.
- `decompose()` now dispatches by tier; the existing one-shot path is the small case. New `tier`, `tierThresholds`, and `synthesisMerge` opts on `DecomposeOpts` (all additive — small-input behavior unchanged).
- **Medium tier:** pass-1 outline (titles + char spans) followed by pass-2 per-section small-tier decompose in parallel (concurrency cap 4). Sections stitched as the merged tree's roots.
- **Large tier:** `chunkByStructure()` splits on markdown headings (fall-back: paragraph packing up to ~15k chars). Chunks decompose sequentially; an LLM synthesis-merge call (default on) re-groups chunk roots into one cohesive 3–7-section top-level outline. With `synthesisMerge: false`, chunk roots become siblings under a synthetic root in source order. Dropped chunks are appended under "Additional content" so source-reconstruction holds.
- New fixtures: `medium-multi-section.txt` (~10.5KB) and `wikipedia-50k.txt` (~50.5KB). New tests cover tier detection, medium dispatch, large dispatch with merge on/off, and `chunkByStructure` contiguity.
- Playground: tier badge (predicted-from-input until decompose returns the resolved tier) and a "synthesis merge" checkbox surfaced only when input is large. `/api/decompose` accepts `tier` + `synthesisMerge` and returns `{ tree, tier }`.
- Architecture doc: new "Seam behavior (large tier)" subsection under Invariants describing what's accepted for v1.

## 2026-05-05 — Phase 1.5: Visual playground + structure-respect opt

- New `apps/playground/` workspace app — local Vite + React app wrapping `decompose()`. Three-mode tree view (Discovery / Overview / Full) with click-to-toggle drill-down, fixture picker over the existing 5 fixtures, raw-JSON pane.
- `/api/decompose` and `/api/fixtures[/:name]` Vite middlewares run server-side; `ANTHROPIC_API_KEY` lives in `apps/playground/.env.local` and never reaches the browser.
- `DecomposeOpts.respectStructure` (default `false`) on `@tier-reader/core`. When `true`, the prompt instructs the model to honor source structural units — paragraphs are kept whole, heading-marked sections group paragraphs, lists are units, and the 3–6 top-level floor yields to structure.
- `@tier-reader/core` now ships compiled `dist/` exports plus a `./render` subpath for browser bundles that need only `renderAt` (avoids pulling `node:crypto`).
- Deeper prompt-quality iteration (parent/child paraphrase, over-division of cohesive "X but Y", structure-respect edge cases) reframed as perpetual work in `core/src/prompt.ts`, not phase-bound.

## 2026-05-04 — Phase 1: Engine core (small-tier decomposition)

- pnpm + Turborepo workspace with Biome, Vitest, and TypeScript on Node 22.
- `@tier-reader/core` package: schema types, one-shot `decompose()` for small inputs, `renderAt()` helper.
- Provider layer: Vercel AI SDK adapter (Anthropic, default `claude-haiku-4-5-20251001`) and BYO `{ call(prompt) }` escape hatch, both routed through env-gated Langfuse tracing.
- Five test fixtures (Wikipedia paragraph, AI chat answer, technical doc, short essay, list-heavy) with snapshot tests, structural-validity assertions, and source-reconstruction checks via a `MockProvider`.
- Finite-depth Raw schema (depth 4) so AI SDK produces a concrete JSON Schema for structured output instead of falling back to `any`.
- `examples/decompose-cli.ts` — pipe text into stdin, get a printed tree.
