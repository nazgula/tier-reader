# Phase 1.5 — Plan

Status: 1 [x], 2 [x], 3 [x], 4 [x], 5 [—]

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

## 4. [x] `respectStructure` opt + UI checkbox

- Add `respectStructure?: boolean` to `DecomposeOpts` in `core/src/decompose.ts` (default `false`).
- Extend `buildDecomposePrompt` in `core/src/prompt.ts` with a clause that, when on, instructs the model to honor source structural units (paragraphs, heading-marked sections, lists) and lets the 3–6 top-level floor yield to structure.
- Thread the flag through `apps/playground/server/decompose-route.ts` and `apps/playground/src/api.ts`.
- Add a checkbox to the playground UI; default off.
- No snapshot refresh — existing fixture snapshots assume `respectStructure: false` (the default), so they stay valid.

## 5. [—] Deeper prompt iteration — perpetual

Reframed as perpetual work, not phase-bound. Future commits to `core/src/prompt.ts` address parent/child paraphrase, over-division of cohesive "X but Y," and any structure-respect edge cases that surface during further testing. Engine is decoupled from downstream consumers via the locked `Tree` schema, so prompt evolution doesn't ripple. The playground (now landed) is the iteration tool.

## Architecture impact

- §3 Repo layout: `apps/playground/` was already drawn as "optional, hosts current tier-reader.jsx during phases 1–4" — `/finish-phase` should rewrite that note to reflect the new reality (Vite + React app wrapping `decompose()` for prompt iteration; `tier-reader.jsx` still at repo root, untouched).
- §1 / §2 / Invariants: no change. The playground depends only on `core`, doesn't introduce new persistent state, and its `/api/decompose` route is dev-only (not part of the shipped topology).
- New invariant candidate (mention at finish-phase if it survives the phase): the playground's API key never reaches the browser — all model calls happen server-side in the Vite Node process.
