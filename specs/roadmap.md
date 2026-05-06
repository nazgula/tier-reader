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

- [ ] Survey prior art: hierarchical summarization, semantic chunking, DACS, progressive disclosure research, related agentic strategies for long-document understanding.
- [ ] Prototype 2–3 alternative tactics for medium/large decomposition (e.g. retrieval-then-decompose, iterative refinement, structured map-reduce variants).
- [ ] Compare tactics on the playground against shared fixtures; capture qualitative + token/latency notes.
- [ ] Decide which tactic(s) graduate into the engine; fold winners into `core` or document why none did.

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
- [ ] Tier selection at compile time: walk subtree to budget-fitting depth.
- [ ] `bullets` and `prose` output formats (prose = linearize titles into paragraphs).
- [ ] Benchmark harness: 20 multi-domain user messages, agent counts N=3, 5, 10.
- [ ] Measurements: tokens per agent (avg), total tokens across agents, steering accuracy via LLM-as-judge.
- [ ] Resolve license + NPM scope; publish `@tier-reader/core` + `context-compiler` to NPM.

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
- **Multi-language source support.** Pull in when a non-English use case appears.

## Open questions

- [phase 3] **Benchmark dataset sourcing** — handcrafted 20 messages vs adapted from DACS paper. Adapted = more comparable to prior work; handcrafted = faster.
- [phase 3] **Steering-accuracy judge model** — which Claude model judges? Default: Sonnet (judge ≠ benchmarked-by-default).
- [phase 2.5/2.6 ordering] **Streaming before or after agent-tactics deep dive?** Streaming makes 2.5 experimentation less painful (no 30-second stares per tactic comparison). 2.5-first means streaming may need rework if winning tactic changes emission shape. Lean: streaming first (largely orthogonal to which tactic wins), but defer the call to /replan.
- [phase 2.5 / playground] **View-mode design** — playground now ships three reading modes (Frontier / Slice / Verbatim) added 2026-05-05 to play with the user-stated intuition that each layer should read as "the only thing you see." Open whether to graduate this into `@tier-reader/react`'s public surface or keep it playground-only until a clear winner emerges. Also open: behavior of mixed-depth leaves in Slice mode (currently strict — depth-1 leaves don't appear in layer-2 slice; an alternative is "bubble up" so source coverage stays complete).
- [phase 2.6 / streaming, when picked up] **Mid-flight cancel UX.** Phase 2 validation step 7 (abort a long large-tier run) is not actually wired up — there's no UI cancel and `AbortSignal` plumbing through medium/large multi-call paths is untested. Ties naturally into the streaming work.
