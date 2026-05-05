---
name: Phase 2 plan
description: Step-by-step implementation plan for tiered decomposition (small/medium/large)
type: project
---

# Plan

Status: 1 [ ], 2 [ ], 3 [ ], 4 [ ], 5 [ ], 6 [ ]

## 1. [ ] `detectTier` + tier dispatch

- Add `packages/core/src/tier.ts` exporting `detectTier(input, opts?) → "small" | "medium" | "large"`.
- Char-based thresholds with conservative defaults (`small < ~20k`, `medium < ~80k`, `large >= ~80k`); pin exact numbers in code with a one-line comment on rationale.
- Allow `tierThresholds` override in `DecomposeOpts`; allow explicit `tier` override too.
- Refactor `decompose.ts`: existing one-shot becomes the small path (`decomposeSmall`); top-level `decompose()` dispatches by tier.
- Export `detectTier` from `packages/core/src/index.ts`.
- Smoke test: each existing fixture is classified `small`.

## 2. [ ] Medium tier (outline + parallel sections)

- Add `decomposeMedium(input, opts)` in `decompose.ts` (or a new `decompose-medium.ts`).
- Pass 1: prompt the model for a top-level outline only (titles + brief, no leaf detail). Reuse `RawTreeSchema` constrained to `maxDepth: 1`, or add a `MediumOutlineSchema` if cleaner.
- Pass 2: for each top-level section, slice the source into the section's `sourceSpan` (or, if model didn't return spans confidently, by best-effort heuristic) and call the small-tier decompose on it in **parallel** with `Promise.all` (cap concurrency at 4 via a small in-file limiter — no new dep).
- Stitch results: medium tree's roots are pass-1 outline nodes; each gains the per-section decompose result as its children.
- Re-id the merged tree so structural ids stay valid (`"0.0"`, `"0.1"`, etc).
- Add fixture `medium-multi-section.txt` (~10–20KB).
- Test: medium fixture round-trips through `decomposeMedium` and produces a valid `Tree` per schema.

## 3. [ ] Large tier (chunk + sequential + synthesis merge)

- Add `chunkByStructure(input)` in a new `packages/core/src/chunk.ts`. Strategy: split on markdown ATX headings (`^#{1,6} `); fall back to grouped paragraphs (`\n\n`-separated, packed up to ~15k chars per chunk) when no headings are present. Returns `{ text, sourceStart, sourceEnd }[]`.
- Add `decomposeLarge(input, opts)` in `decompose.ts` (or `decompose-large.ts`):
  - Chunk the input.
  - For each chunk **sequentially** (not parallel — matches "sync send/receive" decision; deterministic; easier to reason about and rate-limit-friendly), call the small-tier path.
  - Collect chunk root nodes (each chunk's resulting `Tree` becomes one subtree).
  - **Synthesis merge** (default on, opt-out via `opts.synthesisMerge: false`): one extra LLM call given the chunk-root titles → returns a single unified top-level outline (3–7 nodes typical) that re-groups the chunk roots. The output schema is a small tree of just titles + child references back into chunk-root indices. Stitch the merged outline as the new top, with the chunk subtrees re-parented underneath.
  - When merge is off: chunk roots become siblings under a synthetic root in chunk order (mechanical concatenation).
- Re-id the final tree once at the end so all structural ids are consistent.
- Add fixture `wikipedia-50k.txt` (~50KB Wikipedia article — pick one well-structured topic; capture rendered article text).
- Tests: large fixture decomposes to a single cohesive `Tree`; with `synthesisMerge: false` produces N chunk roots; with `synthesisMerge: true` produces a single merged top-level outline.

## 4. [ ] Fixtures + cross-tier tests

- Verify all five existing small fixtures still classify and decompose as before (regression).
- Add `tier.test.ts` covering threshold edges and overrides.
- Add cross-tier integration test: same `decompose()` call across small/medium/large fixtures returns valid `Tree`s; only the strategy differs.
- Update snapshots if any small-path output drifts (it shouldn't).

## 5. [ ] Playground tier surface

- `apps/playground/server/decompose-route.ts`: pass through optional `tier` and `synthesisMerge` from request body; include the resolved tier (from `detectTier`) in the response so the UI can label it.
- `apps/playground/src/App.tsx`: add a small tier badge ("small" / "medium" / "large") next to the existing controls; add a "synthesis merge" checkbox that's only visible/active when tier is `large`.
- Manual: paste a small fixture → small path; paste the 50KB Wikipedia fixture → large path with merge on by default; toggle off and re-run, observe difference in top-level cohesion.

## 6. [ ] Document seam behavior

- Update `docs/architecture.md` §2 if anything in the runtime workflow has actually changed in shape (the tiered diagram is already there — most likely no change needed).
- Add a short subsection under Invariants (or a new "Seam behavior" subsection) describing what's accepted for large-tier seams in v1: occasional duplication across chunk boundaries, ordering follows source structure, synthesis merge improves but does not eliminate seams.
- Note Phase 2.5 as the place where alternatives will be evaluated.

## Architecture impact

`docs/architecture.md` will gain at finish-phase time:

- §2 runtime workflow already shows the tiered flow conceptually — verify it still matches code; tweak only if shape changed.
- §3 repo layout: add `packages/core/src/tier.ts` and `packages/core/src/chunk.ts` (and any `decompose-medium.ts` / `decompose-large.ts` if split out).
- New invariant: "All non-small tiers ultimately produce a single `Tree` with valid structural ids — consumers see no difference between tiers at the schema level."
- Short "Seam behavior (large tier)" note under Invariants.
- Playground note in §3: tier badge + synthesis-merge toggle exposed via `/api/decompose`.
