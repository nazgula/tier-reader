import { describe, expect, it } from "vitest";
import { decompose } from "../src/decompose.js";
import type { Tree } from "../src/schema.js";
import { CANNED, FIXTURE_NAMES, loadFixture } from "./helpers/canned.js";
import { mockProvider } from "./helpers/mock-provider.js";

function buildProvider() {
  const canned = new Map<string, (typeof CANNED)[string]>();
  for (const name of FIXTURE_NAMES) {
    canned.set(loadFixture(name), CANNED[name]!);
  }
  return mockProvider(canned);
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function leavesInOrder(tree: Tree): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    const n = tree.nodes[id]!;
    if (!n.hasChildren) {
      if (n.detail !== undefined) out.push(n.detail);
      return;
    }
    for (const c of n.childIds ?? []) visit(c);
  };
  for (const r of tree.rootIds) visit(r);
  return out;
}

describe("decompose() — structural validity", () => {
  const provider = buildProvider();

  for (const name of FIXTURE_NAMES) {
    it(`${name}: produces a structurally valid tree`, async () => {
      const source = loadFixture(name);
      const tree = await decompose(source, { provider });

      // Source + meta
      expect(tree.source).toBe(source);
      expect(tree.sourceHash).toMatch(/^[0-9a-f]{16}$/);
      expect(tree.meta.version).toBe(1);
      expect(tree.rootIds.length).toBeGreaterThan(0);

      // Every node id matches the dotted-int format.
      for (const id of Object.keys(tree.nodes)) {
        expect(id).toMatch(/^\d+(\.\d+)*$/);
      }

      // Parent/child consistency + hasChildren ↔ childIds.
      for (const node of Object.values(tree.nodes)) {
        if (node.hasChildren) {
          expect(node.childIds?.length ?? 0).toBeGreaterThan(0);
          expect(node.detail).toBeUndefined();
          for (const cid of node.childIds!) {
            const child = tree.nodes[cid];
            expect(child).toBeDefined();
            expect(child!.parentId).toBe(node.id);
            expect(child!.depth).toBe(node.depth + 1);
          }
        } else {
          expect(node.childIds).toBeUndefined();
        }
      }

      // Source reconstruction (whitespace-tolerant).
      const concatenated = leavesInOrder(tree).join("");
      expect(normalizeWs(concatenated)).toBe(normalizeWs(source));
    });
  }
});

describe("decompose() — snapshots", () => {
  const provider = buildProvider();

  for (const name of FIXTURE_NAMES) {
    it(`${name}: stable tree shape`, async () => {
      const source = loadFixture(name);
      const tree = await decompose(source, { provider });
      // Snapshot just the structure + titles + kinds — not source/hash/meta which vary.
      const snapshot = simplify(tree);
      expect(snapshot).toMatchSnapshot();
    });
  }
});

function simplify(tree: Tree) {
  const visit = (id: string): unknown => {
    const n = tree.nodes[id]!;
    return {
      id: n.id,
      title: n.title,
      kind: n.kind,
      hasDetail: n.detail !== undefined,
      children: (n.childIds ?? []).map(visit),
    };
  };
  return tree.rootIds.map(visit);
}

describe("decompose() — input validation", () => {
  it("rejects empty input", async () => {
    const provider = buildProvider();
    await expect(decompose("   ", { provider })).rejects.toThrow(/empty/);
  });
});
