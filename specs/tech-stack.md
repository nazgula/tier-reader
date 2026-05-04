# Tech stack

Concrete choices with one short reason per decision. Where a version is not pinned here, it's because the phase that introduces the dep will pin it.

## Language and runtime

- **TypeScript only.** No Python. — Single-language stack reduces boundaries; engine targets both Node and browser.
- **Browser target:** modern evergreen (current Chrome — extension), no legacy.
- **Node target:** see Open questions ([phase 1]).

## Repo layout

- **Monorepo, pnpm + Turborepo.** — Engine + context-compiler + react + extension share TS config and build cache. pnpm for disk efficiency and strict dep boundaries.
- Workspaces under `packages/` for libraries; `apps/` for the extension and any local playground.

## Test, lint, format

- **Test: Vitest.** — TS-native, fast, watch mode, runs in browser + Node. Single framework across all packages.
- **Lint + format: Biome.** — Single tool, single config, fast. Skip ESLint+Prettier complexity.
- **Type-check:** `tsc --noEmit` per package, cached by Turborepo.

## Model provider

- **Default adapter: Vercel AI SDK (`ai` package).** — Model-agnostic SDK with provider adapters (Anthropic, OpenAI, Google, Bedrock). Streaming-native, structured-output support. Wrapped behind a thin internal interface in the engine so AI SDK API churn doesn't leak into the engine's public API.
- **Escape hatch:** consumer can pass `{ call(prompt): Promise<string> }` for zero-dep or unusual setups. OpenRouter users go through the AI SDK with OpenRouter's endpoint — no special handling needed.
- **No multi-provider abstraction at engine level.** AI SDK already does that.

## Models

- **Default: Claude Haiku 4.5** (`claude-haiku-4-5-20251001`). — Cheapest fast Claude, sufficient for most decomposition.
- **Override per call:** Sonnet 4.6 / Opus 4.7 selectable via opts.
- **Provider for v1:** Anthropic only. AI SDK abstraction means swapping is cheap; we just don't validate other providers.

## Schema and engine policies

Locked decisions for the engine. Full schema lives in `docs/schema.md`; function signatures live in `docs/api.md`; system topology lives in `docs/architecture.md`.

- **Node schema v1.** Flat node map, structural ids (`"0.2.1"`), required `title`, leaf-only `detail`, no `summary` field (tree levels *are* the tier system), free-form `kind` + `kindSuggestion`, optional best-effort `sourceSpan`, `hasChildren` separate from `childIds` for streaming-friendliness.
- **Generation: one-shot for v1.** Streaming deferred (see `roadmap.md` § Deferred). When added, streaming format is **scaffold-then-fill**: parents emitted top-down with `hasChildren: true`, leaves arrive later.
- **Large-text strategy: tiered, picked automatically by engine from input size.**
  - *Small* (fits one context with output budget): one-shot.
  - *Medium* (input fits, full-tree output would truncate): pass 1 = top-level titles only; pass 2 = decompose each section in parallel.
  - *Large* (input doesn't fit): chunk by structural boundaries (headings/paragraphs), decompose chunks independently, synthesis pass merges chunk roots into a single top-level outline. Seams accepted for v1.
- **Source provenance:** `sourceSpan` is optional best-effort. Engine fills when confident, omits otherwise. Consumers must handle absence.

## Observability

- **Langfuse cloud from day 1.** — Real prompt traces, eval views, version comparisons. Free tier covers expected volume. Adds a SDK dep but pays for itself in the benchmark phase.
- **All engine LLM calls go through Langfuse traces** via the provider wrapper (no direct fetches outside `provider/`).
- The benchmark blog post (phase 4) pulls numbers from Langfuse exports + the local `benchmarks/results.json`.

## Chrome extension specifics

- **BYOK** (bring your own Anthropic API key).
- **Storage:** `chrome.storage.local` only — sandboxed per extension, relies on OS user account isolation. Never `chrome.storage.sync` (round-trips through Google's cloud — wrong place for a secret).
- **Manifest:** v3.
- **No Web Store listing** for v1. Side-load only.
- **README explicitly states** where the key lives so users with shared machines know.

## NPM publishing

- **Strategy:** public when functional, before polish (i.e. as soon as the engine actually decomposes correctly + has tests). **Phase 3 (context-compiler ship) is the publish gate.**
- **Pre-phase-3:** repo is GitHub-only. No `LICENSE` needed.
- **At phase 3:** license must be decided (see Open questions); both `core` and `context-compiler` publish together.
- **Package names:** `@tier-reader/core` and `context-compiler` are tentative; verify scope availability at phase 3 kickoff.

## What's explicitly out

- No Docker for v1 (no infra to containerize).
- No CI hosted runner beyond what GitHub Actions free tier covers.
- No database / persistent backend. Engine is a pure library.
- No telemetry beyond Langfuse traces (which are env-var gated).

## Open questions

- [phase 3] **NPM scope and final package names** — `@tier-reader/core` tentative; verify scope availability and pick before publish.
- [phase 3] **License (MIT vs Apache 2.0)** — must be decided before phase 3 publish gate. Default leaning: MIT.
- [phase 3] **Langfuse free-tier limits + retention** — confirm volume + retention adequate when wiring traces; not a foundation question.
