# Phase 1.5 — Visual playground + prompt-quality iteration

## Why

Phase 1's live runs surfaced three recurring decompose-prompt failure modes (redundant nesting, parent/child paraphrase, over-division of cohesive "X but Y" statements) that didn't yield to blind prompt edits. We need a visual playground so iteration has fast feedback, and we need to use it to retire those three issues before phase 2 builds the medium/large strategies on top of the same prompt.

## In scope

- New workspace app `apps/playground/` — local Vite + React + TS; depends on `@tier-reader/core`.
- Vite dev-server middleware exposing `POST /api/decompose`. Handler runs server-side (Node), reads `ANTHROPIC_API_KEY` from `process.env`, calls `core`'s AI SDK provider, returns the `Tree`.
- UI surface:
  - Input textarea, plus a fixture picker that loads any of the 5 existing fixtures from `packages/core/test/fixtures/`.
  - "Decompose" button → calls `/api/decompose`.
  - Depth slider driving `renderAt(tree, rootId, depth)`; tree view rendered from the resulting `RenderPlan`.
  - Raw `Tree` JSON pane (collapsed by default).
- Use the playground to iterate the decompose prompt against the 5 fixtures + ad-hoc inputs until the three known issues no longer reproduce, judged by manual eyeball.
- Lock the improved prompt back into `@tier-reader/core` and refresh the `MockProvider` canned outputs so existing Vitest snapshot + structural-validity tests stay green.

## Out of scope

- Hosting / deploy; the playground is dev-only (`pnpm --filter playground dev`).
- BYOK in the browser — key stays in `process.env` on the dev server side. No localStorage / no UI key field.
- Automated assertions for the three prompt-quality issues (manual sign-off bar).
- Schema version bump (still `1`); only additive prompt-side fixes and at most non-breaking schema tweaks if iteration demands them.
- Migrating `tier-reader.jsx` into the playground — that's still phase 5's call. The new playground is a different app with a different purpose.
- `detectTier`, medium/large strategies, `route`/`compile`, React renderer package, extension — all later phases.

## Success signal

`pnpm --filter playground dev` opens a UI where pasting (or picking) any of the 5 fixtures and clicking "Decompose" produces a tree-view that, on manual eyeball, no longer exhibits redundant nesting, parent/child paraphrase, or over-division of cohesive "X but Y" statements. `pnpm test` is still green with the refreshed `MockProvider` canned outputs.

## Open questions resolved this phase

None — Step 1a found no `[phase 1.5]` items on mission/tech-stack/architecture. Phase 1's parking-lot entry ("Decompose prompt + tier-structure quality iteration") is the driver but isn't a constitution open question.

## Open questions

- None blocking. If iteration reveals a structural fix that needs a schema change beyond cosmetic, we surface it here at finish-phase rather than silently bumping schema version.
