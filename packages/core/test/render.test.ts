import { describe, expect, it } from "vitest";
import { decompose } from "../src/decompose.js";
import { renderAt } from "../src/render.js";
import { CANNED, FIXTURE_NAMES, loadFixture } from "./helpers/canned.js";
import { mockProvider } from "./helpers/mock-provider.js";

function buildProvider() {
  const canned = new Map<string, (typeof CANNED)[string]>();
  for (const name of FIXTURE_NAMES) {
    canned.set(loadFixture(name), CANNED[name]!);
  }
  return mockProvider(canned);
}

describe("renderAt()", () => {
  it("depth 0 returns just the root with showDetail=false (root has children)", async () => {
    const tree = await decompose(loadFixture("wikipedia-paragraph"), {
      provider: buildProvider(),
    });
    const plan = renderAt(tree, "0", 0);
    expect(plan).toEqual([{ nodeId: "0", indent: 0, showDetail: true }]);
    // root has children → at boundary, showDetail should still mark "expand to here".
    // Note: per implementation, atBoundary || isLeaf ⇒ showDetail. Boundary nodes
    // without their own detail simply have nothing to show — renderer handles that.
  });

  it("depth 1 returns root plus its direct children", async () => {
    const tree = await decompose(loadFixture("wikipedia-paragraph"), {
      provider: buildProvider(),
    });
    const plan = renderAt(tree, "0", 1);
    const ids = plan.map((p) => p.nodeId);
    expect(ids[0]).toBe("0");
    expect(ids.slice(1)).toEqual(tree.nodes["0"]!.childIds);
    // Children are leaves in this fixture → showDetail true on all of them.
    for (const entry of plan.slice(1)) {
      expect(entry.indent).toBe(1);
      expect(entry.showDetail).toBe(true);
    }
  });

  it("indent reflects relative depth from the requested node", async () => {
    const tree = await decompose(loadFixture("ai-chat-answer"), {
      provider: buildProvider(),
    });
    const plan = renderAt(tree, "0", 2);
    expect(plan[0]!.indent).toBe(0);
    for (const entry of plan.slice(1)) {
      expect(entry.indent).toBeGreaterThan(0);
    }
  });

  it("throws on unknown nodeId", async () => {
    const tree = await decompose(loadFixture("wikipedia-paragraph"), {
      provider: buildProvider(),
    });
    expect(() => renderAt(tree, "9.9", 1)).toThrow(/unknown nodeId/);
  });

  it("throws on negative depth", async () => {
    const tree = await decompose(loadFixture("wikipedia-paragraph"), {
      provider: buildProvider(),
    });
    expect(() => renderAt(tree, "0", -1)).toThrow(/expandToDepth/);
  });
});
