#!/usr/bin/env tsx
/**
 * Phase-2.5 spotcheck runner — verifies the consolidated default decompose
 * against section 2 of `medium-multi-section.txt` ("Producer side").
 *
 * Run from repo root:
 *   ANTHROPIC_API_KEY=... pnpm --filter examples spotcheck:phase-2_5
 *
 * Output: specs/phase-2_5-.../spotchecks/default.json. Committed for review.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Tree, aiSdkProvider, decompose } from "@tier-reader/core";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const fixturePath = resolve(repoRoot, "packages/core/test/fixtures/medium-multi-section.txt");
const outDir = resolve(repoRoot, "specs/phase-2_5-prompt-versions-research-2026-05-07/spotchecks");

function extractSection(source: string, heading: string): string {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) throw new Error(`heading not found: ${heading}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^# /.test(lines[i]!) && lines[i]!.trim() !== heading) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    process.stderr.write("error: ANTHROPIC_API_KEY is not set\n");
    process.exit(1);
  }
  const fixture = readFileSync(fixturePath, "utf8");
  const sectionText = extractSection(fixture, "# Producer side");

  mkdirSync(outDir, { recursive: true });
  const provider = aiSdkProvider();

  process.stderr.write("spotchecking default ...\n");
  const tree: Tree = await decompose(sectionText, { provider, tier: "small" });
  const out = resolve(outDir, "default.json");
  writeFileSync(out, `${JSON.stringify(tree, null, 2)}\n`);
  process.stderr.write(`  → ${out}\n`);

  report(tree, sectionText);
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

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

function singleChildSmells(tree: Tree): string[] {
  const out: string[] = [];
  for (const node of Object.values(tree.nodes)) {
    if (!node.hasChildren) continue;
    const cids = node.childIds ?? [];
    if (cids.length !== 1) continue;
    out.push(`${node.id} → ${cids[0]}`);
  }
  return out;
}

function report(tree: Tree, source: string): void {
  const leaves = leavesInOrder(tree);
  const concat = leaves.join("\n\n");
  const sourceToks = tokenize(source);
  const concatToks = tokenize(concat);
  let inter = 0;
  for (const t of concatToks) if (sourceToks.has(t)) inter++;
  const jaccard = inter / (sourceToks.size + concatToks.size - inter);

  const smells = singleChildSmells(tree);
  process.stderr.write("\n--- spotcheck report ---\n");
  process.stderr.write(`top-level sections : ${tree.rootIds.length}\n`);
  process.stderr.write(`leaves             : ${leaves.length}\n`);
  process.stderr.write(`reconstruction Jacc: ${jaccard.toFixed(3)}  (≥ 0.95 expected)\n`);
  process.stderr.write(
    `single-child nodes : ${smells.length === 0 ? "none" : smells.join(", ")}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
