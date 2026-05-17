/**
 * Benchmark dataset.
 *
 * Domain mix is deliberate (not coding-only) per phase 3 spec:
 *   - dev/coding
 *   - organizational comms (memos, multi-stakeholder briefs)
 *   - customer-support (tickets that span specialist queues)
 *   - research-assistant (multi-step subtasks)
 *
 * Source mix targets ≥20 total entries:
 *   - ~6–8 from public chat dumps (ShareGPT / LMSYS-Chat-1M / WildChat) — TODO Pass B
 *   - ~6–8 anonymized from author chat history — TODO Pass B
 *   - ~6–8 AI-generated edge cases — present below
 *
 * All AI-generated entries are flagged via `synthetic: true` so findings.md
 * can call out source-mix transparency.
 */

export type Domain = "dev" | "org-comms" | "customer-support" | "research";

export interface ExpectedTask {
  agentId: string;
  expectedTask: string;
}

export interface DatasetEntry {
  id: string;
  text: string;
  /** Provenance + citation for non-synthetic entries. */
  source: string;
  /** True when AI-generated; called out in findings.md. */
  synthetic: boolean;
  domain: Domain;
  /** Agent ids expected to receive a non-empty slice. */
  expectedAgents: string[];
  /**
   * Per-agent expected outcome — fed to the output-quality judge.
   * Only entries for `expectedAgents` are required; others are optional.
   */
  expectedTasks: ExpectedTask[];
}

const AI: Pick<DatasetEntry, "synthetic" | "source"> = {
  synthetic: true,
  source: "ai-generated",
};

export const AI_GENERATED_ENTRIES: DatasetEntry[] = [
  {
    ...AI,
    id: "ai-fan-out-3-domains",
    domain: "dev",
    text: [
      "Three things stacked up today and they're all blocking different folks.",
      "",
      "First, the checkout page on mobile is rendering the price summary twice — looks like a duplicate render after the cart context updates. The Lighthouse score also dropped 14 points on that route since Friday's deploy. I want a fix and a regression note.",
      "",
      "Second, we need a new POST /v1/refunds endpoint on the API. Inputs: order_id, reason_code, amount_cents (optional partial). It should idempotency-key off (order_id, reason_code) and emit refund.created. Auth is the same scoped service token we use for /charges.",
      "",
      "Third, support is fielding a wave of confused tickets about why partial refunds don't show up immediately. Can you draft a help-center FAQ entry explaining the eventual-consistency window (up to 30 minutes) and link it from the refund-status email template?",
    ].join("\n"),
    expectedAgents: ["frontend-ui", "backend-api", "customer-support"],
    expectedTasks: [
      {
        agentId: "frontend-ui",
        expectedTask:
          "Diagnose the duplicate price summary render on mobile checkout, propose a fix, and acknowledge the Lighthouse regression.",
      },
      {
        agentId: "backend-api",
        expectedTask:
          "Specify and stub the POST /v1/refunds endpoint with idempotency key and refund.created event emission.",
      },
      {
        agentId: "customer-support",
        expectedTask:
          "Draft a help-center FAQ explaining the partial-refund eventual-consistency window and reference linking it from the refund-status email.",
      },
    ],
  },

  {
    ...AI,
    id: "ai-ambiguous-routing",
    domain: "customer-support",
    text: [
      "Customer reports that clicking the refund button on order #88241 returns them to the orders list with no confirmation, no toast, no email. The order in Stripe shows captured but no refund attempt. They've tried twice. They're a Pro-tier account and threatening to churn.",
      "",
      "I need: (a) a check on whether the refund button actually fires the API request — there may be a frontend regression — (b) confirmation that the backend would accept the call if it did arrive, including auth scope and any guardrails on amount, and (c) an outreach response to the customer that doesn't promise more than we know.",
    ].join("\n"),
    expectedAgents: ["frontend-ui", "backend-api", "customer-support"],
    expectedTasks: [
      {
        agentId: "frontend-ui",
        expectedTask:
          "Investigate whether the refund button click actually dispatches the API request, and identify the regression if not.",
      },
      {
        agentId: "backend-api",
        expectedTask:
          "Verify that the refund endpoint would accept this call given current auth scope and amount guardrails.",
      },
      {
        agentId: "customer-support",
        expectedTask:
          "Draft an outreach message to the Pro-tier customer that acknowledges the issue without overpromising.",
      },
    ],
  },

  {
    ...AI,
    id: "ai-topic-shift-org-memo",
    domain: "org-comms",
    text: [
      "Q3 wrap and a couple of forward-looking items, all in one memo so I don't fragment your inboxes.",
      "",
      "On Q3 OKRs: we hit 3 of 5 — activation lift cleared the bar, latency P99 came in under SLO, and the migration off the legacy queue finished a sprint early. We missed on enterprise pipeline (61% of target) and on the partner-integrations rollout (slipped to Q4). The pipeline miss is mostly a sales-staffing gap, not a product gap.",
      "",
      "On hiring: we have headcount for two senior backend engineers and one staff data engineer in Q4. Hiring manager for the data role rotates from Priya to Marco. JDs are being refreshed this week.",
      "",
      "On comp: the band update lands in workday on the 15th. Mid-cycle adjustments will be communicated 1:1 by managers between the 15th and the 22nd. Equity refresh remains on the standard annual cycle in March.",
    ].join("\n"),
    expectedAgents: ["product-pm", "research-writing", "ops-oncall"],
    expectedTasks: [
      {
        agentId: "product-pm",
        expectedTask:
          "Summarize the Q3 OKR results — wins, misses, and the diagnosis on the enterprise-pipeline miss being staffing-driven.",
      },
      {
        agentId: "research-writing",
        expectedTask:
          "Capture the hiring section: headcount allocations, hiring-manager rotation for the data role, and JD refresh timeline.",
      },
      {
        agentId: "ops-oncall",
        expectedTask:
          "Note the comp-band rollout timing and 1:1 communication window so on-call/rotation handoffs reference it correctly.",
      },
    ],
  },

  {
    ...AI,
    id: "ai-single-topic-control",
    domain: "research",
    text: [
      "I'm trying to understand the difference between cosine similarity and dot product for ranking embedding-space neighbors when the embedding model is L2-normalized at output. My intuition is that they collapse to the same ranking under L2 normalization but I keep tripping over edge cases. Can you walk through the math, give me a concrete numeric example where the two diverge in the un-normalized case, and confirm what voyage-3-lite does at output (normalized or not)?",
    ].join("\n"),
    expectedAgents: ["research-writing"],
    expectedTasks: [
      {
        agentId: "research-writing",
        expectedTask:
          "Walk through the math relating cosine similarity to dot product, give a numeric divergence example for un-normalized vectors, and answer the voyage-3-lite normalization question (acknowledging if it requires lookup).",
      },
    ],
  },

  {
    ...AI,
    id: "ai-nested-auth-rewrite",
    domain: "dev",
    text: [
      "Auth rewrite kickoff. Capturing the surface area before we scope sprints.",
      "",
      "Token storage: legacy stored bearer tokens in postgres in plaintext under sessions.token. We need encryption at rest plus rotation. Decision: KMS-backed envelope encryption, rotation cadence 90 days. Need a backfill plan that doesn't invalidate live sessions.",
      "",
      "Session UX: current flow forces a full re-auth on every browser restart. Spec says we move to refresh-token-on-demand with a 30-day idle window. Sign-out must purge both tokens and any cached profile data on the client.",
      "",
      "Audit logging: every grant, refresh, and revoke event lands in the audit table with actor, ip, and a deterministic event id we can replay. The replay tool is out of scope here but the schema must support it.",
      "",
      "On-call: paging policy needs an update because auth incidents currently route to backend-general which is the wrong queue. New policy: auth-on-call rotation, page on >5 grant failures/min for any single tenant.",
    ].join("\n"),
    expectedAgents: ["backend-api", "security", "frontend-ui", "ops-oncall"],
    expectedTasks: [
      {
        agentId: "backend-api",
        expectedTask:
          "Specify the token-storage encryption scheme (KMS envelope, 90-day rotation) and backfill plan that preserves live sessions.",
      },
      {
        agentId: "security",
        expectedTask:
          "Define the audit logging schema covering grant/refresh/revoke with actor, ip, and replay-friendly event ids.",
      },
      {
        agentId: "frontend-ui",
        expectedTask:
          "Implement the refresh-token-on-demand UX with a 30-day idle window and ensure sign-out purges client tokens + cached profile data.",
      },
      {
        agentId: "ops-oncall",
        expectedTask:
          "Update the on-call routing so auth incidents page the auth rotation, with the >5 grant-failures/min/tenant trigger.",
      },
    ],
  },

  {
    ...AI,
    id: "ai-tiny-plus-large",
    domain: "customer-support",
    text: [
      "Two unrelated things — feel free to handle them separately.",
      "",
      "Quick one: bump the help-center copy on /docs/billing/refunds to mention that ACH refunds settle in 5–7 business days, not the 3 we currently say.",
      "",
      "Bigger one: ticket #44119 is a payment dispute on a recurring subscription that auto-renewed after the customer cancelled. The cancellation was logged in our system on the 14th but the renewal billed on the 17th, so something in the cancellation pipeline didn't propagate to the billing scheduler. Customer is demanding a full refund plus the previous month's charge as goodwill. The previous month was a normal renewal pre-cancellation, so I don't think the previous month is justified, but I want to send something that resolves this without escalating. Need: (a) a root-cause guess on why the cancellation didn't propagate (we've seen this twice this quarter), (b) a proposed refund posture, and (c) the actual customer-facing reply.",
    ].join("\n"),
    expectedAgents: ["customer-support", "backend-api"],
    expectedTasks: [
      {
        agentId: "customer-support",
        expectedTask:
          "Update the help-center refund copy to 5–7 business days for ACH and produce a customer-facing reply that resolves ticket #44119 without escalating, with a clear refund posture.",
      },
      {
        agentId: "backend-api",
        expectedTask:
          "Diagnose why a cancellation logged on the 14th failed to propagate to the billing scheduler before the 17th renewal, given this is a recurring failure.",
      },
    ],
  },

  {
    ...AI,
    id: "ai-vendor-comparison",
    domain: "research",
    text: [
      "Need a quick vendor evaluation for the new compliance-monitoring tool. Three candidates: Vanta, Drata, Secureframe.",
      "",
      "Cover three angles. Pricing: list price for ~50 employees, what's bundled vs add-on, multi-year discount norms. Technical: AWS + GCP coverage parity, GitHub-org-level evidence collection, support for our existing Okta SSO + SCIM, depth of integration with our backend (we're on a custom Node stack, not Rails). Legal/compliance: scope of frameworks supported (SOC2 Type 2 + ISO 27001 + HIPAA), data-residency commitments, BAA availability, audit-log export retention.",
      "",
      "Don't recommend a winner yet — I want a side-by-side I can take into the steerco. Flag any deal-breakers per vendor.",
    ].join("\n"),
    expectedAgents: ["research-writing", "compliance-kyc", "security"],
    expectedTasks: [
      {
        agentId: "research-writing",
        expectedTask:
          "Produce a side-by-side pricing/technical/legal comparison of Vanta, Drata, and Secureframe at ~50 employees, flagging deal-breakers without picking a winner.",
      },
      {
        agentId: "compliance-kyc",
        expectedTask:
          "Cover the framework-scope (SOC2 Type 2, ISO 27001, HIPAA) and BAA / data-residency dimensions for each vendor.",
      },
      {
        agentId: "security",
        expectedTask:
          "Cover the technical-integration dimension: AWS+GCP parity, Okta SSO+SCIM, and depth of integration with a custom Node backend.",
      },
    ],
  },
  {
    ...AI,
    id: "ai-research-survey-multi-domain",
    domain: "research",
    text: [
      "I'm putting together an internal briefing on the state of multi-agent LLM coordination as of mid-2026. I need three things, and I'd like them organized:",
      "",
      "1. A literature survey of the major routing/orchestration frameworks (DACS, Anthropic Skills, AutoGen, MetaGPT, CrewAI, and any I'm missing) — what each does, how they differ from each other, and where they overlap. Cite the original paper or canonical doc per system.",
      "",
      "2. A comparative analysis: token cost per turn, routing accuracy from published benchmarks where available, and which scenarios each framework handles well versus badly.",
      "",
      "3. A recommendation — given a team that already has Claude Skills plus a small Python orchestrator in production, which of these frameworks (if any) is worth migrating to, and which should we explicitly avoid?",
    ].join("\n"),
    expectedAgents: ["research-writing", "data-analytics", "product-pm"],
    expectedTasks: [
      {
        agentId: "research-writing",
        expectedTask:
          "Produce the literature survey of multi-agent LLM coordination frameworks with one paragraph per system and a citation to the canonical paper or doc.",
      },
      {
        agentId: "data-analytics",
        expectedTask:
          "Build the comparative analysis (token cost per turn, published routing-accuracy numbers, scenario fit) into a structured table grounded in cited benchmark data.",
      },
      {
        agentId: "product-pm",
        expectedTask:
          "Make the migration recommendation given the team's existing Claude Skills + Python orchestrator stack: name a specific framework to adopt or skip, with rationale.",
      },
    ],
  },
  {
    ...AI,
    id: "ai-data-pipeline-multi-stakeholder",
    domain: "dev",
    text: [
      "We're moving the genomics-results ingestion pipeline off the legacy Hadoop cluster onto a managed setup. Three things are coupled and I need each owner to weigh in before we lock the design:",
      "",
      "The data side: source files are VCF + BAM in S3 (~40GB/day), output needs to land in BigQuery with a schema that matches the existing analytics dashboards. We can either parse on ingest or store raw + parse on query — pick one and explain why.",
      "",
      "The reliability side: the pipeline must be idempotent on re-runs (same VCF processed twice produces the same row count, no duplicates). Also need a dead-letter queue for malformed VCF headers — the current system silently drops them and we've been masking quality issues for months.",
      "",
      "The compliance side: VCF files contain de-identified patient data but the audit logger needs to record every read access at the file level. The current Hadoop setup logs at the directory level, which is failing our HIPAA review.",
    ].join("\n"),
    expectedAgents: ["data-analytics", "ops-oncall", "compliance-kyc"],
    expectedTasks: [
      {
        agentId: "data-analytics",
        expectedTask:
          "Decide parse-on-ingest vs. raw+parse-on-query for the VCF→BigQuery flow, with schema and performance rationale tied to the existing dashboard contract.",
      },
      {
        agentId: "ops-oncall",
        expectedTask:
          "Specify the idempotency contract and dead-letter queue handling so re-runs do not duplicate rows and malformed headers stop being silently dropped.",
      },
      {
        agentId: "compliance-kyc",
        expectedTask:
          "Specify file-level read-access audit logging that satisfies the HIPAA review the directory-level Hadoop logging is failing.",
      },
    ],
  },
];

/**
 * Author chat-history entries (anonymized).
 *
 * Selection bar: each entry must fan out to ≥3 distinct agents in `agents.ts`.
 * Source: real user messages from the project author's chat history. Names
 * mapped to neutral placeholders per the anonymization log in `findings.md`.
 * No third-party personal names appear in the verbatim text below.
 */
export const AUTHOR_HISTORY_ENTRIES: DatasetEntry[] = [
  {
    id: "author-vertical-brainstorm",
    source: "author-chat-history (2026-04-29)",
    synthetic: false,
    domain: "research",
    text: [
      "Suggest a few.",
      "",
      "I also wonder about places like restaurants — what helps them to track their pipeline (order, use, bills etc).",
      "",
      "Also thinking about building an agent for a fitness program a friend and I are developing — like a supporter for your goal, knows you, suggests diet-aware recipes, has the program's info etc. This is something we'll talk about more tomorrow (you can react in a few words — if it's been done a lot, or is it good), but I wonder if there could be more supporters in all sorts of situations you are willing to pay to have in the palm of your hand.",
      "",
      "I'm also thinking about another friend complaining about the tedious bureaucracy in getting permits for rebuilding their apartment in Tel Aviv — and changing the outline of the apartment (lots of documents and back-and-forth with the Municipal Building office). Maybe there are even more options.",
    ].join("\n"),
    expectedAgents: ["product-pm", "backend-api", "research-writing"],
    expectedTasks: [
      {
        agentId: "product-pm",
        expectedTask:
          "Triage the three product avenues (restaurant pipeline, personal-fitness agent, permit-bureaucracy assistant) and recommend which (if any) is worth pursuing, with one-line rationale per avenue.",
      },
      {
        agentId: "backend-api",
        expectedTask:
          "Sketch the technical shape of each avenue at a high level: integration surface for restaurant POS/billing, agent-state model for a fitness coach, and document-flow integrations needed for a Tel Aviv permit assistant.",
      },
      {
        agentId: "research-writing",
        expectedTask:
          "Indicate market-saturation status for each avenue (has this been done a lot or not), citing what's known vs. requires deeper research.",
      },
    ],
  },
  {
    id: "author-ai-automation-smb-research",
    source: "author-chat-history (2026-04-29, AI automation for Israeli SMBs — turn 0)",
    synthetic: false,
    domain: "research",
    // Verbatim from author chat. Personal-financial framing redacted to neutral
    // task framing per findings.md anonymization rules; routing signal (SMB-
    // targeting, AI tools, Israel 2026 market) preserved unchanged.
    text: [
      "I'm trying to find ways to generate income on my own.",
      "",
      "What can I do, using basic AI tools or automations, to generate easy-to-implement solutions for independent small-to-medium businesses in Israel 2026? Do good research and think hard.",
    ].join("\n"),
    expectedAgents: ["research-writing", "product-pm", "data-analytics", "backend-api"],
    expectedTasks: [
      {
        agentId: "research-writing",
        expectedTask:
          "Survey the Israel-2026 SMB market landscape: which forcing functions (regulatory, communication-channel saturation, language model maturity) make AI automations a real opening right now, with sources.",
      },
      {
        agentId: "product-pm",
        expectedTask:
          "Propose 2–3 productizable offer shapes (vertical, scope, packaging) ranked by speed-to-first-paying-client, each with a target customer and a one-line value claim.",
      },
      {
        agentId: "data-analytics",
        expectedTask:
          "Provide concrete pricing data for the existing Israeli SMB AI-automation market (setup cost, monthly retainer, typical ROI window) and tier the offerings by complexity.",
      },
      {
        agentId: "backend-api",
        expectedTask:
          "Sketch the technical shape of a representative offer (e.g., WhatsApp-front-desk bot): API surfaces, integrations (WhatsApp Cloud API, calendar, payment), and what 'easy to implement' actually buys at the architecture level.",
      },
    ],
  },
];

export const DATASET: DatasetEntry[] = [
  ...AI_GENERATED_ENTRIES,
  ...AUTHOR_HISTORY_ENTRIES,
];

// ---------------------------------------------------------------------------
// Multi-turn schema (sub-suite B — STUB ONLY in this commit).
//
// Goal: measure whether the routing system propagates facts established in
// earlier turns when a later turn is routed. The DACS-style "focus mode"
// baseline and the flat-broadcast baseline both have known propagation
// failure modes; tier-reader's hybrid route+compile is hypothesized to
// preserve cross-turn facts because the running tree accumulates them.
//
// Harness wiring is intentionally NOT in this commit. The dataset shape is
// defined here so the design is reviewable, and one representative entry
// is authored. The benchmark `run.ts` will gain multi-turn support in a
// follow-up group (tracked in findings.md "Deferred").
// ---------------------------------------------------------------------------

/** A single user turn in a multi-turn conversation. */
export interface ConversationTurn {
  /** 0-indexed position in the conversation. */
  turnIndex: number;
  /** The user message verbatim (anonymized per findings.md mapping). */
  text: string;
}

/** A measurement point: route + judge at a given turn, given turns 0..atTurn. */
export interface MultiTurnEvaluation {
  /** Which turn we route + judge. Turns 0..atTurn are visible to the system. */
  atTurn: number;
  /**
   * Facts from turns < atTurn that any agent's slice MUST contain to
   * answer the turn's task correctly. The propagation judge scores
   * coverage of these facts in the routed slice.
   */
  requiredPriorContext: string[];
  /** Agent ids expected to receive a non-empty slice at this evaluation. */
  expectedAgents: string[];
  /** Per-agent expected outcome — fed to the output-quality judge. */
  expectedTasks: ExpectedTask[];
}

export interface MultiTurnEntry {
  id: string;
  source: string;
  /** Multi-turn entries are not synthetic (they're real conversations). */
  synthetic: false;
  domain: Domain;
  turns: ConversationTurn[];
  evaluations: MultiTurnEvaluation[];
}

export const MULTI_TURN_ENTRIES: MultiTurnEntry[] = [
  {
    id: "author-supercut-architecture-arc",
    source: "author-chat-history (2026-03-16, Portfolio chatbot conversation)",
    synthetic: false,
    domain: "dev",
    turns: [
      {
        turnIndex: 0,
        text: [
          "Regarding this last:",
          "",
          "UX Designer & Frontend Developer | AI Video Editor Startup (stealth, co-founder) Feb 2026 – Present · Pre-seed, 3-person founding team. Co-founding a voice-first AI video editor that lets professional editors direct cuts through natural-language speech.",
          "",
          "It is named Super-Cut. I do brand and front + workflow + editing context engineering (since instructions from the user could be in different sessions and different screens — and it could be long — I think we should manage a project.md and come up with good ways to deal with that as well).",
          "",
          "We write with TypeScript + something called Electron (or something similar) that wraps it for desktop use. We have a DB (probably Postgres locally to handle metadata regarding the assets — maybe it should be a private file rather than a DB).",
          "",
          "The backend is responsible for all Gemini / Whisper communication and the actual building of video. The frontend is responsible for:",
          "1. Local assets management (categorizing)",
          "2. Compression of files and frames fetch from FFmpeg (it will be a service the frontend does — like a small backend for the front doing this operation to send to the real backend)",
          "3. Conversation with Anthropic SDK for editing",
          "4. What do you think?",
        ].join("\n"),
      },
      {
        turnIndex: 1,
        text: [
          "Q: Good to update the CV with this entry?",
          "A: Keep it even shorter — 2 lines max.",
          "",
          "Q: Want to dig into the context engineering architecture?",
          "A: Not now — save it for a dedicated session.",
        ].join("\n"),
      },
      {
        turnIndex: 2,
        text:
          "I need a text to explain Claude about Super-Cut and my role there — for the portfolio assistant knowledge base.",
      },
    ],
    evaluations: [
      {
        atTurn: 0,
        requiredPriorContext: [],
        expectedAgents: [
          "frontend-ui",
          "backend-api",
          "data-analytics",
          "product-pm",
          "research-writing",
        ],
        expectedTasks: [
          {
            agentId: "frontend-ui",
            expectedTask:
              "Confirm whether Electron + TypeScript + an FFmpeg-as-mini-backend service + Anthropic SDK chat layer is a coherent frontend shape for a desktop video editor.",
          },
          {
            agentId: "backend-api",
            expectedTask:
              "Define the contract between the frontend and the backend that owns Gemini/Whisper/video assembly, including which calls cross the boundary.",
          },
          {
            agentId: "data-analytics",
            expectedTask:
              "Recommend Postgres-local vs. a private file for asset metadata, and sketch the schema either way.",
          },
          {
            agentId: "product-pm",
            expectedTask:
              "Lock the frontend-vs-backend ownership boundary so the two co-founders' scopes do not overlap or drop work.",
          },
          {
            agentId: "research-writing",
            expectedTask:
              "Address the cross-session context-engineering problem (project.md pattern) — propose a two-layer state design (full project file + per-session summary).",
          },
        ],
      },
      {
        atTurn: 2,
        requiredPriorContext: [
          "The project's name is Super-Cut.",
          "Stack: Electron + TypeScript desktop app; Anthropic SDK on frontend; Gemini + Whisper + video assembly on backend; FFmpeg as a frontend-side media-prep service.",
          "Maria's scope: brand, frontend, workflow, editing context engineering. Co-founder owns backend (Gemini/Whisper/assembly).",
          "Context-engineering pattern was deferred to a dedicated session per turn 1; the project.md two-layer idea is the open thread.",
        ],
        expectedAgents: ["research-writing", "product-pm"],
        expectedTasks: [
          {
            agentId: "research-writing",
            expectedTask:
              "Draft a knowledge-base section about Super-Cut and Maria's role that names the real stack (Electron, TypeScript, FFmpeg, Anthropic SDK) and her actual responsibilities (brand, frontend, context engineering) — not generic.",
          },
          {
            agentId: "product-pm",
            expectedTask:
              "Frame the role as a co-founder at pre-seed without overclaiming shipped deliverables.",
          },
        ],
      },
    ],
  },
  {
    id: "author-bringup-property-management-arc",
    source: "author-chat-history (2026-03-22, BringUp property-management software evaluation)",
    synthetic: false,
    domain: "org-comms",
    // Verbatim Hebrew from author chat. Hebrew is preserved deliberately —
    // see findings.md "Multilingual judge note" — Sonnet 4.6 evaluates Hebrew
    // input directly. Public products (Monday.com, Make, Fillout) and the
    // commercial price (40,950 NIS) are not PII; BringUp retained per the
    // anonymization mapping. No third-party personal names appear.
    turns: [
      {
        turnIndex: 0,
        text: [
          "תעבור על ההצעה הזאת עד עמוד חמש (משש והלאה אין צורך)",
          "מדובר במערכת שהיא כלי עבודה לחברת ניהול בניין משרדים, שמשרתת בעיקר את אב הבית, וגם את הדירים והשומרים (לא בטוחה אם הם ממש משתמשים במערכת או רק מדווחים)",
          "",
          "אני עומדת להכנס לפגישה עם החברה, אני מגיעה כיעצת לבעלים שמתעניין בשות ורוצה לבדוק האם זה מתאים לו ולבניין.",
          "בפגישה אני אראה דמו של המוצר.",
          "אני רוצה להגיע מוכנה עם שאלות,",
          "ובקשות (נניח חסר לי מאד אפיון כלשהו,)",
          "",
          "אני צריכה את עזרתך להתכון לפגישה",
        ].join("\n"),
      },
      {
        turnIndex: 1,
        text: [
          "כן. ובבקשה תעשה חשיבה עמוקה לפני. ותכתוב את התשובות בצורה מתומצת ובפורמט צפוך (בולטים)",
          "עוד נקודות שחשבתי עליהם",
          "",
          "מי המשתמשים ? צריך איזה חשבון מנדיי",
          "איך דייר עוקב אחרי תקלה?",
          "איך מוודאים ששום פנייה לא הולכת לאיבוד? Retray / log הודעה ליוזר שנכשל?",
          "מה זה ברקוד לשומרים??",
          "מה קורה כשאותה תקלה נשלחת פעמים רבות עי דיירים רבים?",
          "מה קורה כשיש 100 תקלות?",
          "האם יש לבניין SLA? איך אב הבית מתעדף?",
          "נניח שוייך ספק. ולא הגיע, ואני רוצה לשיך ספק אחר. מה התהליך? אני כותבת משהו על הספק הנוכחי",
          "מה קורה אם האוטומציה נופלת?",
          "בדיקות. סביבת בדיקות. תסריטי בדיקה (מספר פניות שנפתחו כמספר הפניות שנשלחו. נסגרו כנל) אולי פיילוט משתמשים. כמות מוגבלת, מודל אחד בלבד (תקלות)",
          "מה בדחות, מה רואה כל משתמש במערכת? או שזה רק אב הבית? מה רואה הבעלים של החברה? יש לו יוזר?",
        ].join("\n"),
      },
      {
        turnIndex: 2,
        text: "מה דעתך כרגע על עות המערכת (תחקור ברשת להעריך)",
      },
      {
        turnIndex: 3,
        text: [
          "הייתי בפגישה:",
          "",
          "אוקי - הייתי בפגישה אז ככה. יש משימות קבועות של הבניין - שחוזרות על עצמן, והן מוזנות קודם כל והם חלק מהלייף סייקל (בדיקות שנאים, גינון וכך הלאה) יש פניות שמגיעות מדיירים - דרך מייל - ובמערכת המנדיי יצורף כפתור שמעביר את זה להיות שורת משימה. אין שם בינה מלאכותית שמבינה ומעדכנת - אני מניחה שזה פשוט הנושא של המייל וגוף המייל, וקבצים מצורפים. כרגע אין איחוד פניות. אם יהיהו הרבה פניות זה יהיה מאתגר - על SLA לא דיברנו ספקים מחוברים למשימות. כרגע פשוט מזינים לתוך המערכת ספקים + הסכם השרות איתם (אפשר רק לראות אותו, לא קורה שום דבר אמיתי - אם אפשר להכניס sla) כן יש דוח סיום עבודה שהם עושים - שזה דוח שנשלח להם בווטסאף שהם ממלאים וזה הופך לשורה.",
          "",
          "על השומרים לא דברנו הרבה - יש להם מעין qr קודז שהם סורקים כשהם עוברים בנקודות מסויימות. זו כבר מערכת קיימת",
        ].join("\n"),
      },
      {
        turnIndex: 4,
        text: "כפי שכרגע המערכת מתוארת - כמה היא שווה את המחיר?",
      },
    ],
    evaluations: [
      {
        atTurn: 0,
        requiredPriorContext: [],
        expectedAgents: [
          "product-pm",
          "payments",
          "security",
          "backend-api",
          "data-analytics",
          "ops-oncall",
          "research-writing",
        ],
        expectedTasks: [
          {
            agentId: "product-pm",
            expectedTask:
              "Frame the consultant's prep ask: what to evaluate at the demo (module scope, fit-for-purpose for a single office building), and how to position the value-vs-price question for the owner.",
          },
          {
            agentId: "payments",
            expectedTask:
              "Flag that the proposal hides the recurring license cost (Monday + Make + Fillout) on top of the one-time NIS price, and prepare a TCO question set for the meeting.",
          },
          {
            agentId: "security",
            expectedTask:
              "Surface the multi-user-access and visibility questions for the meeting: who sees what (owner, building manager, residents, guards), and what the guards-module's actual security boundary is.",
          },
          {
            agentId: "backend-api",
            expectedTask:
              "Identify the integration unknowns to ask about at the demo: how email→task conversion actually works (parsing, dedup, attachments), Make automation reliability (retry, dead-letter), and Fillout form-to-row flow.",
          },
          {
            agentId: "data-analytics",
            expectedTask:
              "Prepare the dashboard / KPI questions: what reporting the system gives the owner (resolution time, open issues, guard-route compliance) and whether export to Excel/PDF is supported.",
          },
          {
            agentId: "ops-oncall",
            expectedTask:
              "Flag the SLA/escalation gap to ask about: how the system handles 100+ open issues, prioritization, automation-failure detection, and reconciliation that no email is silently dropped.",
          },
          {
            agentId: "research-writing",
            expectedTask:
              "Produce a clean, printable Hebrew question list organized by topic (users/licenses, resident UX, reliability, supplier flow, guards, dashboards, testing/pilot, strategic).",
          },
        ],
      },
      {
        atTurn: 4,
        requiredPriorContext: [
          "The proposal covers three modules — task management (62h), resident requests (25h), guards (35h) — totaling ~120h at 40,950 NIS after discount on a Monday.com + Make + Fillout stack.",
          "Pre-meeting concerns raised in turn 1: no email-deduplication, no SLA, supplier records are view-only, guards-module unknown integration.",
          "Cost research from turn 2 surfaced the recurring license cost: Monday Pro for ~5 seats + Make + Fillout adds ~9–10K NIS/year on top of the one-time fee.",
          "Post-meeting facts from turn 3: email→task is a manual button (no AI parsing or dedup), no SLA was discussed, supplier agreements are view-only without action, an external QR-based guard system already exists.",
        ],
        expectedAgents: ["payments", "product-pm", "security"],
        expectedTasks: [
          {
            agentId: "payments",
            expectedTask:
              "Compute a value-versus-price verdict per module in NIS, integrating the post-meeting reality (manual email→task, no AI dedup, view-only supplier agreements, redundant guards module given existing QR system) and the recurring license cost surfaced in turn 2.",
          },
          {
            agentId: "product-pm",
            expectedTask:
              "Recommend proceed / negotiate / pause to the owner. Specifically: name which modules to keep, drop, or rescope, and target a revised price range that reflects the value gap.",
          },
          {
            agentId: "security",
            expectedTask:
              "Decide whether the guards module is worth its 11,200 NIS line item given the existing QR system flagged in turn 3, and articulate the reason crisply.",
          },
        ],
      },
    ],
  },
];
