# Roadmap

Six numbered phases. ~1 week each, single demoable outcome each. Streaming and other bigger-than-needed work lives in **Deferred / Under Evaluation**.

Checkbox vocab: `[ ]` pending · `[~]` in progress · `[x]` done.

---

## Phase 1 — Engine core (small-tier decomposition)

- [x] Repo scaffold: pnpm + Turborepo workspace, Vitest, Biome, Node 22 target.
- [x] `@tier-reader/core` package with schema types per `docs/schema.md`.
- [x] One-shot `decompose()` for small-tier inputs (fits one context window).
- [x] Vercel AI SDK adapter + BYO escape hatch behind a thin internal provider interface.
- [x] Langfuse trace wiring around all LLM calls.
- [x] Decompose prompt iteration: 5+ test inputs of varied shape (Wikipedia paragraph, AI chat answer, technical doc snippet); assertions on tree validity + spot-check title quality.
- [x] `renderAt()` helper for tier-reader-style depth-controlled rendering.

**Demoable:** `pnpm test` passes; `examples/decompose-cli.ts` takes stdin and prints a tree.

---

## Phase 1.5 — Visual playground + structure-respect opt

- [x] `apps/playground/` — local Vite + React app wrapping `decompose()` with three-mode (Discovery / Overview / Full) tree view, click-to-toggle drill-down, raw JSON pane.
- [x] Dev-only API key handling: `ANTHROPIC_API_KEY` lives in `.env.local` on the Node side; never reaches the browser.
- [x] `DecomposeOpts.respectStructure` opt + UI checkbox: when on, the prompt instructs the model to honor source paragraphs / sections / lists as units. Default off; existing snapshots unchanged.
- Deeper prompt iteration (parent/child paraphrase, over-division of "X but Y", structure-respect edge cases) reframed as perpetual work in `core/src/prompt.ts`, not phase-bound. Engine is decoupled from consumers via the locked `Tree` schema.

**Demoable:** `pnpm --filter @tier-reader/playground dev` opens the playground; ticking "respect source structure" and decomposing the 3-paragraph Wikipedia fixture produces one top-level subtree per source paragraph (no cross-paragraph splits).

---

## Phase 2 — Engine large-text strategy

- [x] `detectTier(input)` — picks small / medium / large from input size and model context window.
- [x] **Medium:** outline-then-sections, parallel section decompose.
- [x] **Large:** structural chunking + per-chunk decompose + synthesis merge.
- [x] Tests with progressively larger fixtures (paragraph → article → multi-section spec).
- [x] Document seam behavior at chunk boundaries for the large case.

**Demoable:** engine handles a 50KB Wikipedia article without truncation; `pnpm test` passes against fixtures of all three tiers.

---

## Phase 2.5 — Agent tactics deep dive (research + experimentation)

- [x] Survey prior art: hierarchical summarization, semantic chunking, DACS, progressive disclosure research, related agentic strategies for long-document understanding.
- [x] Prototype alternative tactics for medium/large decomposition (bubble-up, paragraph-as-leaf, fanout-strict).
- [x] Compare tactics on shared fixtures; capture qualitative notes; identify a real bug (verbatim reconstruction broken in pre-2.5 default).
- [x] Decide what graduates: paragraph-as-leaf rule + single-child-collapse rule + section-title-must-cover-whole-section rule folded into the default prompt. Variants and registry torn out — unneeded once the bug was understood.

**Concrete quality issues observed during Phase 2 validation (2026-05-05) that this phase should address:**
- Top-level fanout violations: a single root with 12 sub-items where the prompt asks for 3–7. Suggests the soft fanout hint isn't load-bearing under real model behavior; consider fanout enforcement passes or rebalance.
- Excess nesting on small content: depth-2/3 subtrees on inputs that read more naturally as flat lists. Aligns with the phase 1.5 "depth is a budget, not a target" prompt note — but the prompt alone isn't sufficient.
- Parent/child paraphrase still appears occasionally despite the explicit "NO REPETITION" prompt section. Worth a dedicated post-pass (collapse-or-promote) experiment.
- Synthesis-merge titles for the large path: real-content titles work well *now* (post-flatten fix), but cross-section coherence at lower levels still reads as chunk-shaped. Cross-section rebalance experiment lives here per roadmap § Deferred.

**Demoable:** short writeup in `specs/phase-2_5-.../findings.md` with side-by-side tree comparisons; engine updated (or explicitly unchanged with rationale).

---

## Phase 3 — Context-compiler library + benchmark + NPM publish

- [x] `context-compiler` package: `route(tree, agent)` and `compile(nodes, budget, format)` over the engine.
- [x] Agent spec format: `{ id, domain, tagFilters?, entityFilters? }`.
- [x] **`route()` mechanism = hybrid (locked):** hard filters (tag/entity intersection from agent spec) as a deterministic pre-filter, then embedding-similarity ranking (cosine between agent description and subtree title) over the survivors. Threshold tunable; below it a subtree goes to no agent. Filter-only and embedding-only as ablations in the benchmark. *Shipped, with 3.1 lowercased-substring + `fallbackOnEmpty` relaxation. Functional limits documented in `packages/context-compiler/benchmarks/findings.md` — see Stopped below.*
- [x] **Cost story (honest):** total LLM calls per turn ≈ 1 + N (same as DACS — DACS pays an orchestrator chat-completion, tier-reader pays for `decompose()`). The win is two-fold: (a) **no chat-model orchestrator call** — routing uses embeddings (~100× cheaper than chat completions) and deterministic filters; (b) **decompose is amortized** — same call powers the human-reader product, and is reusable across agent configurations (DACS must re-orchestrate every time the agent roster changes). Per-agent token counts are smaller because each agent reads its slice, not the whole message.
- [x] Tier selection at compile time: walk subtree to budget-fitting depth.
- [x] `bullets` and `prose` output formats (prose = linearize titles into paragraphs).
- [x] Benchmark harness: 20 multi-domain user messages, agent counts N=3, 5, 10. **Two baselines, not one:** (a) flat-broadcast (full message to every agent) and (b) DACS-style focus mode (full message to one focused agent + 200-token summaries to the rest, re-implemented as a small harness wrapper from arXiv:2604.07911). Beating only flat-broadcast is not a defensible claim in 2026 — DACS is the prior art reviewers will cite. *Shipped at 13 entries (partial; replanned 2026-05-11), with cost guards, embedding cache, resume support, multi-turn arc, and propagation judge. Real full run never executed — see Stopped.*
- [x] Measurements: tokens per agent (avg), total tokens across agents, steering accuracy via LLM-as-judge. *Harness supports all three measurements + propagation; no real numbers produced (no full bench run). Smoke-only observations are in `findings.md`.*
- [ ] Playground: agent-routing pane. Define N agents (id + description + optional tag/entity filters), decompose a multi-topic message, show each agent's slice side-by-side with per-agent token counts. This is the live demo artifact for LinkedIn post #1; the benchmark harness produces the numbers, the playground produces the picture. *Not built. Archived with routing — see Stopped.*
- [ ] Resolve license + NPM scope; publish `@tier-reader/core` + `context-compiler` to NPM. *Moved to "Deferred / Under Evaluation" — see "NPM publish prep" below.*

**Stopped 2026-05-17.** The routing experiment proved structurally weaker than expected. Three concrete blockers surfaced during phase work: (a) multi-agent fan-out is structurally rare in public chat dumps — 3.2 already conceded this and shipped a 13-entry curated partial dataset rather than the originally-targeted ≥20, with the public-dump path dropped on methodological grounds; (b) open-set tag emission cannot reliably align with arbitrary downstream agent filters — the 3.4 smoke triage found `decompose()` against a real model emits `tags=[]` / `entities=[]` on every node (the canned-provider unit tests verified passthrough only and missed this), and even a hardened emission prompt would still leave model-emitted free-form labels coincidentally agreeing (or not) with whatever filter set a downstream user writes; (c) the multi-turn propagation smoke trended *worse* than `flat-broadcast` on turn-2 fact carry-forward (2/3/0 vs 5/5/5 — N=1, not generalizable, but wrong direction on the central thesis). Decision (2026-05-17): ship the durable tier structure as v1 and treat sub-turn routing as a research direction (see "Deferred / Under Evaluation" → *Multi-agent context routing*). Routing code stays in the repo under `packages/context-compiler/` — `route()`, `agents.ts`, `dataset.ts`, the benchmark harness, the 13-entry dataset, the multi-turn arc — but is **not** part of the v1 NPM contract. The salvageable engine validation (long-AI-chat decomposition + reflection-agent pass, originally planned for this phase) moves to **Phase 3.1**. The full diagnostic record lives in `specs/phase-3-context-compiler-2026-05-08/` and in `packages/context-compiler/benchmarks/findings.md`.

**Demoable (as actually shipped):** `pnpm test` green across `@tier-reader/core` (38 tests) and `packages/context-compiler` (49 tests). `pnpm --filter @tier-reader/context-compiler bench:smoke -- --trace` exits 0 with cost-guarded smoke numbers + per-cell trace output; full `pnpm bench` and NPM publish are not part of v1.

---

## Phase 3.1 — Long-chat decomposition + reflection-agent eval

Inserted 2026-05-17 to salvage the engine-side validation work that was originally Phase 3 plan.md group 5 (the only group whose value survives the routing pivot). NPM publish prep moves to "Deferred / Under Evaluation" rather than landing here — there is no real external consumer asking for the published surface yet (the extension in Phase 5 can consume `@tier-reader/core` via workspace path), and publish-prep deserves a real trigger rather than a phase slot.

- [ ] Pick a real long AI-conversation transcript that decomposes a multi-section work process. Save under `packages/core/test/fixtures/long-chat-transcript.md` (or `.local.md` per the `examples/` gitignore rule, reference path-only).
- [ ] Run engine `decompose()` on it; save resulting tree to `specs/phase-3_1-long-chat-eval-<YYYY-MM-DD>/long-chat-tree.json`.
- [ ] Eyeball pass in the playground: walk top-level subtrees, jot observations.
- [ ] Reflection-agent pass: Sonnet 4.6 prompted with `(source transcript, resulting tree)` answers four questions — faithfulness (does the tree represent the source without dropping or fabricating content?), section coherence (do top-level subtrees correspond to coherent sections of the source?), failure modes (where does the decomposition visibly fail or read as awkward?), comparison to flat reading (would a reader prefer this over scrolling the raw transcript?).
- [ ] Combined writeup in `specs/phase-3_1-long-chat-eval-<YYYY-MM-DD>/findings-long-chat.md` — eyeball notes + reflection-agent's structured response.

**Demoable:** `findings-long-chat.md` exists with both human and reflection-agent assessments of a real long-chat decomposition.

---

## Phase 4 — LinkedIn post #1: progressive disclosure for long-context reading

Retheme committed 2026-05-17. Was framed around sub-message routing — that contribution was archived in Phase 3 per the Stopped trailer above. The substantive post-#1 contribution is now the engine itself: a library that takes long text and structures it for progressive disclosure with a verbatim-reconstruction invariant and a tier-adaptive multi-call strategy.

- [ ] Write blog post: *"Progressive disclosure for long-context AI reading — the tier-reader engine."*
- [ ] Sections: problem (long-context reading is flat scrolling; LLM output is wall-of-text); prior art (hierarchical summarization, expandable-outline UIs, tier-reader-style depth control); method (paragraph-as-leaf rule + single-child-collapse rule + verbatim-reconstruction invariant + tier-adaptive small/medium/large strategies + structure-respect option); the verbatim-reconstruction bug story from Phase 2.5 (*why* summary trees without verbatim are dangerous); limitations and what's deferred; code link.
- [ ] NPM publish (live) of the v1 surface: `@tier-reader/core` only, unless the Phase-3.1 surface decision opens up a slimmed `context-compiler`. Trigger this from inside the phase so the install line in the post works on day one. (Publish-prep gating mechanics live in the *NPM publish prep* Deferred entry below; pull them in here.)
- [ ] Cross-post: GitHub repo README, Medium / dev.to, LinkedIn.
- [ ] Verify install instructions work from a fresh `pnpm create` outside the monorepo.

**Demoable:** post is live on LinkedIn; `@tier-reader/core` (and any other published packages) installable from NPM; install instructions verified on a fresh project.

---

## Phase 5 — React renderer + Chrome extension MVP

- [ ] `@tier-reader/react` package: migrate logic from `tier-reader.jsx` onto `core` + `renderAt`.
- [ ] Three view modes (Discovery / Overview / Full) implemented as depth-control over `renderAt`.
- [ ] Chrome extension scaffold (manifest v3, content script, options page).
- [ ] BYOK in `chrome.storage.local` with options-page UI + test-key button.
- [ ] In-page activation on Wikipedia (URL allowlist for v1).
- [ ] Renders the React component over selected article body.

**Demoable:** load the unpacked extension, visit a Wikipedia article, see a tier-reader view of it.

---

## Phase 6 — LinkedIn post #2 + project closeout

- [ ] Write blog post: extension engineering — in-page integration, BYOK pattern, the engine reuse story.
- [ ] Demo recording / screenshots.
- [ ] Cross-post.
- [ ] Update top-level README with full deliverable map and links to both posts.
- [ ] Mark mission success criteria met.

**Demoable:** second post is live; repo README reflects shipped state.

---

## Deferred / Under Evaluation

- **Streaming generation (scaffold-then-fill).** Pull in when extension UX feels slow on large inputs. Architecturally compatible with current schema. **Trigger hit 2026-05-05:** Phase 2 validation showed the playground freezes for the entire 50KB / multi-call decompose run; user flagged this as a real UX problem. Wire format already specified in `docs/schema.md`; `decomposeStream` already drafted in `docs/api.md`. Candidate to slot as Phase 2.6 (before or after 2.5 — see open question below).
- **Standalone AI-chat-display package.** Pull in if a real consumer use case appears outside the extension.
- **Server-side API key proxy for the extension.** Pull in only if the extension graduates from personal-use-only.
- **Web Store listing for the extension.** Pull in if the extension proves valuable enough to share.
- **Cross-section rebalance pass for large-text strategy.** Pull in if chunk-boundary seams prove visibly bad.
- **Automated output-quality tests / real-model prompt gate.** Wire the spotcheck checks (verbatim-reconstruction Jaccard, no-single-child-paraphrase) into a live-LLM test job that runs on demand or in CI rather than as a manual script. Broader scope worth pulling in alongside: a real-model gate that asserts *behavioral* invariants of the decompose prompt (fanout adherence, depth budget, structure-respect honoring, semantic-label emission when the schema includes optional `tags`/`entities`). Phase 3's 3.4 smoke triage surfaced the cost of not having this: the canned-provider unit tests in `packages/core/test/decompose-tags-entities.test.ts` verified passthrough only and could not detect that the real model was emitting `tags=[]`/`entities=[]` on every node — a divergence that would have caught any reviewer in seconds had a live-model test been in place. Pull in when API cost / latency in CI is acceptable, or when prompt edits need a stronger gate than the current manual spotcheck.
- **Runtime reconstruction guard.** Have `decompose()` compute the leaf-vs-source Jaccard after each LLM call and warn (or throw) below a threshold so the verbatim-reconstruction bug we fixed in phase 2.5 can't silently regress. Pull in if a future prompt edit re-introduces the regression, or before shipping consumer-facing flows where a malformed tree would be hard to debug.
- **Paragraph-pipeline decompose (bubble-up as a real multi-call pipeline).** Phase-2.5 candidate parked for later. Idea: per-paragraph LLM call → per-section synthesis call → root, mirroring large-tier's chunk → synthesize shape at finer granularity. Total tokens ≈ same as one sweep, but each call is small and focused, which should help quality on documents where the single-sweep model loses focus. Pull in if the consolidated single-sweep default produces weak section titles on real inputs after Phase 2.5.
- **Multi-language source support.** Pull in when a non-English use case appears.
- **Multi-agent context routing (sub-message granularity).** Phase 3 shipped a working `route()` + `compile()` + benchmark harness + 13-entry curated dataset + multi-turn arc + three judges (steering, output quality, propagation) under `packages/context-compiler/`, but produced no defensible win over `flat-broadcast` or DACS-style focus baselines on the curated dataset. Three structural blockers (recorded in `specs/phase-3-context-compiler-2026-05-08/` and `packages/context-compiler/benchmarks/findings.md`): in-the-wild multi-agent fan-out is rare in public chat dumps; open-set tag emission cannot reliably align with arbitrary downstream agent-filter vocabularies; multi-turn fact-propagation trended worse than flat baselines in the (single-entry, not-generalizable) smoke. Code preserved in the repo as research artifact, not on the v1 NPM surface. Pull in if any of: (a) a domain-specific use case provides a real fan-out dataset and an aligned tag vocabulary; (b) someone wants to push it as a research artifact rather than a v1 product feature; (c) chat-orchestrator costs shift enough that the DACS-amortization argument flips direction; (d) a controlled-vocabulary tag schema becomes acceptable (would break the v1 "model-chosen, open-set" architectural invariant — see the Phase 3 spec folder for the trade).
- **NPM publish prep (and live publish) for the shipped engine surface.** Phase 3 originally bundled publish prep with the routing work; that pairing was severed in the 2026-05-17 pivot. The mechanical work (root `LICENSE` MIT, `license` field on each published package, `publishConfig.access = "public"` for scoped packages, `pnpm publish --dry-run` clean `files` list per package, NPM scope availability check with fallback name, no `workspace:*` leakage, no `.env` / fixtures shipped) is itself a fine forcing-function for hygiene but does not need a phase slot until there's a real consumer waiting. Pull in when LinkedIn post #1 (Phase 4) is being drafted and needs an `npm install` line, or when an external consumer outside the monorepo asks. License decision is settled (MIT, per resolved-questions in this phase's `requirements.md`); scope name and fallback selection are unresolved and live with this Deferred item.
- **Concept-graph across conversations.** A *different product* than tier-reader, sharing infrastructure. tier-reader trees one piece of text; a concept-graph layer would track ideas across many turns over time — branching, persisting, merging, withering. The bridge is tier-reader's per-node `tags`/`entities` (optional schema fields added in Phase 3 and retained on the schema after Phase 3's routing pivot — see *Multi-agent context routing* below for the archival context): if every turn is decomposed and tagged, concepts can connect across turns by tag-graph traversal. Adjacent territory: Letta, mem0, zettelkasten-with-LLM, "thought graphs." Not how production memory systems are typically built today (most are flat-window + retrieval); this is a research direction. Pull in only after the four mission deliverables ship — could become the backbone of a v2 product, but is not a v1 deliverable.

## Open questions

- [phase 2.5/2.6 ordering] **Streaming before or after agent-tactics deep dive?** Streaming makes 2.5 experimentation less painful (no 30-second stares per tactic comparison). 2.5-first means streaming may need rework if winning tactic changes emission shape. Lean: streaming first (largely orthogonal to which tactic wins), but defer the call to /replan.
- [phase 2.6 / streaming, when picked up] **Mid-flight cancel UX.** Phase 2 validation step 7 (abort a long large-tier run) is not actually wired up — there's no UI cancel and `AbortSignal` plumbing through medium/large multi-call paths is untested. Ties naturally into the streaming work.
