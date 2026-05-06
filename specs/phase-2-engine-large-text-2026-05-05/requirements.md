---
name: Phase 2 — Engine large-text strategy
description: Tiered decomposition (small/medium/large) so the engine handles inputs that don't fit one context window
type: project
---

# Requirements

## Why

The current `decompose()` is one-shot: it works for inputs that fit a single context window with output budget, and fails (truncates or errors) for anything larger. Real consumer inputs — full Wikipedia articles, multi-section technical docs — exceed that. Phase 2 makes the engine pick a strategy automatically based on input size, so consumers can hand it any size without preflight checks.

## In scope

- `detectTier(input, model?)` — returns `"small" | "medium" | "large"` from char-based thresholds, with thresholds overridable via opts. Conservative defaults.
- Tier dispatch in `decompose()` — routes to the correct strategy based on `detectTier` result (or explicit `tier` opt override).
- **Medium strategy:** pass 1 = top-level outline (titles only); pass 2 = per-section decompose **in parallel** (small bounded N).
- **Large strategy:** structural chunker (split on markdown headings; fall back to paragraph groups when no headings); **sequential** per-chunk decompose; **LLM synthesis merge** of chunk roots into a single top-level outline. Synthesis merge is the default; togglable via opt.
- Playground UI surface: tier badge showing which path ran + "synthesis merge: on/off" checkbox for the large path so we can A/B it on real inputs.
- Test fixtures: medium (~10–20KB multi-section text) + large (~50KB Wikipedia article snapshot, checked into `test/fixtures/`).
- Tests covering all three tiers: detectTier dispatch, medium parallel sections, large sequential chunks + merge.
- Short doc note in `docs/architecture.md` describing seam behavior at chunk boundaries (what we accept for v1).

## Out of scope

- Sophisticated tier detection (token-accurate, model-aware budget math). Char-based is intentionally crude; revisited in Phase 2.5.
- Alternative agent tactics (retrieval-then-decompose, iterative refinement, semantic chunking research). All deferred to Phase 2.5.
- Cross-section rebalancing of large-tier merges (deferred per roadmap § Deferred).
- Streaming generation. Still deferred.
- Fixing seams cosmetically — `tech-stack.md` accepts seams for v1.
- Concurrency tuning beyond a simple cap; no rate-limit-aware scheduling.
- Multi-language fixtures.

## Success signal

`pnpm test` passes against fixtures at all three tiers. The 50KB Wikipedia article decomposes end-to-end without truncation, producing one cohesive top-level outline (not N disjoint chunk roots). In the playground, pasting the same large article and toggling "synthesis merge" produces a visibly more cohesive top level when on vs off.

## Open-questions resolved this phase

None. No `[phase 2]`-tagged questions in mission.md, tech-stack.md, or architecture.md.

## Open questions

- Char-thresholds for small/medium/large boundaries — picked pragmatically in implementation; Phase 2.5 may revisit with token-accurate logic.
- Whether the medium-tier outline pass should reuse the same prompt as one-shot decompose with a "titles only" instruction, or get its own prompt template — decided during implementation.
