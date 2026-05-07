---
name: Phase 2.5 plan — prompt-version research
description: Sub-stages for the research + prompt-variant authoring phase. Each group is independently shippable.
type: project
---

# Phase 2.5 — Plan

Status: 1 [x], 2 [x], 3 [x], 4 [x], 5 [x]

## 1. [x] Prior-art survey (quick, via subagents — token-budgeted)

- **Delegated to subagents** — main context does not perform web research itself. But subagents share the same plan quota (Max x5), so we minimize agent count and per-agent budget rather than fanning out maximally.
- **Two `general-purpose` agents, run in parallel** (single message, two tool calls), each covering a cluster:
  - **Agent A — "Long-document decomposition tactics"**: hierarchical summarization, semantic chunking, structured map-reduce variants, retrieval-then-decompose, iterative refinement.
  - **Agent B — "Routing & disclosure"**: DACS / dynamic-agent-context-selection literature, progressive-disclosure research (HCI + LLM angle).
- **Per-agent budget:** each agent returns a single markdown brief, ≤300 words total, covering 3–5 sources. Format per source: 1-line *what it does* / 1-line *what we'd borrow* / 1-line *what doesn't fit our `Tree` schema* / 1 source link. No deep reading, no full paper summaries — abstracts + skim only.
- **Constraints in the agent prompt** (must be stated explicitly):
  - "Do not spawn further subagents."
  - "At most 6 web fetches total. Prefer one well-chosen survey paper over many narrow papers."
  - "Skip anything that doesn't translate to a single-prompt change in our engine."
- Main context only consolidates the two briefs into `findings.md` § Prior art. Do not re-run the searches in the main thread.
- If after both briefs there's a clear gap on one topic, *one* targeted follow-up agent is acceptable — not a default.

## 2. [ ] Prompt registry in core

- New `packages/core/src/prompts/` directory.
- `prompts/index.ts` exports a registry: `{ [versionId]: PromptVariant }`. `PromptVariant` shape: builders for `decomposeOneShot`, `mediumOutline`, `mediumSection`, `largeChunk`, `largeSynthesis` — whichever a given variant overrides; un-overridden ones fall through to default.
- Move existing prompt code in `core/src/prompt.ts` (and any in `decompose-medium.ts` / `decompose-large.ts` / synthesis paths) into `prompts/default.ts` as the baseline variant. Keep `prompt.ts` re-exporting the default variant's builders so no internal call sites break in this step.
- Add `promptVersion?: string` to `DecomposeOpts`. Plumb through medium/large strategies. Unset → `'default'`. Unknown id → throw early.
- Langfuse trace metadata on every LLM call gains `promptVersion: <id>`.
- No behavior change for existing fixtures: snapshot tests + structural tests stay green with `promptVersion` unset.

## 3. [ ] Author variant: v-bubble-up

- Lives in `core/src/prompts/bubble-up.ts`.
- Strategy: bottom-up title construction. The prompt(s) instruct the model to (a) read each paragraph and produce its bullet points first, (b) compose the paragraph header from the bullets it just wrote, (c) compose the section header from paragraph headers. For small-tier inputs this is one prompt with explicit ordered steps; for medium, the outline-pass prompt is rewritten to derive section titles from already-emitted child titles rather than a top-down read.
- Structural test: on `medium-multi-section.txt`, the section-N root title must reference content from at least 2 distinct paragraphs of section N (heuristic: token overlap with > 1 paragraph above the noise floor). Targets the "section title = P1 paraphrase" failure.

## 4. [ ] Author variant: v-paragraph-leaf

- Lives in `core/src/prompts/paragraph-leaf.ts`.
- Strategy: a coherent paragraph stays as one leaf — `title` is a one-line summary, `detail` is the verbatim paragraph. The prompt explicitly instructs: "if a paragraph carries one main idea, do not subdivide; emit it as a leaf." Add an explicit single-child-collapse instruction: "never emit a node with exactly one child whose detail is substantially the parent's source — collapse to leaf."
- Structural tests:
  - **Verbatim preservation**: for inputs where source paragraphs map 1:1 to leaves, leaf `detail` ≈ source paragraph (token-set Jaccard ≥ 0.9 against the corresponding paragraph).
  - **No single-child paraphrase pairs**: for every internal node with exactly one child, the parent's title and child's detail must NOT be near-paraphrases (Jaccard < 0.7 on titles, or the pair never exists).
- Targets over-division, lost verbatim, single-bullet redundancy.

## 5. [ ] (Optional) Author variant: v-fanout-strict + writeup

- *Optional* — author only if budget remains after groups 1–4. Skip cleanly if not.
- Lives in `core/src/prompts/fanout-strict.ts`. Adds a hard fanout cap with a rebalance instruction.
- Structural test: top-level fanout ≤ 7 across all fixtures.
- **Writeup (always done, even if v-fanout-strict skipped)**: complete `findings.md`:
  - Prior-art notes (from group 1).
  - Variant rationale (one section per authored variant; what it targets, what it changes in the prompt).
  - Spot-checks: for each variant, dump JSON of decomposing `medium-multi-section.txt` section 2 to `specs/phase-2_5-.../spotchecks/<variant>.json`. Brief commentary in findings.
  - Recommendation: which variants to compare visually in phase 2.6, and why.

## Architecture impact

`docs/architecture.md` will need at finish-phase time:

- §3 Repo layout: add `packages/core/src/prompts/` with `default.ts`, `bubble-up.ts`, `paragraph-leaf.ts`, optionally `fanout-strict.ts`, and `index.ts` registry.
- New invariant: default `promptVersion` produces bit-for-bit identical output to pre-2.5 behavior. All non-default variants are opt-in only.
- Trace-metadata note: every LLM call carries `promptVersion`.
- §2 runtime workflow diagram: unchanged (the registry is a code-organization detail, not a workflow change).
