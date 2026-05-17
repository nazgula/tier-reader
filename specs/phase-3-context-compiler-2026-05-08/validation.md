# Phase 3 — Validation

## Manual checks

1. **Schema extension works end-to-end.**
   - Run an existing playground decompose on a multi-topic fixture (e.g. the AI-chat-output fixture from phase 2).
   - Open the raw JSON pane: confirm at least some leaves and parents have non-empty `tags` and `entities`. Confirm trees without them still parse (load a pre-phase-3 fixture if one exists).
2. **`route()` returns sensible slices on a known message.**
   - In the playground agent-routing pane, paste a 3-topic message (e.g. "I need to refund a customer via Stripe, also debug a Postgres deadlock, and draft a launch tweet").
   - Define 3 agents: payments, infra, marketing.
   - Click decompose+route. Each agent's slice should visibly contain the relevant clause(s) and not the others. Per-agent token counts < full-message token count.
3. **Benchmark harness reproducible run, end-to-end.**
   - `pnpm bench` from clean state. Walk through stdout: 20+ messages × {N=3,5,10} × {flat, DACS, hybrid, filter-only, embedding-only}.
   - For each cell: actual agent invocations happen, outputs captured, both judges (steering + output quality) score.
   - `benchmarks/results.json` exists, parses, and shows the table with all three metrics: total tokens, steering accuracy, output quality.
   - `benchmarks/findings.md` exists with summary tables (one per agent count), per-condition winners, and threats-to-validity section. The DACS-vs-tier-reader output-quality comparison is the headline.
4. **Long-AI-chat decomposition pass.**
   - Pick a real long AI conversation transcript (a session decomposing a multi-section work process). Decompose it via the engine (playground or CLI).
   - Eyeball pass: open the tree, walk top-level subtrees, confirm they correspond to coherent sections of the source. Note any places the decomposition reads awkward.
   - Reflection-agent pass: Sonnet 4.6 reads `(transcript, tree)` and answers the four questions (faithfulness, section coherence, failure modes, would-a-reader-prefer-this).
   - Combined writeup committed to `specs/phase-3-context-compiler-2026-05-08/findings-long-chat.md`.
5. **NPM publish-prep dry run.**
   - `pnpm publish --dry-run` for both packages: review `files` list, confirm no `.env`, no test files, no monorepo `workspace:*` deps.
   - `LICENSE` present at repo root; `license` field present in both packages' `package.json`.
   - Scope availability confirmed (or fallback name recorded).
   - Live `pnpm publish` is **not** done in this phase — it ships in Phase 4 alongside LinkedIn post #1.

## Automated checks

- `pnpm test` green across workspace (existing core tests + new core schema tests + new context-compiler tests).
- New tests added by this phase:
  - `packages/core/test/schema-tags-entities.test.ts` — round-trip and optional-field handling.
  - `packages/core/test/decompose-emits-tags.test.ts` — live or recorded LLM call asserting non-empty tag/entity output on a multi-topic fixture.
  - `packages/context-compiler/test/route.test.ts` — hand-built tree + stubbed embedder; covers filter-only, embedding-only, hybrid, threshold edge cases.
  - `packages/context-compiler/test/compile.test.ts` — budget honored; bullets vs prose format; source-order preservation.
- `pnpm lint` (Biome) clean.
- `tsc --noEmit` per package clean.
- `pnpm bench` exits 0 and writes `results.json` populated with token, steering, and output-quality metrics across all conditions.

## Regression watch

- **Existing decompose fixtures.** Adding tag/entity emission must not change tree structure, titles, or leaf detail. Re-run phase-1.5 / phase-2 fixtures and diff: only new optional fields should appear.
- **Verbatim-reconstruction invariant.** The phase-2.5 invariant (concat of leaf `detail` ≈ source) must still hold after the prompt change. If a tag/entity prompt addition causes the model to drop content into the tag list instead of leaves, that's a regression.
- **Playground existing decompose flow.** The new agent-routing pane is an addition; the existing tree view + drill-down + structure-respect toggle must still work unchanged.
- **`renderAt` and depth control.** `compile()` reuses depth-walking logic; ensure no shared helper got mutated in a way that breaks `renderAt` callers.
- **Bundle size of `context-compiler`.** Voyage adapter is a new transitive dep; confirm `core` itself didn't gain it (dependency-direction invariant).
- **`@tier-reader/core` browser-safe `./render` subpath export.** Adding tag/entity types must not pull `node:crypto` or other Node-only modules into the browser-safe slice.
