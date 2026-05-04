#!/usr/bin/env tsx
import { type Tree, aiSdkProvider, decompose, renderAt } from "@tier-reader/core";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function printTree(tree: Tree): void {
  for (const rootId of tree.rootIds) {
    const plan = renderAt(tree, rootId, 99);
    for (const entry of plan) {
      const node = tree.nodes[entry.nodeId]!;
      const indent = "  ".repeat(entry.indent);
      const kind = node.kind ? ` [${node.kind}]` : "";
      process.stdout.write(`${indent}- ${node.title}${kind}\n`);
      if (entry.showDetail && node.detail) {
        const detailIndent = "  ".repeat(entry.indent + 1);
        process.stdout.write(`${detailIndent}> ${node.detail.trim()}\n`);
      }
    }
  }
}

async function main(): Promise<void> {
  const input = (await readStdin()).trim();
  if (!input) {
    process.stderr.write("error: no input on stdin\n");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    process.stderr.write("error: ANTHROPIC_API_KEY is not set\n");
    process.exit(1);
  }

  const tree = await decompose(input, { provider: aiSdkProvider() });
  printTree(tree);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
