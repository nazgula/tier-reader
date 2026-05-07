---
name: Phase 2.5 requirements — prompt-version research
description: Research + prompt-variant authoring phase. Survey prior art, add a prompt registry to core, author 2–3 instruction variants targeting observed quality failures. No playground UI change. Visual evaluation deferred to 2.6.
type: project
---

# Phase 2.5 — Prompt-version research

## Why

Phase 2 validation surfaced concrete decomposition quality failures that the current single-prompt strategy can't fix in isolation. We need to (a) understand what prior art does, and (b) draft and ship multiple named prompt variants ("skills") behind a registry so the next phase can compare them in the playground and pick a winner. The phase is intentionally narrow: research + authoring only. Visual evaluation tooling lives in phase 2.6.

## In scope

- **Prior-art survey** — quick skim (4–6 sources): hierarchical summarization, semantic chunking, DACS, progressive-disclosure research, recent agentic long-document tactics. Notes captured in `findings.md`.
- **Prompt registry in `core`** — new `packages/core/src/prompts/` module. Each variant is a named exported builder. `decompose` (and the medium/large strategies) accept a `promptVersion` opt; unspecified = current default behavior bit-for-bit.
- **Langfuse tagging** — every traced LLM call carries the active `promptVersion` id.
- **Author 2–3 instruction variants:**
  - **v-bubble-up** — bottom-up title construction. Extract paragraph bullets first; synthesize paragraph header from its bullets; synthesize section header from paragraph headers. Targets the "section title = paragraph-1 paraphrase" failure observed on `medium-multi-section.txt` section 2.
  - **v-paragraph-leaf** — a coherent paragraph stays as a single leaf (title = one-line summary, `detail` = verbatim paragraph) unless it carries multiple distinct claims. Single-child collapse rule: if a node would have exactly one child whose detail is essentially its source, don't split. Targets over-division, lost verbatim, and single-bullet redundancy.
  - **v-fanout-strict** *(optional third, if budget allows)* — hard rule: more than 7 top-level items triggers a rebalance pass into a two-level outline before emitting. Targets the 12-item fanout violation.
- **Structural tests per variant** — assert the variant-specific invariant (e.g. `v-paragraph-leaf`: no leaf whose `detail` is materially shorter than its parent's source span; `v-fanout-strict`: top-level fanout ≤ 7). These are how we evaluate variants without playground UI.
- **`findings.md`** — survey notes, variant rationale, qualitative spot-checks against `medium-multi-section.txt` section 2 read directly from JSON, recommendation for which variant(s) to carry into 2.6 visual eval.

## Out of scope

- Playground drill-down fix, mode switcher made dynamic, removing Slice mode. *(All deferred to phase 2.6.)*
- Side-by-side variant compare UI in playground. *(Phase 2.6.)*
- Decision on which variant graduates to default. *(Made in 2.6 once visual eval is possible.)*
- Engine behavior change beyond registry plumbing. Default `promptVersion` keeps current behavior unchanged.
- Streaming. *(Ordering of streaming vs 2.6 is `/replan` territory.)*
- Cross-section synthesis-merge rebalance for the large tier. *(Roadmap § Deferred.)*

## Success signal

`pnpm test` green, including new structural tests for each authored variant. `findings.md` exists, references ≥4 prior-art sources, and contains JSON spot-checks of each variant against the section-2 fixture demonstrating the targeted failure is reduced or absent. The current default decomposition is unchanged for all existing fixtures.

## Open-questions resolved this phase

- **[phase 2.5 / playground] view-mode design — graduate vs playground-only, plus strict/bubble-up Slice behavior.** Resolved: keep playground-only; remove Slice entirely (same data shape as Frontier — the originally imagined differentiation didn't materialize). Mode-graduation question becomes moot. Slice-leaf strict-vs-bubble-up question becomes moot. All three sub-decisions land in phase 2.6 (which performs the actual playground edit).

## Open questions

- None blocking. The streaming-vs-2.6 ordering question stays where it is (a `/replan` call).
