import { describe, expect, it } from "vitest";
import { decompose } from "../src/decompose.js";
import type { RawTree, Tree } from "../src/schema.js";
import { mockProvider } from "./helpers/mock-provider.js";

function nodes(tree: Tree) {
  return Object.values(tree.nodes);
}

describe("decompose() — tags + entities passthrough", () => {
  it("populates tags and entities from raw output onto the tree", async () => {
    const source = "Refund policy stub. Stripe and ACH apply. Customer notice on file.";
    const canned: RawTree = {
      roots: [
        {
          title: "Refund policy spans payments rails and customer notice.",
          tags: ["payments", "compliance"],
          entities: ["Stripe"],
          children: [
            {
              title: "Refund policy stub.",
              detail: "Refund policy stub.",
              tags: ["payments"],
            },
            {
              title: "Stripe and ACH apply.",
              detail: " Stripe and ACH apply.",
              entities: ["Stripe", "ACH"],
            },
            {
              title: "Customer notice on file.",
              detail: " Customer notice on file.",
            },
          ],
        },
      ],
    };

    const provider = mockProvider(new Map([[source, canned]]));
    const tree = await decompose(source, { provider });

    const allTags = nodes(tree).flatMap((n) => n.tags ?? []);
    const allEntities = nodes(tree).flatMap((n) => n.entities ?? []);

    // Multi-topic: at least one distinct tag and one distinct entity present.
    expect(new Set(allTags).size).toBeGreaterThanOrEqual(1);
    expect(new Set(allEntities).size).toBeGreaterThanOrEqual(1);
    expect(allTags).toContain("payments");
    expect(allTags).toContain("compliance");

    // Entities are lowercased per decompose policy.
    expect(allEntities).toContain("stripe");
    expect(allEntities).toContain("ach");
    expect(allEntities).not.toContain("Stripe");
  });

  it("treats empty tag/entity arrays as absent on the produced node", async () => {
    const source = "Single-paragraph note.";
    const canned: RawTree = {
      roots: [
        {
          title: "Note about something with no semantic labels.",
          detail: "Single-paragraph note.",
          tags: [],
          entities: [],
        },
      ],
    };

    const provider = mockProvider(new Map([[source, canned]]));
    const tree = await decompose(source, { provider });

    const leaf = nodes(tree).find((n) => !n.hasChildren)!;
    expect(leaf.tags).toBeUndefined();
    expect(leaf.entities).toBeUndefined();
  });

  it("omits tags and entities when the raw output omits them entirely", async () => {
    const source = "Old-style note.";
    const canned: RawTree = {
      roots: [
        {
          title: "Pre-phase-3 style node without tags or entities.",
          detail: "Old-style note.",
        },
      ],
    };

    const provider = mockProvider(new Map([[source, canned]]));
    const tree = await decompose(source, { provider });

    for (const n of nodes(tree)) {
      expect(n.tags).toBeUndefined();
      expect(n.entities).toBeUndefined();
    }
  });
});
