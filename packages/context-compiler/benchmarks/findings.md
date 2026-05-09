# Benchmark findings — context-compiler v0.1

> **Status:** harness scaffolded; dataset is AI-generated subset only. Public-dump
> + author-history entries land in Pass B alongside the real `pnpm bench` run.
> All numbers in this document are placeholders until that run completes.

## Setup

- **Models:** Haiku 4.5 (`claude-haiku-4-5-20251001`) for agents; Sonnet 4.6
  (`claude-sonnet-4-6-20251022`) as judge.
- **Embedder:** Voyage `voyage-3-lite`, content-hash cached at
  `benchmarks/.cache/embed.json`.
- **Per-agent token budget for tier-* conditions:** `BENCH_BUDGET` env (default
  500 tokens).

## Conditions

| id | description |
|---|---|
| `flat-broadcast` | Full source message → every agent. |
| `dacs-focus` | Highest-similarity agent gets full message; others get a Sonnet-generated 200-token summary. |
| `tier-hybrid` | Hybrid `route()` (filter + similarity) → `compile()` per agent. |
| `tier-filter-only` | Tag/entity filter only, no embeddings. |
| `tier-embed-only` | Embedding rank only, no tag/entity filter. |

## Dataset

- AI-generated edge cases (7): see `dataset.ts` `AI_GENERATED_ENTRIES`.
- Public-dump entries: **TODO Pass B.**
- Author-history entries: **TODO Pass B.**
- DACS coverage check: **TODO Pass B** — pending paper link.

All AI-generated entries are flagged via `synthetic: true` for transparency.

## Success-signal table

> Filled in by Pass B from `results.json`.

| roster N | condition | mean steering (0–5) | mean output quality (0–5) | mean input tokens / agent | wins vs flat | wins vs DACS |
|---|---|---|---|---|---|---|
| 3 | flat-broadcast | _TBD_ | _TBD_ | _TBD_ | — | — |
| 3 | dacs-focus | _TBD_ | _TBD_ | _TBD_ | _TBD_ | — |
| 3 | tier-hybrid | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 3 | tier-filter-only | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 3 | tier-embed-only | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 5 | … | … | … | … | … | … |
| 10 | … | … | … | … | … | … |

## Observed wins / losses

_Pass B fills in._

## Threats to validity

- **Synthetic dataset bias.** AI-generated entries reflect what we *expected* to
  be hard, not necessarily what is hard in the wild. Mitigated by mixing with
  public chat dumps and anonymized author history (Pass B).
- **Single judge model.** Sonnet 4.6 evaluates both steering and output quality;
  shared model means correlated errors. Re-running the judge with a second
  family (e.g., GPT-4-class) is a Phase 4 follow-up.
- **Embedding-cache contamination across runs.** The cache key is
  `(model, sha256(text))`, so changes to system prompts or agent descriptions
  do not invalidate cached title embeddings — fine for v1 since the cached
  values are inputs, not outputs of those prompts.
- **Roster-subset structure.** N=3 ⊂ N=5 ⊂ N=10. Cross-N comparisons assume
  smaller rosters genuinely lack the dropped specialists; if the larger roster
  introduces near-duplicate agents, hybrid routing might split signal between
  them. Surfaced in cell-level inspection.
- **DACS focus heuristic.** Picking the focus agent by highest cosine similarity
  is one reasonable interpretation of DACS; the original paper uses a separate
  classifier. Documented so readers can reproduce or argue.
