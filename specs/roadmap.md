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

## Phase 2 — Engine large-text strategy

- [ ] `detectTier(input)` — picks small / medium / large from input size and model context window.
- [ ] **Medium:** outline-then-sections, parallel section decompose.
- [ ] **Large:** structural chunking + per-chunk decompose + synthesis merge.
- [ ] Tests with progressively larger fixtures (paragraph → article → multi-section spec).
- [ ] Document seam behavior at chunk boundaries for the large case.

**Demoable:** engine handles a 50KB Wikipedia article without truncation; `pnpm test` passes against fixtures of all three tiers.

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

- **Streaming generation (scaffold-then-fill).** Pull in when extension UX feels slow on large inputs. Architecturally compatible with current schema.
- **Standalone AI-chat-display package.** Pull in if a real consumer use case appears outside the extension.
- **Server-side API key proxy for the extension.** Pull in only if the extension graduates from personal-use-only.
- **Web Store listing for the extension.** Pull in if the extension proves valuable enough to share.
- **Cross-section rebalance pass for large-text strategy.** Pull in if chunk-boundary seams prove visibly bad.
- **Multi-language source support.** Pull in when a non-English use case appears.
- **Visual playground app for prompt iteration.** Local Vite + React app at `apps/playground/` wrapping `decompose()` with a tree view, so prompt tuning has visual feedback before phase 5's full React renderer. Strong Phase 1.5 candidate at next `/replan`.

## Open questions

- [phase 3] **Benchmark dataset sourcing** — handcrafted 20 messages vs adapted from DACS paper. Adapted = more comparable to prior work; handcrafted = faster.
- [phase 3] **Steering-accuracy judge model** — which Claude model judges? Default: Sonnet (judge ≠ benchmarked-by-default).
