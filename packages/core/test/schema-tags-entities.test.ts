import { describe, expect, it } from "vitest";
import { RawNodeSchema, RawTreeSchema } from "../src/schema.js";

describe("schema — tags + entities", () => {
  it("RawTreeSchema preserves tags and entities at multiple levels", () => {
    const input = {
      roots: [
        {
          title: "Section about payments and KYC.",
          tags: ["payments", "kyc"],
          entities: ["Stripe"],
          children: [
            {
              title: "Refund policy clause.",
              detail: "The refund applies within 30 days.",
              tags: ["payments"],
              entities: ["Stripe", "ACH"],
            },
          ],
        },
      ],
    };

    const parsed = RawTreeSchema.parse(input);
    expect(parsed.roots).toHaveLength(1);
    expect(parsed.roots[0]!.tags).toEqual(["payments", "kyc"]);
    expect(parsed.roots[0]!.entities).toEqual(["Stripe"]);
    expect(parsed.roots[0]!.children?.[0]!.tags).toEqual(["payments"]);
    expect(parsed.roots[0]!.children?.[0]!.entities).toEqual(["Stripe", "ACH"]);
  });

  it("tags and entities are optional — pre-phase-3 trees still parse", () => {
    const input = {
      roots: [
        {
          title: "Old-style node with no tags or entities.",
          detail: "Source text.",
        },
      ],
    };

    const parsed = RawTreeSchema.parse(input);
    expect(parsed.roots[0]!.tags).toBeUndefined();
    expect(parsed.roots[0]!.entities).toBeUndefined();
  });

  it("empty arrays are accepted by the schema (decompose treats them as absent)", () => {
    const node = {
      title: "Node with explicitly empty arrays.",
      detail: "Text.",
      tags: [],
      entities: [],
    };

    const parsed = RawNodeSchema.parse(node);
    expect(parsed.tags).toEqual([]);
    expect(parsed.entities).toEqual([]);
  });

  it("tags and entities must be arrays of strings", () => {
    const bad = {
      roots: [
        {
          title: "Bad node.",
          tags: ["ok", 42],
        },
      ],
    };
    expect(() => RawTreeSchema.parse(bad)).toThrow();
  });
});
