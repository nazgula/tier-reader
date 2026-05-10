# Benchmark findings — context-compiler v0.1

> **Status:** harness scaffolded; dataset has 7 AI-generated + 1 author-history
> single-turn entry, plus 1 multi-turn schema-stub entry. Public-dump entries
> and the real `pnpm bench` run land in subsequent passes. All numbers in this
> document are placeholders until that run completes.
>
> **≥20-entry floor not yet met.** Current count is 9 entries (8 single-turn +
> 1 multi-turn). This is intentional for this commit — see "Deferred" below.
> The floor is reachable once public-dump entries land and additional
> author-history candidates are translated from Hebrew.

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
- Author-history entries (1): `AUTHOR_HISTORY_ENTRIES`. Single-turn 3+-agent
  fan-out from real chat history; verbatim user message with no third-party
  named entities present.
- Public-dump entries: **Deferred.** ShareGPT / LMSYS-Chat-1M / WildChat
  pulls require dataset-viewer fetches with proper per-entry citation;
  scoped as its own follow-up task rather than rushed inline.
- DACS coverage check: **Deferred** — pending paper link + author-history
  expansion (currently too few entries to gap-fill against).

All AI-generated entries are flagged via `synthetic: true` for transparency.

### Multi-turn sub-suite (schema stub)

`MULTI_TURN_ENTRIES` defines a separate evaluation track that measures
**cross-turn context propagation** — whether the routing system carries
forward facts established in earlier turns when a later turn is routed.
The benchmark-relevant signal: a router that re-decomposes the running tree
each turn (tier-hybrid) preserves earlier facts; a flat-broadcast or
DACS-focus baseline that only sees the latest message will miss them.

Currently authored: 1 entry (`author-supercut-architecture-arc`) with two
evaluation points (turn 0 — initial 5-agent fan-out; turn 2 — knowledge-base
ask that requires turn-0 architecture facts to answer correctly).

**Harness wiring is deferred.** `run.ts` does not yet route multi-turn
entries; it skips them. The schema is in place so the design is reviewable
and additional entries can be authored without further plumbing churn.

### Anonymization

The single included author entry contains no third-party personal names in
its verbatim text and required no substitutions. The mapping defined for
future entries is:

- People: Achiya → VendorA-Person; any other named individuals → Person1, Person2…
- Israeli automation vendors: STSICONIC → VendorB; Whale Group → VendorC;
  Automotion → VendorD; Digital Beats AI → VendorE; Bllink → VendorF.
- Lawtech: LawForce → LawTechA; Yodfat → LawTechB; Commit → LawTechC;
  Cligal → LawTechD.
- Clinic-software: Easybizy → ClinicSoftA; Medform → ClinicSoftB;
  Tor4You → ClinicSoftC; T'fulit → ClinicSoftD.
- Invoice-software: WellyBox → InvoiceSoftA; iCount → InvoiceSoftB;
  Morning → InvoiceSoftC; Sumit → InvoiceSoftD.
- Other: Midrag → FreelancerPlatform; Guesty → GlobalAirbnbSaaS.

Names retained verbatim (project author's own): Maria, Noa, Kith,
Super-Cut, BringUp.

### Deferred — explicit gap list

1. **Public-dump entries.** Need real per-entry citations from ShareGPT /
   LMSYS-Chat-1M / WildChat. Network/fetch task.
2. **Hebrew author conversations.** The strongest cross-turn-propagation
   candidate (the BringUp building-management-software evaluation, 5 turns
   spanning pre-meeting → post-meeting → value verdict) is in Hebrew and
   currently skipped. Needs translation pass + Hebrew-judge feasibility
   confirmation.
3. **Multi-turn harness wiring in `run.ts`.** Per-turn route + per-evaluation
   propagation judge. Schema is ready; `runner.ts` integration is the next
   step.
4. **DACS coverage check.** Needs the paper's archetype list cross-referenced
   against final dataset once it has volume.
5. **Reaching the ≥20 entry floor.** Resolved once 1+2 land.

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
