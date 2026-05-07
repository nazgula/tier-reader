---
name: Phase 2.5 validation — prompt-version research
description: How to verify phase 2.5 is done. Mostly automated since the playground UI evaluation is deferred to 2.6.
type: project
---

# Phase 2.5 — Validation

## Manual checks

1. **Default unchanged.** Run `pnpm --filter @tier-reader/playground dev`, decompose one of the existing fixtures with the playground's current settings (no `promptVersion` opt). The resulting tree should be visually indistinguishable from a pre-2.5 run on the same fixture (mode/depth caps and all the existing UX bugs still present — that is expected).
2. **Variant invocable from a script.** Run a one-off Node script (or new test) that calls `decompose(input, { promptVersion: 'bubble-up' })` and `decompose(input, { promptVersion: 'paragraph-leaf' })` against `medium-multi-section.txt` section 2. Inspect the resulting JSON in `spotchecks/`:
   - `bubble-up`: section-N root title references content from multiple paragraphs of section N (not just P1).
   - `paragraph-leaf`: the section's children are paragraph-shaped leaves whose `detail` matches the source paragraph verbatim or near-verbatim. No single-child paraphrase chains.
3. **Unknown version errors clearly.** `decompose(input, { promptVersion: 'does-not-exist' })` throws with a message naming the registered variants.
4. **Langfuse tagging.** A traced run shows `promptVersion` on the call metadata in the Langfuse UI (or, if Langfuse is offline, the trace payload constructor includes it — verify via unit test).

## Automated checks

- **Existing suite green** under default `promptVersion`. No regressions.
- **New structural tests** (per `plan.md` groups 3–5) pass for each authored variant on the shared fixtures:
  - v-bubble-up: section title cross-paragraph reference test.
  - v-paragraph-leaf: verbatim preservation + no-single-child-paraphrase tests.
  - v-fanout-strict (if shipped): top-level fanout ≤ 7.
- **`tsc --noEmit`** clean across packages. **`biome`** clean.
- **`findings.md`** exists, has ≥4 prior-art entries, and at least one `spotchecks/<variant>.json` per authored variant.

## Regression watch

- **Default decomposition path**: extracting prompts into a registry is a refactor of hot code (small/medium/large all touch it). Re-run the full Phase 2 fixture set under the default variant and confirm no diffs vs pre-2.5 snapshots. Snapshots are the tripwire.
- **Tier dispatch**: `detectTier` and the medium/large dispatchers must still pick the same tier and emit the same shape under default. New `promptVersion` plumbing must not leak into tier selection.
- **Provider wrapper / Langfuse**: adding `promptVersion` to trace metadata must not break the `BYO call()` escape hatch (which has no Langfuse). Verify with the existing BYO test path.
- **Schema invariants** (structural ids `"0"`, `"0.0"`, leaf-only `detail`, etc.) hold across all variants — variants change *what the model writes*, not the post-processing that enforces schema.

## Reconciliation — what actually shipped (appended at finish-phase)

The original criteria above assumed the variant registry would ship as the deliverable. The mid-phase spotcheck revealed a real bug in the pre-2.5 default (verbatim reconstruction broken), so the registry was used to find the answer and then torn out. The criteria that still apply, plus new ones reflecting the consolidated outcome:

**Still applies:**
- Existing test suite green; `tsc --noEmit` clean; biome clean.
- `findings.md` exists with ≥4 prior-art entries.
- Default decomposition path produces a structurally valid tree across all phase 2 fixtures (no schema regression).

**Superseded / no longer applicable:**
- "Variant invocable from a script" — variants and `promptVersion` opt removed.
- "Unknown version errors clearly" — registry removed.
- Langfuse `promptVersion` metadata — plumbing removed.
- New structural tests per variant — variant code and tests removed.

**New criteria for the consolidated outcome:**
- The default prompt in `packages/core/src/prompt.ts` contains the three rules folded in this phase: PARAGRAPH-AS-LEAF, NO PARENT WITH ONE PARAPHRASING CHILD, and the "section title must reflect the whole section" instruction.
- The spotcheck script `examples/spotcheck-phase-2_5.ts` runs end-to-end against a live API key (sourced from `apps/playground/.env.local` for local dev) and reports:
  - Reconstruction Jaccard ≥ 0.95 on the "Producer side" fixture.
  - Zero single-child internal nodes on the "Producer side" fixture.
- `spotchecks/default.json` is committed and reflects a recent run.
- `DecomposeOpts` exposes no `promptVersion` field; `@tier-reader/core` exports no registry symbols.
- `architecture.md` lists "Verbatim reconstruction" as an invariant.
