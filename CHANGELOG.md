# Changelog

User-visible changes per phase. Newest first.

## 2026-05-04 — Phase 1: Engine core (small-tier decomposition)

- pnpm + Turborepo workspace with Biome, Vitest, and TypeScript on Node 22.
- `@tier-reader/core` package: schema types, one-shot `decompose()` for small inputs, `renderAt()` helper.
- Provider layer: Vercel AI SDK adapter (Anthropic, default `claude-haiku-4-5-20251001`) and BYO `{ call(prompt) }` escape hatch, both routed through env-gated Langfuse tracing.
- Five test fixtures (Wikipedia paragraph, AI chat answer, technical doc, short essay, list-heavy) with snapshot tests, structural-validity assertions, and source-reconstruction checks via a `MockProvider`.
- Finite-depth Raw schema (depth 4) so AI SDK produces a concrete JSON Schema for structured output instead of falling back to `any`.
- `examples/decompose-cli.ts` — pipe text into stdin, get a printed tree.
