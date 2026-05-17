# Phase 3 — Context-compiler library + benchmark + NPM publish

## Why

Deliverable B of the mission: ship multi-agent context routing on top of the engine, prove it beats both flat-broadcast and DACS-style focus mode on tokens-and-steering, publish the two libraries to NPM, and produce a live demo artifact for LinkedIn post #1. The contribution being staked: **sub-turn-granularity routing** — decomposing one user turn into a clause-tree and routing subtrees, not whole agents.

## In scope

- **Schema extension (core).** Optional `tags?: string[]` and `entities?: string[]` per node. Decompose prompt emits them. Backward-compatible (optional fields, existing trees still valid).
- **`context-compiler` package.** New workspace package under `packages/context-compiler/`.
  - `route(tree, agent, opts?)`: hybrid mechanism — hard pre-filter on tag/entity intersection from agent spec, then Voyage `voyage-3-lite` cosine similarity (agent description ↔ subtree title) ranking over survivors. Tunable threshold; below threshold → no agent. Returns `Node[]`.
  - `compile(nodes, budget, format)`: walk subtree to budget-fitting depth (uses `renderAt`-style depth control); emit `bullets` or `prose`.
  - Agent spec: `{ id, domain, description, tagFilters?, entityFilters? }`.
- **Benchmark harness** under `packages/context-compiler/benchmarks/`.
  - Dataset: review DACS paper for must-cover message cases (multi-topic, mixed-domain, etc.); handcraft remaining messages emphasizing multi-topic structure that exercises sub-message routing. ≥20 messages total; more if DACS coverage warrants.
  - Two baselines: (a) flat-broadcast, (b) DACS-style focus mode (focused agent gets full message, others get a 200-token summary), re-implemented as a small wrapper.
  - Ablations: filter-only and embedding-only routing.
  - Agent counts: N=3, 5, 10.
  - **End-to-end run, not just routing.** For each (message, N, condition) cell: actually invoke each agent with its assigned context and capture its output.
  - Metrics:
    - Tokens-per-agent (avg) and total tokens across agents (input side).
    - **Steering accuracy** via LLM-as-judge (Sonnet 4.6): does the slice contain what the agent needs?
    - **Agent output quality** via LLM-as-judge (Sonnet 4.6): given the message's expected per-agent task, does the agent's actual output complete it correctly? This is the load-bearing comparison for LinkedIn post #1.
  - Output: `benchmarks/results.json` plus `benchmarks/findings.md` with a comparison table across all three metrics.
- **Playground agent-routing pane.** Define N agents (id + description + optional tag/entity filters), decompose a multi-topic message, show each agent's slice side-by-side with per-agent token counts. Live demo artifact for LinkedIn post #1.
- **NPM publish *prep* (not live publish).**
  - Add root `LICENSE` (MIT).
  - Verify `@tier-reader` scope availability on NPM; if taken, pick a fallback name now (recorded in this folder).
  - `pnpm publish --dry-run` for both packages: confirm `files` list is clean, no `workspace:*` leakage, no `.env` or test files.
  - **Live `pnpm publish` moves to Phase 4** — publish coincides with LinkedIn post #1 going live so install instructions in the post work on day one.

- **Long-AI-chat decomposition fixture.** New fixture: a real long AI conversation transcript decomposing a multi-section work process. Used for both eyeball validation and a reflection-agent qualitative pass (Sonnet 4.6 reads the tree, comments on faithfulness, section coherence, and failure points). Output captured in `specs/phase-3-context-compiler-2026-05-08/findings-long-chat.md`.

## Out of scope

- Streaming generation. Still deferred per `roadmap.md` § Deferred.
- `@tier-reader/react` package. Phase 5.
- Chrome extension. Phase 5.
- Cross-section rebalance pass. Deferred.
- Automated output-quality CI. Deferred.
- Agent-to-agent message passing or orchestration semantics — `context-compiler` produces per-agent context slices, not an agent runtime.
- Multi-language support.
- Additional embedding providers beyond Voyage; AI SDK swap is cheap but unused.

## Success signal

`pnpm bench` produces `benchmarks/results.json` showing tier-reader's hybrid routing beats **both** flat-broadcast and DACS-style focus mode on **agent output quality at equal-or-lower total tokens** at N=5 and N=10 — i.e. agents act at least as correctly with smaller per-agent context. Both packages pass `pnpm publish --dry-run` cleanly and have a claimed (or fallback-named) NPM scope ready. Playground agent-routing pane visibly shows distinct slices going to each agent. Long-AI-chat fixture decomposes into a tree that the reflection agent rates as faithful and coherent (qualitative findings written up).

## Open-questions resolved this phase

- **[mission, phase 3] License (MIT vs Apache 2.0)** — MIT. Default lean confirmed; no compelling reason to take Apache 2.0's patent-grant complexity for a library at this stage.
- **[tech-stack, phase 3] NPM scope and final package names** — verified at sub-stage 5 of this phase as part of publish prep; live `pnpm publish` deferred to Phase 4 to coincide with LinkedIn post #1.
- **[tech-stack, phase 3] Langfuse free-tier limits + retention** — runtime sanity check only; no special prep work. Volume during a 20-message × N=10 × baselines × ablations benchmark is well inside free tier; if traces overflow, drop trace flush calls in benchmark harness.
- **[roadmap, phase 3] Benchmark dataset sourcing** — review DACS paper for must-cover cases; handcraft remaining messages emphasizing multi-topic structure; no fixed split; ≥20 total, expand if DACS coverage demands.
- **[roadmap, phase 3] Steering-accuracy judge model** — Sonnet 4.6.

## Open questions

- **NPM scope fallback name** — only resolved at sub-stage 5 once availability is checked. Not blocking earlier work.
- **Voyage API key handling in benchmark + playground** — `VOYAGE_API_KEY` from `.env.local` (Node-side); same pattern as `ANTHROPIC_API_KEY`. Confirm at sub-stage 2 implementation.
- **Embedding cache for benchmark reproducibility** — likely needed (re-running 20 messages × multiple agent rosters across ablations re-embeds the same titles). Decide at sub-stage 3 whether to ship a simple on-disk cache or just accept the spend.
