# Phase 1.5 — Validation

## Manual checks

1. From repo root: `pnpm install` clean; lockfile updated to include `apps/playground` deps.
2. `cp` or write `apps/playground/.env.local` with `ANTHROPIC_API_KEY=...`.
3. `pnpm --filter @tier-reader/playground dev` starts Vite without errors and prints a localhost URL.
4. Open the URL: fixture `<select>` shows all 5 fixtures from `packages/core/test/fixtures/`.
5. Pick `wikipedia-paragraph.txt`; click "Decompose"; tree pane populates within ~10s; depth slider expands/collapses sub-trees; raw JSON pane (when expanded) shows a valid `Tree` shape.
6. Repeat for the other 4 fixtures + 1 ad-hoc paste-in. For each, eyeball the rendered tree and confirm none of the three known issues appear:
   - **Redundant nesting:** no node has exactly one child whose title paraphrases the parent.
   - **Parent/child paraphrase:** no parent title is a near-restatement of any of its children's titles.
   - **Over-division of "X but Y":** a single contrast/concession sentence remains a single leaf, not two siblings.
7. Network tab: `POST /api/decompose` request body contains the input; response is the `Tree`. Browser never sends `ANTHROPIC_API_KEY`.
8. Stop the dev server with no `ANTHROPIC_API_KEY` set; `POST /api/decompose` returns a clean 4xx with a readable error message.

## Automated checks

- `pnpm test` — Vitest green across all packages with refreshed `MockProvider` canned outputs.
- `pnpm typecheck` — `tsc --noEmit` clean for `core` and `playground`.
- `pnpm lint` — Biome clean (including new `apps/playground/` files).
- `pnpm build` — Turborepo builds all packages; `apps/playground` is dev-only, so `build` either no-ops or runs `vite build` cleanly without breaking the pipeline.

## Regression watch

- `@tier-reader/core` snapshot tests: re-confirm structural-validity assertions still pass after prompt changes (id format, parent/child consistency, leaf-only `detail`, source reconstruction). The risk is that a tightened prompt drops content or restructures in ways that break source-reconstruction tolerance.
- `examples/decompose-cli.ts` from phase 1: still runs end-to-end on each fixture, prints a tree.
- `tier-reader.jsx` at repo root: untouched; confirm it's not picked up by the playground app's globs or by `pnpm` workspaces.
