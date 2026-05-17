# Phase 3 — Plan

Status: 1 [x], 2 [x], 3 [~] (3.1 [x], 3.2 [x], 3.3 [x], 3.3.5 [ ], 3.4 [ ]), 4 [ ], 5 [ ], 6 [ ]

## 1. [x] Schema extension: tags + entities on nodes

- Add optional `tags?: string[]` and `entities?: string[]` to `Node` in `packages/core/src/schema.ts`. Document in `docs/schema.md`.
- Update decompose prompt(s) in `packages/core/src/prompt.ts` (or wherever the v2.5 default lives) to emit tags/entities per node:
  - **tags** = short topical labels (e.g. `["payments", "kyc"]`); free-form vocabulary, model-chosen.
  - **entities** = proper nouns / named entities surfaced from source (e.g. `["Stripe", "ACH"]`).
  - Both optional in the prompt — model may emit `[]` if nothing applies.
- Validate schema: empty arrays equivalent to absent. Existing fixtures still parse.
- Unit tests:
  - Tree with tags/entities round-trips through schema.
  - Decompose run on a fixture produces non-trivial tags/entities (≥1 distinct tag and ≥1 distinct entity in a multi-topic message).
- No engine behavior change beyond emission — `decompose`, `renderAt`, tier dispatch untouched.

**Demoable for sub-stage:** existing decompose test fixtures pass; one new fixture asserts tags/entities populated.

## 2. [x] `context-compiler` package: route + compile

- Scaffold `packages/context-compiler/` (package.json, tsconfig, vitest config) with workspace wiring (`pnpm-workspace.yaml`, `turbo.json`).
- Depend on `@tier-reader/core` and Vercel AI SDK (Voyage embedding adapter).
- `src/types.ts`: `AgentSpec = { id, domain, description, tagFilters?: string[], entityFilters?: string[] }`. Compile output types.
- `src/route.ts`: hybrid mechanism.
  - **Step A (hard filter):** for each subtree, accept iff tag/entity intersection with `agent.tagFilters`/`entityFilters` is non-empty. If both filters empty on the agent, all subtrees pass step A.
  - **Step B (similarity rank):** embed `agent.description` and each surviving subtree's title via Voyage `voyage-3-lite`. Cosine similarity. Drop below tunable threshold (default 0.3, configurable via `opts.threshold`).
  - Subtree-granularity decision: walk top-level children of root; deeper recursion is opt-in via `opts.maxDepth`.
  - Returns `Node[]` per agent.
- `src/compile.ts`: walk to budget-fitting depth (binary search over `renderAt` depth) for the chosen subtrees; emit `bullets` (markdown bullet tree) or `prose` (linearize titles into paragraphs by source order).
- `src/index.ts`: re-export.
- Unit tests:
  - `route()` returns expected subtrees for a hand-built tree + agent spec across filter-only, embedding-only, and hybrid modes (use a stubbed embedder to keep tests offline).
  - `compile()` honors budget; switches format correctly; preserves source order.

**Demoable for sub-stage:** `pnpm --filter context-compiler test` green.

## 3. [~] Benchmark harness + dataset + results — split into 3.1–3.4

Split mid-phase after Pass A/B (commits `88b004e` … `984594c`) revealed the originally-monolithic group 3 was oversized. Already-landed work: harness scaffolding, cost guards, dataset stub (8 single-turn + 1 multi-turn), smoke run, judge model fix. See `packages/context-compiler/benchmarks/findings.md` for the gap list and the `route()` open investigation that motivated this split.

The original sub-bullets of group 3 (dataset spec, agent rosters, run.ts orchestrator, end-to-end agent runs, LLM-as-judge, embedding cache, `pnpm bench` script, findings writeup) are now distributed across 3.1–3.4 below — bullets that already shipped are not restated.

## 3.1 [x] `route()` filter investigation + fix

- Instrument `route()` to log `(entry-id, agent-id, step-A-survivors, step-B-survivors)` on at least one entry per domain represented in the current dataset stub.
- Decide on the fix and apply it: filter relaxation (lowercased substring match, or fall back to embedding-only when step-A returns empty) vs dataset tag-vocabulary alignment with agent filters. Filter-relaxation is the more honest fix — agent filters in the wild won't be perfectly aligned with model-emitted tags either. Document the call.
- Unit test the chosen behavior in `packages/context-compiler/test/`.
- Re-run smoke (1 entry × N=3 × 5 conditions) and confirm `tier-hybrid` produces non-empty slices for at least one agent. Update `findings.md` "Open investigation" section to closed.

**Demoable for sub-stage:** smoke re-run shows non-empty `tier-hybrid` slices; `findings.md` open-investigation section is resolved.

## 3.2 [x] Dataset to floor + DACS coverage

- Public-dump entries: ~6–8 from ShareGPT / LMSYS-Chat-1M / WildChat with proper per-entry citations. Flag `synthetic: false`.
- Hebrew author-history: translate the BringUp 5-turn arc + 1–2 other strong candidates from the `examples/maria-chats/` working set. Confirm Hebrew-judge feasibility or commit to English-translated-only entries.
- DACS coverage check: cross-reference DACS paper archetype list against final dataset; gap-fill with AI-generated entries flagged `synthetic: true`.
- Ship at **13 entries (partial dataset)** rather than the originally-targeted ≥20. Rationale: public-dump path was dropped on methodological grounds (recorded in `findings.md` → "Dataset"), and a re-screen of `examples/tier-reader-benchmark-picks-examples/new/` produced no additional qualifying multi-agent-fan-out candidates. Re-enlargement (debugging-fan-out + clinical-methodology gap-fills, plus any further author-history mining) is **conditional on positive signal in 3.4**. Update anonymization mapping in `findings.md` if new third-party names surface in any future enlargement.

**Demoable for sub-stage:** `dataset.ts` exports 13 entries (partial dataset, flagged as such) with sources cited; `findings.md` "Deferred / gap list" items 1, 2, 4 closed; item 5 reframed to conditional re-enlargement.

## 3.3 [x] Multi-turn harness wiring

- `runner.ts`: route per-turn over the running conversation tree (re-decompose each turn, re-route). Replace the current "skip multi-turn" path.
- Propagation judge: Sonnet 4.6 evaluates whether facts established in earlier turns appear in the routed slice for the evaluated turn. Rubric added to `judge-prompts.ts`, returns 0–5 + one-line rationale.
- Author at least 2 multi-turn entries beyond the existing schema stub.
- Multi-turn signal section appended to `findings.md`.

**Demoable for sub-stage:** `pnpm bench` no longer skips multi-turn entries; `results.json` contains a `multiTurn` section.

## 3.3.5 [ ] Decompose prompt: tag/entity emission hardening

Inserted mid-phase after the first 3.4 smoke-and-triage pass surfaced a Phase-1 invariant gap: `decompose()` against a real model emits `tags=[]` and `entities=[]` on every node, including on content with obvious named entities (Gemini, Whisper, FFmpeg, TypeScript) and obvious domain framing (refunds, FAQ, checkout, backend, frontend). Phase-1 group 1's test layer (`packages/core/test/decompose-tags-entities.test.ts`) only exercised passthrough through a canned-provider mock and never invoked the prompt against a model, so the under-emission shipped undetected. `route()`'s Step-A overlap filter is mechanically reachable but functionally dead until emission is fixed — `tier-hybrid` collapses to `tier-embed-only` via the 3.1 `fallbackOnEmpty` path on every cell. See `packages/context-compiler/benchmarks/findings.md` → "Open investigation — tag emission" for the captured dump-tags evidence.

- Strengthen tag/entity guidance in `packages/core/src/prompt.ts`. Split the existing "OPTIONAL METADATA" block: keep `kind` as default-omit, promote `tags` / `entities` to a default-emit "SEMANTIC LABELS" section that names under-emission as the failure mode and gives concrete domain-label and named-entity examples aligned with the `agents.ts` filter vocabulary. Stay open-set — honor the architectural invariant in this plan's "Architecture impact" section that vocabulary is model-chosen, not controlled.
- Add a real-model decompose test in `packages/core/test/` — proposed `decompose-prompt-emission.live.test.ts`, gated on an env flag (e.g. `LIVE_TESTS=1`) so it only runs when an Anthropic API key is available. Fixtures: (a) multi-domain technical content with named tools, (b) plain-English support FAQ framing, (c) a domain-neutral greeting/metadata fixture as a negative control. Asserts: for (a) and (b) the resulting tree has ≥1 distinct tag and ≥1 distinct named entity across leaves; for (c) zero required (emission must be content-conditional, not unconditional).
- Confirm the existing canned-provider tests in `decompose-tags-entities.test.ts` still pass (the schema and passthrough contract are unchanged; this is verification, not edit).
- Re-run `pnpm --filter @tier-reader/context-compiler bench:smoke -- --trace` and confirm `tier-hybrid` produces non-empty Step-A survivor counts on at least one (entry, agent) pair — i.e. that Step A's filter is now functionally reachable, not just a no-op short-circuited by the embedding fallback. If Step A still empties on every cell after the prompt change, stop and surface — the issue is deeper than emission framing.
- Append a "Tag emission hardening" section to `packages/context-compiler/benchmarks/findings.md` with: pre-fix dump-tags evidence (zero tags/entities across smoke entries), the prompt change made, post-fix dump-tags evidence, and the post-fix bench:smoke trace counts.

**Demoable for sub-stage:** dump-tags output on the 3.2 dataset shows non-empty tags/entities on domain-bearing leaves; `bench:smoke --trace` produces at least one `stepA>0` cell that is not driven by the `fallbackOnEmpty` path.

## 3.4 [ ] Real bench run + writeup

- Run full `pnpm bench` over the floor-met dataset across N=3, 5, 10 and all five conditions.
- Populate the success-signal table in `findings.md` with real numbers (mean steering 0–5, mean output quality 0–5, mean input tokens / agent, wins vs flat, wins vs DACS).
- Write the "Observed wins/losses" section: per-condition narrative tied to specific entry ids.
- Refresh "Threats to validity" against what the real run actually exposed.
- Decide whether `results.json` is committed (size + sensitivity check) or referenced by path only.

**Demoable for sub-stage:** `findings.md` has a populated success-signal table and an observed-wins/losses section grounded in real numbers from a real `pnpm bench` run.

## 4. [ ] Playground agent-routing pane

- New view in `apps/playground/src/`: tab or pane next to the existing tree view.
- UI: list of agents (id, description, optional tag/entity filter inputs), "decompose + route" button, side-by-side panels per agent showing the compiled slice + token count + matched subtree titles.
- Uses an existing or new `/api/route` endpoint that calls `context-compiler` server-side (Voyage key stays Node-side, same pattern as `ANTHROPIC_API_KEY`).
- Reuses the existing decompose flow; the route step composes onto the resulting tree.

**Demoable for sub-stage:** `pnpm --filter @tier-reader/playground dev` opens; agent-routing pane renders distinct slices for a 3-topic test message at N=3.

## 5. [ ] Long-AI-chat decomposition + reflection-agent eval

- Pick a real long AI conversation transcript that decomposes a multi-section work process. Save under `packages/core/test/fixtures/long-chat-transcript.md` (committed if shareable; otherwise `.local.md` per the gitignore rule and reference path-only).
- Run engine decompose on it. Save the resulting tree to `specs/phase-3-context-compiler-2026-05-08/long-chat-tree.json`.
- Eyeball pass: open the tree in the playground, walk the structure, jot observations.
- Reflection-agent pass: Sonnet 4.6 prompted with `(source transcript, resulting tree)` answers four questions:
  - Faithfulness — does the tree represent the source without dropping or fabricating content?
  - Section coherence — do top-level subtrees correspond to coherent sections of the source?
  - Failure modes — where does the decomposition visibly fail or read as awkward?
  - Comparison to flat reading — would a reader prefer this over scrolling the raw transcript?
- Write up combined findings (eyeball + reflection agent) in `specs/phase-3-context-compiler-2026-05-08/findings-long-chat.md`.

**Demoable for sub-stage:** `findings-long-chat.md` exists with both eyeball notes and the reflection-agent's structured response.

## 6. [ ] License + NPM scope verification + dry-run (publish prep only)

- Add root `LICENSE` (MIT, current year, copyright holder = repo author handle).
- Add `license` field to `packages/core/package.json` and `packages/context-compiler/package.json`.
- Verify NPM scope availability:
  - Check `@tier-reader` org availability; if free, claim now. If taken, pick a fallback scope (record the chosen name in this folder's `requirements.md`).
  - Confirm `context-compiler` (unscoped) is available; fallback `@tier-reader/context-compiler`.
- Bump versions to `0.1.0`. Add `publishConfig.access = "public"` for scoped packages.
- Verify package boundaries: no monorepo `workspace:*` deps leak into the published `package.json` (turn into pinned versions at publish-prep, not publish).
- `pnpm publish --dry-run` per package; review the `files` list — no `.env`, no test files, no fixtures we don't want shipped.
- **Live `pnpm publish` is deferred to Phase 4** so packages and LinkedIn post go live together. Phase 3 ends in publish-ready state.

**Demoable for sub-stage:** both packages pass `pnpm publish --dry-run` cleanly; `LICENSE` committed; scope name confirmed (or fallback chosen).

## Architecture impact

`docs/architecture.md` will need updates at finish-phase time:

- §1 system topology: `context-compiler` becomes a real consumer of `core`, not a future box.
- §2 runtime workflow: `tree → route(tree, agent) → compile(nodes, budget, format)` becomes a documented, exercised path with concrete mechanism (hybrid filter + voyage-3-lite embedding rank).
- §3 repo layout: `packages/context-compiler/{src,benchmarks,test}/` populated; new playground server route `/api/route`; `packages/core/test/fixtures/long-chat-transcript.md` (or `.local.md`).
- Dependency direction: add Voyage embeddings (via AI SDK) as an external dep used by `context-compiler` — `core` itself does not gain this dep.
- Invariants: add **tags/entities are optional** schema invariant; trees without them remain valid. Note that tag/entity vocabulary is model-chosen and **not** a controlled vocabulary in v1.
- New invariant: `route()` is **deterministic given a fixed embedder + threshold** (Step A is set intersection, Step B is cosine sort). Embeddings themselves are deterministic per Voyage.
- §1 invariant: Voyage API key handling matches the existing `ANTHROPIC_API_KEY` pattern — never reaches the browser; playground server-side only.
