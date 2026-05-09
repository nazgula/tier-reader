import type { AgentSpec } from "../src/index.js";

/**
 * Agents carry the metadata used by `route()` (id, description, tag/entity
 * filters) plus a `systemPrompt` used when the agent is actually invoked
 * end-to-end. Smaller rosters are strict subsets of larger rosters so a
 * given message's expectedAgents stays meaningful across N.
 */
export interface BenchAgent extends AgentSpec {
  systemPrompt: string;
}

const FRONTEND: BenchAgent = {
  id: "frontend-ui",
  domain: "frontend",
  description:
    "Frontend / UI engineer. Handles browser-side bugs, rendering issues, accessibility, performance, and client-side state.",
  tagFilters: ["frontend", "ui", "ux", "performance", "rendering"],
  systemPrompt:
    "You are a senior frontend engineer. Diagnose UI bugs, propose fixes scoped to the client side, and call out cross-cutting concerns when relevant.",
};

const BACKEND: BenchAgent = {
  id: "backend-api",
  domain: "backend",
  description:
    "Backend / API engineer. Owns server-side endpoints, request handling, persistence, idempotency, and event emission.",
  tagFilters: ["backend", "api", "endpoint", "database", "persistence"],
  systemPrompt:
    "You are a senior backend engineer. Specify endpoints, schemas, idempotency, and event flows. Be precise about contracts.",
};

const CUSTOMER_SUPPORT: BenchAgent = {
  id: "customer-support",
  domain: "customer-support",
  description:
    "Customer support specialist. Drafts customer-facing replies, FAQ updates, and triages tickets across specialist queues.",
  tagFilters: ["support", "customer", "ticket", "faq", "help-center"],
  systemPrompt:
    "You are a senior customer-support specialist. Draft replies that resolve issues without overpromising. Use empathetic but precise language.",
};

const RESEARCH_WRITING: BenchAgent = {
  id: "research-writing",
  domain: "research",
  description:
    "Research and technical writing specialist. Produces side-by-side comparisons, explainers, and structured summaries.",
  tagFilters: ["research", "writing", "comparison", "summary", "explainer"],
  systemPrompt:
    "You are a senior research-and-writing specialist. Produce structured, factual outputs and flag uncertainty rather than guessing.",
};

const OPS_ONCALL: BenchAgent = {
  id: "ops-oncall",
  domain: "ops",
  description:
    "Operations / on-call engineer. Owns incident routing, paging policy, runbooks, and reliability handoffs.",
  tagFilters: ["ops", "on-call", "incident", "paging", "runbook"],
  systemPrompt:
    "You are a senior on-call engineer. Update routing/policy clearly and flag when a change requires a runbook revision.",
};

const PAYMENTS: BenchAgent = {
  id: "payments",
  domain: "payments",
  description:
    "Payments specialist. Handles billing, refunds, charge lifecycles, and payment-provider integrations.",
  tagFilters: ["payments", "billing", "refund", "charge", "subscription"],
  entityFilters: ["Stripe", "ACH", "Adyen"],
  systemPrompt:
    "You are a senior payments engineer. Be exact about charge/refund lifecycles, idempotency, and provider-specific quirks.",
};

const COMPLIANCE_KYC: BenchAgent = {
  id: "compliance-kyc",
  domain: "compliance",
  description:
    "Compliance and KYC specialist. Owns SOC2/ISO/HIPAA scope, BAA, data residency, and identity verification flows.",
  tagFilters: ["compliance", "kyc", "soc2", "iso", "hipaa", "baa"],
  systemPrompt:
    "You are a senior compliance specialist. Be precise about framework scope, BAA, and data-residency commitments.",
};

const DATA_ANALYTICS: BenchAgent = {
  id: "data-analytics",
  domain: "data",
  description:
    "Data and analytics specialist. Owns metrics, dashboards, ETL, and analytic-event taxonomy.",
  tagFilters: ["data", "analytics", "metrics", "dashboard", "etl"],
  systemPrompt:
    "You are a senior data/analytics specialist. Be precise about event names, metric definitions, and pipeline boundaries.",
};

const SECURITY: BenchAgent = {
  id: "security",
  domain: "security",
  description:
    "Security engineer. Handles auth, audit logging, secret storage, and threat-model concerns.",
  tagFilters: ["security", "auth", "audit", "secret", "threat-model"],
  systemPrompt:
    "You are a senior security engineer. Be exact about audit schemas, key handling, and trust boundaries.",
};

const PRODUCT_PM: BenchAgent = {
  id: "product-pm",
  domain: "product",
  description:
    "Product manager. Owns roadmap, OKR tracking, prioritization, and stakeholder communication.",
  tagFilters: ["product", "okr", "roadmap", "prioritization", "stakeholder"],
  systemPrompt:
    "You are a senior product manager. Summarize OKR results, hiring impact, and roadmap implications without inventing facts.",
};

export const ROSTER_3: BenchAgent[] = [BACKEND, FRONTEND, CUSTOMER_SUPPORT];

export const ROSTER_5: BenchAgent[] = [...ROSTER_3, RESEARCH_WRITING, OPS_ONCALL];

export const ROSTER_10: BenchAgent[] = [
  ...ROSTER_5,
  PAYMENTS,
  COMPLIANCE_KYC,
  DATA_ANALYTICS,
  SECURITY,
  PRODUCT_PM,
];

export const ROSTERS: Record<3 | 5 | 10, BenchAgent[]> = {
  3: ROSTER_3,
  5: ROSTER_5,
  10: ROSTER_10,
};

export type RosterSize = keyof typeof ROSTERS;
