/**
 * Judge prompts. Sonnet 4.6 evaluates each (agent, condition, message) twice:
 *   - Steering accuracy: did the *input* slice contain what this agent needed?
 *   - Output quality:    did the *output* satisfy this agent's expected task?
 *
 * Both judges return a 0–5 integer score plus a one-line rationale. The judge
 * is constructed to be context-only — no knowledge of which condition produced
 * the slice, to avoid bias. The orchestrator anonymizes the condition before
 * sending.
 */

export type JudgeKind = "steering" | "output" | "propagation";

export interface JudgeInput {
  /** Original message the agent rosters were responding to. */
  sourceMessage: string;
  agentId: string;
  agentDescription: string;
  /** What this agent should produce, per dataset.expectedTasks. */
  expectedTask: string;
  /** Slice of context the agent received. */
  contextGiven: string;
  /** What the agent actually returned. Empty for the steering-only judge. */
  agentOutput?: string;
}

export interface JudgeVerdict {
  score: number;
  rationale: string;
}

const STEERING_RUBRIC = `Score 0–5:
  5 — Slice contains everything this agent needs and nothing distracting.
  4 — Slice covers the agent's task; minor irrelevant content.
  3 — Slice covers the task but with significant noise OR partial coverage.
  2 — Slice partially relevant; agent would have to infer or skip much of it.
  1 — Slice mostly irrelevant; only one usable fragment.
  0 — Slice contains nothing actionable for this agent.`;

const OUTPUT_RUBRIC = `Score 0–5:
  5 — Output fully satisfies the expected task with correct, specific content.
  4 — Satisfies the task; minor omissions or imprecision.
  3 — Addresses the task but with a notable gap (missing one of multiple parts, or vague).
  2 — Partially addresses the task; major omissions.
  1 — Tangentially related; does not complete the task.
  0 — Does not address the expected task at all.`;

export interface PropagationJudgeInput {
  /** Identifier of the evaluated agent — kept for parity with other judges. */
  agentId: string;
  agentDescription: string;
  /**
   * Facts established in earlier turns that the routed slice for the current
   * turn must surface. One bullet per fact.
   */
  requiredPriorContext: string[];
  /** Slice of context the agent received for this turn. */
  contextGiven: string;
}

const PROPAGATION_RUBRIC = `Score 0–5 by fraction of required prior facts present in the slice:
  5 — All required prior facts are explicitly present (verbatim or unambiguous paraphrase).
  4 — All but one fact present, or all present but one is only weakly implied.
  3 — Roughly half the required facts present.
  2 — A minority of required facts present; most are missing.
  1 — At most one fact present; the slice is effectively starting from scratch.
  0 — No required prior facts present.`;

export function buildPropagationPrompt(input: PropagationJudgeInput): string {
  const facts = input.requiredPriorContext.map((f, i) => `  ${i + 1}. ${f}`).join("\n");
  return [
    `You are evaluating whether facts established in earlier conversation turns`,
    `propagated into the routed context slice that a specialist agent receives`,
    `for the current turn.`,
    ``,
    `Agent under evaluation:`,
    `  id: ${input.agentId}`,
    `  description: ${input.agentDescription}`,
    ``,
    `Required prior facts (established in earlier turns):`,
    facts,
    ``,
    `Context slice the agent received for the current turn:`,
    `"""`,
    input.contextGiven,
    `"""`,
    ``,
    `Question: how many of the required prior facts are present in the slice?`,
    ``,
    PROPAGATION_RUBRIC,
    ``,
    `Respond as strict JSON: {"score": <int 0-5>, "rationale": "<one sentence>"}`,
  ].join("\n");
}

export function buildSteeringPrompt(input: JudgeInput): string {
  return [
    `You are evaluating the *input* given to a specialist agent in a multi-agent system.`,
    ``,
    `Source message (the user's full ask):`,
    `"""`,
    input.sourceMessage,
    `"""`,
    ``,
    `Agent under evaluation:`,
    `  id: ${input.agentId}`,
    `  description: ${input.agentDescription}`,
    `  expected task for this agent: ${input.expectedTask}`,
    ``,
    `Context slice the agent received:`,
    `"""`,
    input.contextGiven,
    `"""`,
    ``,
    `Question: does this slice contain what the agent needs to act on its expected task?`,
    ``,
    STEERING_RUBRIC,
    ``,
    `Respond as strict JSON: {"score": <int 0-5>, "rationale": "<one sentence>"}`,
  ].join("\n");
}

export function buildOutputPrompt(input: JudgeInput): string {
  if (input.agentOutput === undefined) {
    throw new Error("buildOutputPrompt: agentOutput is required");
  }
  return [
    `You are evaluating the *output* of a specialist agent in a multi-agent system.`,
    ``,
    `Source message (the user's full ask):`,
    `"""`,
    input.sourceMessage,
    `"""`,
    ``,
    `Agent under evaluation:`,
    `  id: ${input.agentId}`,
    `  description: ${input.agentDescription}`,
    `  expected task for this agent: ${input.expectedTask}`,
    ``,
    `Context slice the agent received:`,
    `"""`,
    input.contextGiven,
    `"""`,
    ``,
    `Agent's output:`,
    `"""`,
    input.agentOutput,
    `"""`,
    ``,
    `Question: given the expected task, did the agent's output complete it correctly?`,
    ``,
    OUTPUT_RUBRIC,
    ``,
    `Respond as strict JSON: {"score": <int 0-5>, "rationale": "<one sentence>"}`,
  ].join("\n");
}

/**
 * Lenient JSON parse: tolerates code-fence wrappers ("```json\n{...}\n```")
 * since judge models occasionally add them despite explicit instructions.
 */
export function parseVerdict(raw: string): JudgeVerdict {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();
  const parsed = JSON.parse(text) as { score?: unknown; rationale?: unknown };
  const score = typeof parsed.score === "number" ? Math.round(parsed.score) : NaN;
  const rationale = typeof parsed.rationale === "string" ? parsed.rationale : "";
  if (Number.isNaN(score) || score < 0 || score > 5) {
    throw new Error(`parseVerdict: invalid score in ${JSON.stringify(raw)}`);
  }
  return { score, rationale };
}
