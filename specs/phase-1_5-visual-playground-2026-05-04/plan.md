# Phase 1.5 — Plan

Status: 1 [x], 2 [x], 3 [x], 4 [ ], 5 [ ]

## 1. [x] `apps/playground/` workspace scaffold

- `apps/playground/package.json` — name `@tier-reader/playground`, private, type module. Deps: `react`, `react-dom`, `@tier-reader/core` (workspace), `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`.
- `apps/playground/vite.config.ts` — React plugin + a small custom plugin that registers the `/api/decompose` middleware (group 2).
- `apps/playground/tsconfig.json` — extends `tsconfig.base.json`; DOM lib enabled.
- `apps/playground/index.html` + `src/main.tsx` + `src/App.tsx` skeleton.
- `pnpm-workspace.yaml` already covers `apps/*` — verify and run `pnpm install`.
- Root `package.json` script: `pnpm dev:playground` → `pnpm --filter @tier-reader/playground dev`.

## 2. [x] `/api/decompose` Vite middleware

- `apps/playground/server/decompose-route.ts` — accepts `POST` with JSON `{ input: string, opts?: {...} }`, calls `decompose()` from `@tier-reader/core` using the AI SDK provider with `ANTHROPIC_API_KEY` from `process.env`, returns the `Tree` JSON. 4xx on missing key / bad input; 5xx with error text on provider failure.
- Wired into Vite via `configureServer(server) { server.middlewares.use('/api/decompose', handler) }` in `vite.config.ts`.
- Loads `.env.local` via Vite's built-in env loading; document this in `apps/playground/README.md` (one short file, since this lives behind a private app).
- A second `GET /api/fixtures` route returns the list of fixture filenames from `packages/core/test/fixtures/` (resolved via `import.meta.url`) so the UI fixture picker doesn't hardcode paths.
- `GET /api/fixtures/:name` returns the raw fixture text.

## 3. [x] Playground UI

- `src/App.tsx` — single-page layout with three regions:
  - **Input pane (left):** fixture `<select>` populated from `/api/fixtures`, `<textarea>` bound to its content, "Decompose" button, status text.
  - **Tree pane (center):** renders `RenderPlan` from `renderAt(tree, '0', depth)`. Indent by `indent`; show `title`; show `detail` when `showDetail` is true. Depth `<input type="range" min="0" max="6">` above it, showing the current value.
  - **Raw JSON pane (right):** `<details>` collapsible, contains `JSON.stringify(tree, null, 2)` in a `<pre>`.
- `src/api.ts` — typed `fetchDecompose(input)` and `fetchFixtures()` / `fetchFixture(name)` helpers.
- Minimal styling — handwritten CSS module or inline styles. No UI library; portfolio bar here is "works for me + screenshots cleanly," nothing more.

## 4. [ ] Prompt iteration on the three known issues

- Capture a baseline: run all 5 fixtures + 1–2 ad-hoc inputs (Wikipedia "Matter" lead paragraph, an AI-chat answer with an explicit "X but Y" pivot) through the playground; note where each of the three issues fires.
- Iterate `packages/core/src/prompt.ts` (and decompose call options if needed) — likely additions: explicit "do not paraphrase the parent in a single child," "do not split contrast/concession statements that share a single claim," "if a node has only one child, fold it into the parent." Keep diff in `prompt.ts` only; no schema change unless absolutely required.
- After each edit, re-run the same fixtures in the playground; iterate until manual eyeball shows none of the three patterns on the 5 fixtures + ad-hoc inputs.
- Keep a short log inline in `requirements.md`'s "Open questions" if anything surprising surfaces (e.g. a schema tweak that turned out necessary).

## 5. [ ] Lock prompt + refresh `MockProvider` canned outputs

- With the new prompt locked in, run `RUN_LIVE=1 pnpm --filter @tier-reader/core test --testNamePattern=live` (or the equivalent of phase 1's live-refresh path) to regenerate canned outputs for the 5 fixtures.
- Update snapshots: `pnpm --filter @tier-reader/core test -u`.
- Re-run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` — all green.
- Spot-check the snapshot diff: titles changed in expected ways, structure obeys the new constraints.

## Architecture impact

- §3 Repo layout: `apps/playground/` was already drawn as "optional, hosts current tier-reader.jsx during phases 1–4" — `/finish-phase` should rewrite that note to reflect the new reality (Vite + React app wrapping `decompose()` for prompt iteration; `tier-reader.jsx` still at repo root, untouched).
- §1 / §2 / Invariants: no change. The playground depends only on `core`, doesn't introduce new persistent state, and its `/api/decompose` route is dev-only (not part of the shipped topology).
- New invariant candidate (mention at finish-phase if it survives the phase): the playground's API key never reaches the browser — all model calls happen server-side in the Vite Node process.
