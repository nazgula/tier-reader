---
name: Phase 2.5 findings
description: Prior-art notes, what the variant experiment found, and what graduated into the default prompt.
type: project
---

# Phase 2.5 — Findings

## Outcome in one paragraph

We surveyed prior art, built a registry with 3 prompt variants on top of a baseline `default`, and ran them against a real fixture. The headline finding was a **bug in the pre-2.5 default**: the model was putting each paragraph's opening sentence into the parent title and never emitting it as a leaf, so the verbatim-reconstruction invariant was silently broken. Two rules from `v-paragraph-leaf` (paragraph-as-leaf with verbatim detail, and "no parent with one paraphrasing child") plus one rule from `v-bubble-up` ("a section title must reflect the whole section, not just paragraph 1"), folded into the default prompt, fixed it. After the fix the registry served no purpose, so it was removed. One variant idea — bubble-up implemented as a real multi-call pipeline rather than a single prompt — was parked as a Phase-3 candidate in `roadmap.md` (Deferred). See "What we learned" at the bottom for the takeaways.

## Prior art

Two parallel `general-purpose` subagents produced these briefs (≤300 words each, abstracts/skim only). Quotes preserved as returned; light edits for layout.

### A. Long-document decomposition tactics

**BooookScore — hierarchical merging vs. incremental updating (ICLR 2024)**
- *What it does:* Compares two book-summarization prompt strategies: pairwise merge of chunk summaries vs. running summary updated chunk-by-chunk.
- *What we'd borrow:* Three distinct prompt templates per stage — (1) summarize-chunk, (2) merge-siblings, (3) merge-with-prior-context — instead of one prompt doing everything; carry a "context-so-far" slot to fight incoherence.
- *What doesn't fit our Tree schema:* Their output is a flat narrative summary, not a titled hierarchy with `detail`/`children`.
- https://openreview.net/pdf?id=7Ttk3RzDeu

**RAPTOR (ICLR 2024)**
- *What it does:* Builds a tree by recursively clustering chunks (embeddings + GMM) and summarizing each cluster bottom-up.
- *What we'd borrow:* The recursive "summarize a group of siblings into a parent node" prompt shape — prompt produces a parent `title`+`detail` from N children, applied per level.
- *What doesn't fit our Tree schema:* Embedding/clustering infra is out of scope; we need top-down decomposition driven by the LLM itself, not bottom-up clustering.
- https://arxiv.org/abs/2401.18059

**Context-Aware Hierarchical Merging (Arxiv 2025)**
- *What it does:* Augments hierarchical merge prompts with retrieved context from neighboring source spans to reduce drift and hallucination.
- *What we'd borrow:* When merging/refining a node, include a small "anchor quote" slot pointing back to the originating source span — keeps `detail` faithful without needing retrieval infra.
- *What doesn't fit our Tree schema:* The retrieval step requires an index; we'd substitute a deterministic span pointer carried through the prompt.
- https://arxiv.org/abs/2502.00977

**CoTHSSum (2025)**
- *What it does:* Pairs hierarchical segmentation with chain-of-thought prompts that name structure (sections, themes) before summarizing.
- *What we'd borrow:* A pre-decomposition CoT step — prompt first outputs a section outline (titles only), then a second prompt fills `detail`/`children` per node.
- *What doesn't fit our Tree schema:* Nothing major; their output flattens to prose, ours stops at the outline+fill stage.
- https://link.springer.com/article/10.1007/s44443-025-00041-2

**Net takeaway (A):** Split the work across stage-specific prompts (outline, leaf-summarize, sibling-merge, context-aware refine) rather than one mega-prompt; pass an explicit "parent context" or source-span anchor into every non-root call to preserve global coherence and faithfulness.

### B. Routing & disclosure

**Anthropic — "Effective Context Engineering for AI Agents"**
- *What it does:* Argues for progressive disclosure of context: surface compact descriptors, expand only on demand.
- *What we'd borrow:* Prompt the model to write parent titles as "compact descriptors" — enough to decide whether to expand — and require each child to justify its existence with new information.
- *What doesn't fit our Tree schema:* Frames disclosure as runtime tool/skill loading; we have no runtime routing, only static tree generation.
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

**Nielsen Norman — Progressive Disclosure (HCI)**
- *What it does:* UX principle: show primary/common info first, hide secondary detail behind explicit reveal.
- *What we'd borrow:* Title rule — a title must be self-sufficient as a decision point ("is expanding worth it?"), not a teaser that requires opening to be intelligible.
- *What doesn't fit:* Assumes a designer hand-picks the split; we must instruct the model to perform the primary/secondary cut itself.
- https://www.nngroup.com/articles/progressive-disclosure/

**NexusSum — hierarchical LLM summarization**
- *What it does:* Three-stage pipeline (preprocess → summarize → compress) for long narratives.
- *What we'd borrow:* The compress stage's idea of enforced length-tiering — instruct that each tree level has a strict token budget, forcing genuinely different granularity per depth.
- *What doesn't fit:* Multi-agent pipeline; we collapse to one prompt per stage.
- https://arxiv.org/html/2505.24575v1

**Sequence Salience (PAIR / LIT)**
- *What it does:* Visualizes which prompt spans actually drive output tokens; finds overloaded context dilutes salience.
- *What we'd borrow:* Prompt instruction — "child titles must add one fact absent from the parent title; redundant restatements are forbidden" — directly targeting the dilution failure mode.
- *What doesn't fit:* Tooling is interpretability/debugging, not generation-time.
- https://arxiv.org/abs/2404.07498

**Corpus2Skill / claude-mem progressive disclosure**
- *What it does:* INDEX→SKILL file hierarchy where each level is ~200 tokens of "just enough to decide to descend."
- *What we'd borrow:* Concrete heuristic for `title` length and `detail` budget per depth; require titles to be standalone decision aids.
- *What doesn't fit:* Filesystem navigation by an agent; ours is read by a human via UI expansion.
- https://docs.claude-mem.ai/progressive-disclosure

**Net takeaway (B):** Treat each node's title as a standalone "should I expand?" decision aid, and explicitly forbid children that merely rephrase the parent — every child must contribute at least one fact not deducible from its parent's title. Pair this with hard per-depth length budgets so granularity is visibly different at each level.

## Synthesis — implications for our prompt variants

Cross-cutting themes from A + B that translate cleanly into single-prompt changes:

1. **Outline-first, fill-later** (A: CoTHSSum; A: BooookScore). Already the shape of our medium-tier flow; reinforces that variants targeting *titles* should land in the outline-pass prompt specifically.
2. **Children must add information over parent** (B: NN/g, Anthropic, Sequence Salience). A direct, prompt-level instruction usable across all variants — and the structural test in plan §4 ("no single-child paraphrase pairs") is already aligned.
3. **Per-depth length tiering** (B: NexusSum, claude-mem). Worth adding as a default-prompt tightening, not a separate variant — token budget per level.
4. **Source-span anchor instead of retrieval** (A: Context-Aware Hierarchical Merging). Maps onto `v-paragraph-leaf`'s "verbatim preservation" goal — anchor `detail` to its source paragraph rather than paraphrasing.
5. **Bottom-up parent construction** (A: RAPTOR, conceptually). Direct motivation for `v-bubble-up`; we keep the prompt-level idea (compose parent title from children) and drop the clustering infra.

No findings flagged a gap requiring a follow-up agent.

## Variant rationale (historical — variants no longer exist)

Three variants were authored (plus the baseline `default`), each targeting a distinct failure mode observed during phase-2 review. They lived under `packages/core/src/prompts/`. After spotchecks revealed the right answer, the variant code, registry, and `promptVersion` plumbing were torn out. This section is kept for reference on what was tried.

### v-bubble-up (`prompts/bubble-up.ts`)

- **Targets:** "section title = first-paragraph paraphrase" — the model reads the section's opening sentence, rewords it, and emits that as the section title, ignoring the rest of the section's content.
- **Overrides:** `decomposeOneShot`, `mediumOutline`. (`mediumSection`, `largeChunk`, `largeSynthesis` fall through.)
- **What changes in the prompt:** Inverts construction order. The one-shot prompt walks the model through an explicit ordered procedure — produce per-paragraph bullets first, compose the paragraph-level title from those bullets, compose the section title from the paragraph titles. The medium-outline prompt is rewritten so section titles are SYNTHESIZED from per-paragraph working notes, with an explicit instruction that a title describing only paragraph 1 is wrong and must be rewritten.
- **Inspired by:** RAPTOR (recursive bottom-up cluster summary, conceptually); CoTHSSum (CoT structure-naming pre-pass); Sequence Salience (children must add information over parent).

### v-paragraph-leaf (`prompts/paragraph-leaf.ts`)

- **Targets:** over-division (a coherent paragraph emitted as parent + 1 paraphrased bullet), lost verbatim (leaf detail is a summary instead of source), single-bullet redundancy.
- **Overrides:** `decomposeOneShot`, `mediumSection`, `largeChunk`. (`mediumOutline`, `largeSynthesis` fall through; the structure of leaves is the only thing this variant touches.)
- **What changes in the prompt:** Two explicit, repeated rules: (a) PARAGRAPH-AS-LEAF — a paragraph carrying one main idea is a leaf whose `detail` is the verbatim paragraph; (b) SINGLE-CHILD-COLLAPSE — never emit a parent with exactly one child whose detail substantially is the parent's source. Default is "leaf"; subdivision must justify itself.
- **Inspired by:** BooookScore (stage-specific prompts, including a verbatim-preserving leaf step); Context-Aware Hierarchical Merging (anchor leaf to source span instead of paraphrasing); Sequence Salience (forbid redundant restatements).

### v-fanout-strict (`prompts/fanout-strict.ts`)

- **Targets:** runaway top-level fanout (10+ shallow sections produced when the model treats every paragraph as a top-level peer).
- **Overrides:** `decomposeOneShot`, `mediumSection`, `largeChunk`. (`mediumOutline` already caps via `fanoutHint`; `largeSynthesis` already caps to 3-7.)
- **What changes in the prompt:** Hard cap of 7 children at every level, with an explicit REBALANCE instruction — when honoring source structure would exceed the cap, group adjacent siblings under a synthesized intermediate parent rather than emit a 12th peer. Rebalance must produce a real synthesis title for the group, not a placeholder.
- **Inspired by:** NexusSum (per-level length tiering — granularity must be visibly different at each depth); claude-mem progressive disclosure (per-depth budgets).

## Spot-checks (live, against real LLM)

The spotcheck script `examples/spotcheck-phase-2_5.ts` decomposes section 2 of `medium-multi-section.txt` ("Producer side") and reports reconstruction quality. Run from the repo root:

```bash
ANTHROPIC_API_KEY=... pnpm --filter examples spotcheck:phase-2_5
```

### Pre-consolidation results (4 variants, recorded then deleted)

| variant | top-level | leaves | reconstruction | parent+1 child smell |
|---|---|---|---|---|
| pre-2.5 default | 4 | 5 | **broken** — paragraph opening sentences absent from leaves | 3 of 4 sections |
| `v-bubble-up` | 4 | 8 (sentence-leaves) | preserved | none |
| `v-paragraph-leaf` | 1 wrapper + 4 paragraph-leaves | 4 | preserved | none |
| `v-fanout-strict` | 4 | 6 | **broken** (same bug as default) | one section |

The two "default-style" prompts both lost the opening sentence of each source paragraph. The two paragraph- or sentence-respecting prompts both preserved it. That made the fix obvious.

### Post-consolidation (current default)

```
top-level sections : 4
leaves             : 4
reconstruction Jacc: 0.992
single-child nodes : none
```

Output committed at `spotchecks/default.json`. Each leaf's `detail` is the verbatim source paragraph; each title summarizes its paragraph and references content from multiple sentences (e.g., the "rotation" paragraph's title now mentions both the rotation rule AND the upload-in-order rule, not just rotation).

## What we learned

1. **Pre-2.5 default had a real verbatim-reconstruction bug.** It only surfaced once we ran a spotcheck that actually concatenated leaves and compared to source. Worth adding this check to any future prompt change.
2. **Bubble-up as a single prompt is weak.** Structured-output mode emits one JSON object; the "working bullets first" procedure can't be observed or enforced. The right form of that idea is one declarative output constraint ("section title must cover the whole section, not just paragraph 1"), which is what shipped in default.
3. **Bubble-up as a multi-call pipeline (per-paragraph → per-section synthesis → root) is a different and reasonable idea.** It mirrors the large-tier flow at finer granularity. Parked in `roadmap.md` Deferred as a Phase-3 candidate; pull it in only if the consolidated single-sweep default produces weak section titles on real inputs.
4. **The registry was overbuilt for what we actually needed.** Once we found the right rules, the variants were unhelpful clutter. Lesson: research scaffolding earns its keep by uncovering the answer, then comes out.
5. **Fanout-strict was a no-op on this fixture.** The model already respected the 3–7 cap; the rebalance instruction had nothing to do. Not worth its own variant. If runaway fanout reappears we can add the cap directly to default.
