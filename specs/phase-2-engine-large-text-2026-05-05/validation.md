---
name: Phase 2 validation
description: Manual + automated checks for tiered decomposition phase
type: project
---

# Validation

## Manual checks

1. `pnpm --filter @tier-reader/playground dev` starts cleanly.
2. Paste an existing small fixture (e.g. `wikipedia-paragraph.txt`) → tier badge reads `small`; tree renders as before.
3. Paste the medium fixture (~10–20KB multi-section text) → tier badge reads `medium`; tree shows top-level sections with each section having children. No truncation.
4. Paste the 50KB Wikipedia article fixture → tier badge reads `large`; "synthesis merge" checkbox visible and on by default. Decompose completes; top-level outline is cohesive (3–7 nodes that span the whole article, not chunk-shaped).
5. With the same large input, uncheck "synthesis merge" and re-run → top-level reflects chunk boundaries instead of a unified outline; this confirms the merge is doing something.
6. Discovery / Overview / Full mode toggles still work across all three tiers.
7. Cancel a long-running large decompose mid-flight (abort): no orphaned state in the UI; subsequent runs work.

## Automated checks

- `pnpm test --filter @tier-reader/core` — all existing tests still green.
- New `tier.test.ts`:
  - Each existing small fixture classifies as `small`.
  - The medium fixture classifies as `medium`.
  - The 50KB fixture classifies as `large`.
  - Threshold-override opt forces a specific tier.
- New medium-tier test:
  - Medium fixture → returns a valid `Tree` per schema.
  - Top-level node count within `fanoutHint` bounds.
  - Each top-level node has children (no premature leaves at depth 1).
- New large-tier test:
  - 50KB fixture with `synthesisMerge: true` → single top-level outline (one synthetic root or 3–7 merged top nodes).
  - Same fixture with `synthesisMerge: false` → top level equals chunk-root count.
  - Both produce schema-valid `Tree`s; structural ids are consistent (`"0"`, `"0.0"`, `"0.0.0"`, …).
- `pnpm typecheck` (or `tsc --noEmit`) clean across the workspace.
- `pnpm lint` (Biome) clean.

## Regression watch

- Small-path output for the five existing fixtures must not drift. Run the existing snapshot suite; investigate any diff before accepting it.
- `decompose()` public signature unchanged for small inputs (additive opts only: `tier`, `tierThresholds`, `synthesisMerge`).
- Playground small-path UX unchanged (tier badge is additive; checkbox hidden unless tier is `large`).
- Langfuse trace wiring still fires for every LLM call (medium = 1 + N traces; large = N + 1 traces with merge, N without).
- `core` package remains free of browser-only deps and the `./render` browser-safe export still has no Node built-ins on its dependency path (chunker / tier code lives behind the default Node-only entry, not on `./render`).
