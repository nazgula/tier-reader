# Phase 1.5 — Visual playground + prompt-quality iteration

## Why

Phase 1's live runs surfaced recurring decompose-prompt failure modes — most visibly, source-structure ignorance (paragraphs split across siblings, sections flattened) — plus redundant nesting, parent/child paraphrase, and over-division of cohesive "X but Y" statements. We need a visual playground so iteration has fast feedback, and a concrete prompt-side fix for the structure-ignorance issue before phase 2 inherits the same prompt for its medium/large chunk strategy. Deeper prompt-quality iteration is reframed as perpetual work, not phase-blocking.

## In scope

- New workspace app `apps/playground/` — local Vite + React + TS; depends on `@tier-reader/core`.
- Vite dev-server middleware exposing `POST /api/decompose` and `GET /api/fixtures[/:name]`. Handler runs server-side (Node), reads `ANTHROPIC_API_KEY` from `process.env`, calls `core`'s AI SDK provider, returns the `Tree`.
- UI surface:
  - Input textarea + fixture picker over the 5 existing fixtures from `packages/core/test/fixtures/`.
  - Three view-mode buttons (Discovery / Overview / Full) setting per-depth defaults; click any title to toggle that node; mode change wipes overrides — mirrors the original `tier-reader.jsx` reading UX.
  - Checkbox: "respect source structure (paragraphs, sections)" — toggles the new opt.
  - Raw `Tree` JSON pane (collapsed by default).
- New `DecomposeOpts.respectStructure` (default `false`) on `@tier-reader/core`. When `true`, the decompose prompt instructs the model to honor source structural units — paragraphs are kept whole, heading-marked sections group paragraphs, lists are units. The "3-6 top-level sections" floor yields to structure when they conflict.

## Out of scope

- Hosting / deploy; the playground is dev-only (`pnpm --filter playground dev`).
- BYOK in the browser — key stays in `process.env` on the dev server side.
- Refreshing `MockProvider` canned outputs / re-baselining snapshots. The new opt defaults to `false`, so existing Phase 1 fixture snapshots still match. Snapshots that capture `respectStructure: true` are not added in this phase.
- Automated assertions for prompt-quality patterns; deferred as perpetual work.
- Resolving the other two parking-lot issues (parent/child paraphrase, over-division of "X but Y"). Treated as perpetual prompt work; future commits to `core/src/prompt.ts` don't need a phase.
- Schema version bump (still `1`).
- Migrating `tier-reader.jsx` into the playground — phase 5's call.
- `detectTier`, medium/large strategies, `route`/`compile`, React renderer package, extension.

## Success signal

`pnpm --filter playground dev` opens the UI; toggling the "respect source structure" checkbox and decomposing the 3-paragraph Wikipedia fixture produces a tree where each source paragraph maps to exactly one top-level subtree (no paragraph split across siblings). With the checkbox off, behavior is unchanged from Phase 1 — existing tests and snapshots stay green without modification.

## Open questions resolved this phase

None — Step 1a found no `[phase 1.5]` items on mission/tech-stack/architecture.

## Open questions

- None blocking. Deeper prompt iteration on parent/child paraphrase, over-division of cohesive "X but Y", and any structural-respect edge cases continues as perpetual work in `core/src/prompt.ts` after this phase closes.
