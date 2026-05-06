import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_TIER_THRESHOLDS, detectTier } from "../src/tier.js";
import { FIXTURE_NAMES } from "./helpers/canned.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "fixtures");

function load(name: string): string {
  return readFileSync(resolve(fixturesDir, `${name}.txt`), "utf8");
}

describe("detectTier()", () => {
  it("classifies every existing small fixture as 'small'", () => {
    for (const name of FIXTURE_NAMES) {
      const text = load(name);
      expect(detectTier(text), `${name} (${text.length} chars)`).toBe("small");
    }
  });

  it("classifies the medium fixture as 'medium'", () => {
    const text = load("medium-multi-section");
    expect(text.length).toBeGreaterThanOrEqual(DEFAULT_TIER_THRESHOLDS.small);
    expect(text.length).toBeLessThan(DEFAULT_TIER_THRESHOLDS.medium);
    expect(detectTier(text)).toBe("medium");
  });

  it("classifies the 50KB Wikipedia fixture as 'large'", () => {
    const text = load("wikipedia-50k");
    expect(text.length).toBeGreaterThanOrEqual(DEFAULT_TIER_THRESHOLDS.medium);
    expect(detectTier(text)).toBe("large");
  });

  it("respects threshold overrides", () => {
    const tiny = "x".repeat(100);
    expect(detectTier(tiny, { thresholds: { small: 50 } })).toBe("medium");
    expect(detectTier(tiny, { thresholds: { small: 50, medium: 80 } })).toBe("large");
    expect(detectTier(tiny, { thresholds: { small: 1000 } })).toBe("small");
  });

  it("threshold edges: < small → small, = small → medium, = medium → large", () => {
    const t = DEFAULT_TIER_THRESHOLDS;
    expect(detectTier("x".repeat(t.small - 1))).toBe("small");
    expect(detectTier("x".repeat(t.small))).toBe("medium");
    expect(detectTier("x".repeat(t.medium - 1))).toBe("medium");
    expect(detectTier("x".repeat(t.medium))).toBe("large");
  });
});
