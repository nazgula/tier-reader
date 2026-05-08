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

- [ ] `context-compiler` package: `route(tree, agent)` and `compile(nodes, budget, format)` over the engine.
- [ ] Agent spec format: `{ id, domain, tagFilters?, entityFilters? }`.
- [ ] **Lock `route()` mechanism before benchmarking:** tag/embedding match (deterministic, no orchestrator LLM call) vs LLM-routed (richer matching, costs one extra call per turn). Choice changes what the benchmark measures and what the post can claim. Default lean: tag/embedding match — the "no-orchestrator-LLM" story is a clean differentiator vs DACS.
- [ ] Tier selection at compile time: walk subtree to budget-fitting depth.
- [ ] `bullets` and `prose` output formats (prose = linearize titles into paragraphs).
- [ ] Benchmark harness: 20 multi-domain user messages, agent counts N=3, 5, 10. **Two baselines, not one:** (a) flat-broadcast (full message to every agent) and (b) DACS-style focus mode (full message to one focused agent + 200-token summaries to the rest, re-implemented as a small harness wrapper from arXiv:2604.07911). Beating only flat-broadcast is not a defensible claim in 2026 — DACS is the prior art reviewers will cite.
- [ ] Measurements: tokens per agent (avg), total tokens across agents, steering accuracy via LLM-as-judge.
- [ ] Resolve license + NPM scope; publish `@tier-reader/core` + `context-compiler` to NPM.

**Framing for LinkedIn post #1 (Phase 4):** the contribution is **sub-turn-granularity** routing — DACS routes whole agents in/out of focus; tier-reader decomposes one user turn into a clause-tree and routes subtrees. Different unit, sharper benchmark.

**Demoable:** `pnpm bench` produces `benchmarks/results.json` with token + accuracy comparison vs flat-broadcast baseline. Both packages installable from NPM.

---

## Phase 4 — LinkedIn post #1

- [ ] Write blog post: *"Sub-message semantic decomposition for multi-agent context routing."*
- [ ] Sections: problem, related work (DACS, Anthropic Skills), contribution (sub-message granularity), method (decompose → tier → route), results, limitations, code link.
- [ ] Cross-post: GitHub repo README, Medium / dev.to, LinkedIn.
- [ ] Verify install instructions work from a fresh `pnpm create` outside the monorepo.

**Demoable:** post is live on LinkedIn; benchmark numbers cited match `benchmarks/results.json`.

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
- **Automated output-quality tests.** Wire the spotcheck checks (verbatim-reconstruction Jaccard, no-single-child-paraphrase) into a live-LLM test job that runs on demand or in CI rather than as a manual script. Pull in when API cost / latency in CI is acceptable, or when prompt edits need a stronger gate than the current manual spotcheck.
- **Runtime reconstruction guard.** Have `decompose()` compute the leaf-vs-source Jaccard after each LLM call and warn (or throw) below a threshold so the verbatim-reconstruction bug we fixed in phase 2.5 can't silently regress. Pull in if a future prompt edit re-introduces the regression, or before shipping consumer-facing flows where a malformed tree would be hard to debug.
- **Paragraph-pipeline decompose (bubble-up as a real multi-call pipeline).** Phase-2.5 candidate parked for later. Idea: per-paragraph LLM call → per-section synthesis call → root, mirroring large-tier's chunk → synthesize shape at finer granularity. Total tokens ≈ same as one sweep, but each call is small and focused, which should help quality on documents where the single-sweep model loses focus. Pull in if the consolidated single-sweep default produces weak section titles on real inputs after Phase 2.5.
- **Multi-language source support.** Pull in when a non-English use case appears.

## Open questions

- [phase 3] **Benchmark dataset sourcing** — handcrafted 20 messages vs adapted from DACS paper. Adapted = more comparable to prior work; handcrafted = faster.
- [phase 3] **Steering-accuracy judge model** — which Claude model judges? Default: Sonnet (judge ≠ benchmarked-by-default).
- [phase 2.5/2.6 ordering] **Streaming before or after agent-tactics deep dive?** Streaming makes 2.5 experimentation less painful (no 30-second stares per tactic comparison). 2.5-first means streaming may need rework if winning tactic changes emission shape. Lean: streaming first (largely orthogonal to which tactic wins), but defer the call to /replan.
- [phase 2.6 / streaming, when picked up] **Mid-flight cancel UX.** Phase 2 validation step 7 (abort a long large-tier run) is not actually wired up — there's no UI cancel and `AbortSignal` plumbing through medium/large multi-call paths is untested. Ties naturally into the streaming work.
