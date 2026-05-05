import { describe, expect, it } from "vitest";
import { buildDecomposePrompt } from "../src/prompt.js";
import { STARTER_KINDS } from "../src/schema.js";

const baseOpts = {
  maxDepth: 3,
  fanoutHint: [3, 7] as [number, number],
  starterKinds: STARTER_KINDS,
};

describe("buildDecomposePrompt", () => {
  it("omits the structure clause by default", () => {
    const p = buildDecomposePrompt("anything", baseOpts);
    expect(p).not.toMatch(/RESPECT SOURCE STRUCTURE/);
  });

  it("omits the structure clause when respectStructure is false", () => {
    const p = buildDecomposePrompt("anything", { ...baseOpts, respectStructure: false });
    expect(p).not.toMatch(/RESPECT SOURCE STRUCTURE/);
  });

  it("includes the structure clause when respectStructure is true", () => {
    const p = buildDecomposePrompt("anything", { ...baseOpts, respectStructure: true });
    expect(p).toMatch(/RESPECT SOURCE STRUCTURE/);
    expect(p).toMatch(/paragraph .* is ONE unit/);
    expect(p).toMatch(/SUBORDINATE/);
  });

  it("embeds the source verbatim", () => {
    const p = buildDecomposePrompt("hello world", baseOpts);
    expect(p).toMatch(/<<<\nhello world\n>>>/);
  });
});
