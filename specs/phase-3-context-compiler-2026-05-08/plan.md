# Phase 3 — Plan

Status: 1 [ ], 2 [ ], 3 [ ], 4 [ ], 5 [ ], 6 [ ]

## 1. [ ] Schema extension: tags + entities on nodes

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

## 2. [ ] `context-compiler` package: route + compile

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

## 3. [ ] Benchmark harness + dataset + results

- `packages/context-compiler/benchmarks/dataset.ts`: ≥20 messages, each with metadata `{ id, text, expectedAgents: string[] }`.
  - Pull DACS paper, list its message archetypes, and ensure dataset covers each one we're claiming to route well.
  - Handcraft remaining messages with explicit multi-topic structure (clause A → agent X, clause B → agent Y).
- `benchmarks/agents.ts`: agent rosters for N=3, 5, 10 (id, description, system prompt, optional tag/entity filters). System prompt is what gets sent when the agent is actually invoked end-to-end.
- `benchmarks/dataset.ts` per-message field: `expectedTasks: { agentId: string; expectedTask: string }[]` — feeds the output-quality judge.
- `benchmarks/run.ts`: orchestrator. For each (message, N) cell, build per-agent context under each condition:
  - **flat-broadcast baseline:** full message to every agent.
  - **DACS focus-mode baseline:** focused agent (heuristic: highest-similarity agent description) gets full message, others get a 200-token summary (one Sonnet call to summarize).
  - **tier-reader hybrid:** decompose message → for each agent, `route()` then `compile(budget, format)`.
  - **ablations:** filter-only `route()`, embedding-only `route()`.
- **End-to-end agent runs.** For each cell, actually invoke each agent with its assigned context (Haiku 4.5 by default; agent system prompt = its `domain` + `description`). Capture the agent's output. Token counts are real input/output token counts from the API, not estimates.
- LLM-as-judge: Sonnet 4.6 evaluates two things per agent per condition:
  - **Steering accuracy:** "does this slice contain what this agent needs to act on?" (judges the *input* the agent received).
  - **Output quality:** "given this message's expected per-agent task, did the agent's output complete it correctly?" (judges the *output* the agent produced). Each dataset entry carries `expectedAgents: string[]` and a per-agent expected-task description used by this judge.
  - Rubrics in `benchmarks/judge-prompts.ts`. Both judges return a 0–5 score plus a one-line rationale.
- Embedding cache (decide here): if running cost is annoying, add a content-hash-keyed JSON cache under `benchmarks/.cache/`.
- `pnpm bench` script runs the harness, writes `benchmarks/results.json`.
- Findings writeup `benchmarks/findings.md`: summary table, observed wins/losses per condition, threats to validity.

**Demoable for sub-stage:** `pnpm bench` produces `results.json` with the success-signal table populated.

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
