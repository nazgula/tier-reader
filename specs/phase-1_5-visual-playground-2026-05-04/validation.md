# Phase 1.5 — Validation

## Manual checks

1. From repo root: `pnpm install` clean; lockfile updated to include `apps/playground` deps.
2. `cp` or write `apps/playground/.env.local` with `ANTHROPIC_API_KEY=...`.
3. `pnpm --filter @tier-reader/playground dev` starts Vite without errors and prints a localhost URL.
4. Open the URL: fixture `<select>` shows all 5 fixtures from `packages/core/test/fixtures/`.
5. Pick `wikipedia-paragraph.txt`; click "Decompose" with the "respect source structure" checkbox **off**; tree pane populates within ~10s; the three view-mode buttons (Discovery / Overview / Full) change the default expansion; clicking any title toggles that node; raw JSON pane (when expanded) shows a valid `Tree` shape.
6. Tick the "respect source structure" checkbox and decompose `wikipedia-paragraph.txt` (3 paragraphs). The tree's top level should have exactly three subtrees, one per source paragraph. No paragraph appears split across siblings at the same level.
7. Decompose with the checkbox **off** on the same input: behavior matches Phase 1 (the over-divided shape we already saw).
8. Network tab: `POST /api/decompose` request body includes `respectStructure` when ticked. Browser never sends `ANTHROPIC_API_KEY`.
9. Stop the dev server with no `ANTHROPIC_API_KEY` set; `POST /api/decompose` returns a clean 4xx with a readable error message.

## Automated checks

- `pnpm test` — Vitest green across all packages **without refreshing snapshots**. The new `respectStructure` opt defaults to `false`, so existing fixture canned outputs remain valid. `prompt.test.ts` covers the opt's wiring (clause present iff `respectStructure: true`).
- `pnpm typecheck` — `tsc --noEmit` clean for `core` and `playground`.
- `pnpm lint` — Biome clean (including new `apps/playground/` files).
- `pnpm build` — Turborepo builds all packages; `apps/playground` runs `vite build` cleanly.

## Regression watch

- `@tier-reader/core` snapshot tests: re-confirm structural-validity assertions still pass after prompt changes (id format, parent/child consistency, leaf-only `detail`, source reconstruction). The risk is that a tightened prompt drops content or restructures in ways that break source-reconstruction tolerance.
- `examples/decompose-cli.ts` from phase 1: still runs end-to-end on each fixture, prints a tree.
- `tier-reader.jsx` at repo root: untouched; confirm it's not picked up by the playground app's globs or by `pnpm` workspaces.
