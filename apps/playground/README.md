# `@tier-reader/playground`

Local Vite + React app for iterating the decompose prompt with visual feedback. Dev-only; not shipped.

## Run

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > apps/playground/.env.local
pnpm install
pnpm --filter @tier-reader/playground dev
```

The browser opens at `http://localhost:5173`. The API key stays in `process.env` on the Vite Node process — it never reaches the browser.

## How it's wired

- `vite.config.ts` registers a custom plugin (`server/decompose-route.ts`) that adds two middlewares:
  - `GET /api/fixtures` → list of fixture filenames; `GET /api/fixtures/:name` → fixture text. Reads from `packages/core/test/fixtures/`.
  - `POST /api/decompose` → calls `decompose()` from `@tier-reader/core` server-side and returns the `Tree`.
- `src/App.tsx` is a three-pane layout: input + fixture picker, depth-sliced tree view via `renderAt`, raw JSON.

## Notes

- This app is not part of the shipped topology. `pnpm build` runs `vite build` so the Turborepo pipeline stays green, but no one consumes the output.
- `tier-reader.jsx` at the repo root is unrelated — that's a phase-5-bound prototype, not the playground.
