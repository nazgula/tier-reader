import { describe, expect, it } from "vitest";
import {
  buildOutputPrompt,
  buildPropagationPrompt,
  buildSteeringPrompt,
  parseVerdict,
} from "../benchmarks/judge-prompts.js";

const BASE = {
  sourceMessage: "Source message text",
  agentId: "frontend-ui",
  agentDescription: "Frontend specialist",
  expectedTask: "Fix the duplicate render",
  contextGiven: "context slice",
};

describe("judge prompts", () => {
  it("steering prompt embeds source, agent, expected task, and slice", () => {
    const out = buildSteeringPrompt(BASE);
    expect(out).toContain("Source message");
    expect(out).toContain("frontend-ui");
    expect(out).toContain("Fix the duplicate render");
    expect(out).toContain("context slice");
    expect(out).toMatch(/Score 0–5/);
  });

  it("output prompt requires agentOutput and embeds it", () => {
    expect(() => buildOutputPrompt(BASE)).toThrow();
    const out = buildOutputPrompt({ ...BASE, agentOutput: "agent's reply" });
    expect(out).toContain("agent's reply");
  });

  it("propagation prompt embeds agent identity, required prior facts, and slice", () => {
    const out = buildPropagationPrompt({
      agentId: "research-writing",
      agentDescription: "Research specialist",
      requiredPriorContext: [
        "The project's name is Super-Cut.",
        "Stack is Electron + TypeScript.",
      ],
      contextGiven: "context slice",
    });
    expect(out).toContain("research-writing");
    expect(out).toContain("Super-Cut");
    expect(out).toContain("Electron + TypeScript");
    expect(out).toContain("context slice");
    expect(out).toMatch(/Score 0–5/);
  });
});

describe("parseVerdict", () => {
  it("parses a clean JSON verdict", () => {
    const v = parseVerdict('{"score": 4, "rationale": "ok"}');
    expect(v).toEqual({ score: 4, rationale: "ok" });
  });

  it("tolerates code-fence wrapping", () => {
    const v = parseVerdict('```json\n{"score": 3, "rationale": "fenced"}\n```');
    expect(v.score).toBe(3);
  });

  it("rounds non-integer scores", () => {
    const v = parseVerdict('{"score": 4.4, "rationale": "rounded"}');
    expect(v.score).toBe(4);
  });

  it("rejects out-of-range scores", () => {
    expect(() => parseVerdict('{"score": 9, "rationale": "bad"}')).toThrow();
    expect(() => parseVerdict('{"score": -1, "rationale": "bad"}')).toThrow();
  });

  it("rejects missing or non-numeric scores", () => {
    expect(() => parseVerdict('{"rationale": "no score"}')).toThrow();
    expect(() => parseVerdict('{"score": "high", "rationale": "x"}')).toThrow();
  });
});
