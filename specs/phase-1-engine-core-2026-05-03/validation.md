# Phase 1 — Validation

## Manual checks

1. From repo root: `pnpm install` → no errors, single lockfile written.
2. `node --version` reports 22.x (or `nvm use` picks up `.nvmrc`).
3. With `ANTHROPIC_API_KEY` set: `pnpm tsx examples/decompose-cli.ts < packages/core/test/fixtures/wikipedia-paragraph.txt` prints an indented tree where:
   - Top-level titles read as info-dense one-liners (~12 words).
   - Leaf detail, when concatenated in tree order, reproduces the input (whitespace-tolerant).
   - Structure feels right: 3–7 children per level, depth ≤ 3 unless content warrants.
4. Repeat for each of the 5 fixtures; eyeball that all produce useful trees.
5. With `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` set: a CLI run shows a trace in the Langfuse dashboard with the prompt + structured output recorded.
6. Without Langfuse env vars: CLI still works, no errors thrown.
7. BYO provider: tiny script importing `decompose` with a `{ call: async () => '<canned JSON>' }` provider returns a Tree without touching the network.

## Automated checks

- `pnpm test` (Vitest):
  - Snapshot tests on the 5 fixtures via `MockProvider`, all pass.
  - Structural-validity tests pass: id format `^\d+(\.\d+)*$`, `parentId` consistency, `hasChildren ↔ childIds.length > 0`, leaf-only `detail`, source-reconstruction within whitespace tolerance.
  - `renderAt` unit tests: depth 0 returns root only, depth N returns subtree to N, `showDetail` set only on leaves at the boundary.
- `pnpm typecheck` — `tsc --noEmit` clean for all packages.
- `pnpm lint` — Biome clean.
- `pnpm build` — Turborepo builds all packages without error.

## Reconciliation (added at finish-phase)

- A live `decompose()` call against the AI SDK provider must not emit "Recursive reference detected" warnings. The Raw schema is unrolled to a finite depth (MAX_SCHEMA_DEPTH = 4) so AI SDK produces a concrete JSON Schema for the model.
- BYO provider must accept structured-output responses wrapped in markdown code fences (```json ... ```), not only bare JSON.

## Regression watch

Greenfield phase — nothing to regress. The only pre-existing artifact is `tier-reader.jsx` at the repo root; verify it remains untouched and is not picked up by the `pnpm`/Turborepo workspace globs (it's outside `packages/`, `apps/`, `examples/`).
