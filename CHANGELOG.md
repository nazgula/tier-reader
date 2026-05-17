# Changelog

User-visible changes per phase. Newest first.

## 2026-05-18 — Phase 3: Context-compiler library + benchmark (routing experiment, closed early)

- New `packages/context-compiler/` workspace package with `route(tree, agent, opts?)` (hybrid filter + Voyage cosine-similarity rank, with 3.1 lowercased-substring relaxation and `fallbackOnEmpty` default) and `compile(nodes, budget, format)` (budget-fitting depth walk with `bullets` / `prose` output formats). `AgentSpec` shape `{ id, domain, description, tagFilters?, entityFilters? }`.
- Optional `tags?: string[]` and `entities?: string[]` on `Node` in `@tier-reader/core`. Decompose prompt was extended to emit them. The schema fields are retained for future router consumers but `core` itself does not consume them in v1.
- Benchmark harness under `packages/context-compiler/benchmarks/` — five conditions (`flat-broadcast`, `dacs-focus`, `tier-hybrid`, `tier-filter-only`, `tier-embed-only`), three roster sizes (N=3, 5, 10), 13-entry curated dataset (11 single-turn + 2 multi-turn including a Hebrew BringUp arc), three judges (steering, output-quality, propagation), cost guards with hard token caps, content-hash embedding cache, resume support, `--trace` flag for per-cell step-A/step-B logging.
- **Closed early 2026-05-17.** The routing experiment did not produce a defensible win. Three structural blockers surfaced: multi-agent fan-out is structurally rare in public chat dumps (3.2 already conceded this and shipped 13 entries instead of the originally-targeted ≥20); open-set tag emission cannot reliably align with arbitrary downstream agent filters (the 3.4 smoke triage found `decompose()` against a real model emits `tags=[]`/`entities=[]` on every node, and the canned-provider unit tests missed it); multi-turn propagation in the smoke trended worse than `flat-broadcast` (N=1, wrong direction on the central thesis). Decision: ship the durable tier structure as v1, treat sub-turn routing as a research direction. Routing code remains in the repo as research artifact; it is **not** part of the v1 NPM-published surface.
- Full `pnpm bench` was never run; only the smoke (`pnpm bench:smoke`) executed. The investigation record lives in `specs/phase-3-context-compiler-2026-05-08/plan.md` (group 3.4 archived) and `packages/context-compiler/benchmarks/findings.md` ("Open investigation — tag emission" section).
- Salvaged: the long-AI-chat decomposition + reflection-agent eval (originally Phase 3 plan.md group 5, pure tier-structure work) moves to **Phase 3.1** in the roadmap. NPM publish prep moves to "Deferred / Under Evaluation" with a clear trigger; LinkedIn post #1 (Phase 4) rethemed around the engine itself.
- Architecture: new invariants in `docs/architecture.md` recording (a) v1 published surface ≠ in-tree code, (b) decompose prompt-emission invariants are not gated by unit tests (broader gap tracked under roadmap → Deferred → *Automated output-quality tests / real-model prompt gate*).

## 2026-05-07 — Phase 2.5: Agent tactics deep dive (research + experimentation)

- Surveyed prior art on long-document decomposition and progressive disclosure (hierarchical summarization, RAPTOR, BooookScore, NexusSum, Anthropic context engineering, NN/g progressive disclosure). Findings written up at `specs/phase-2_5-.../findings.md`.
- Built and then removed a prompt-variant registry: three variants (`v-bubble-up`, `v-paragraph-leaf`, `v-fanout-strict`) on top of a `default` baseline, with `DecomposeOpts.promptVersion` plumbed through small/medium/large strategies. Experiment surfaced the right answer; the registry was unneeded once we knew what to do.
- **Bug fix:** the pre-2.5 default was dropping each paragraph's opening sentence into the parent title and never emitting it as a leaf — verbatim source-reconstruction was silently broken. Three rules folded into the default prompt fix it: PARAGRAPH-AS-LEAF with verbatim detail, NO PARENT WITH ONE PARAPHRASING CHILD, and "section title must reflect the whole section, not just paragraph 1."
- New invariant in `docs/architecture.md`: verbatim reconstruction (concatenating leaf `detail` in tree order ≈ source).
- New manual spotcheck script at `examples/spotcheck-phase-2_5.ts` (`pnpm --filter examples spotcheck:phase-2_5`) decomposes a fixture, dumps the tree to `specs/phase-2_5-.../spotchecks/default.json`, and prints reconstruction Jaccard + single-child smell counts. Last live run: Jaccard 0.992, no smells.
- Parked for later (roadmap.md → Deferred): bubble-up as a real multi-call pipeline (per-paragraph → per-section synthesis → root); automated live-LLM output-quality tests in CI; runtime reconstruction guard inside `decompose()`.

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
