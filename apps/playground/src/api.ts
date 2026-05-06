import type { Tier, Tree } from "@tier-reader/core";

export async function fetchFixtures(): Promise<string[]> {
  const r = await fetch("/api/fixtures");
  if (!r.ok) throw new Error(`fetchFixtures: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { fixtures: string[] };
  return j.fixtures;
}

export async function fetchFixture(name: string): Promise<string> {
  const r = await fetch(`/api/fixtures/${encodeURIComponent(name)}`);
  if (!r.ok) throw new Error(`fetchFixture: ${r.status} ${await r.text()}`);
  return r.text();
}

export interface DecomposeResult {
  tree: Tree;
  tier: Tier;
}

export async function fetchDecompose(
  input: string,
  opts: {
    model?: string;
    respectStructure?: boolean;
    tier?: Tier;
    synthesisMerge?: boolean;
  } = {},
): Promise<DecomposeResult> {
  const r = await fetch("/api/decompose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input,
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.respectStructure !== undefined ? { respectStructure: opts.respectStructure } : {}),
      ...(opts.tier !== undefined ? { tier: opts.tier } : {}),
      ...(opts.synthesisMerge !== undefined ? { synthesisMerge: opts.synthesisMerge } : {}),
    }),
  });
  const text = await r.text();
  if (!r.ok) {
    let msg = text;
    try {
      msg = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {}
    throw new Error(msg);
  }
  const j = JSON.parse(text) as { tree: Tree; tier: Tier };
  return { tree: j.tree, tier: j.tier };
}
