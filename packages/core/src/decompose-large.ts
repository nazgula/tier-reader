import { z } from "zod";
import { chunkByStructure } from "./chunk.js";
import type { DecomposeOpts, DecomposeSmallRawFn } from "./decompose.js";
import { buildLargeSynthesisPrompt } from "./prompt.js";
import type { RawNode, RawTree } from "./schema.js";

const SynthesisSectionSchema = z.object({
  title: z.string().min(1),
  rootIndices: z.array(z.number().int().nonnegative()).min(1),
});

const SynthesisSchema = z.object({
  sections: z.array(SynthesisSectionSchema).min(1),
});

/**
 * Large strategy: structural chunk → sequential small-tier per chunk →
 * optional LLM synthesis merge that re-groups every chunk's roots into a
 * single cohesive top-level outline. We flatten roots across chunks before
 * merging so synthesis sees real titles (never "Chunk N" placeholders).
 *
 * With merge off, the flattened roots become siblings under a synthetic
 * "Document" root in source order.
 */
export async function decomposeLarge(
  input: string,
  opts: DecomposeOpts & { model: string },
  smallRaw: DecomposeSmallRawFn,
): Promise<RawTree> {
  const chunks = chunkByStructure(input);
  if (chunks.length === 0) throw new Error("decomposeLarge: chunker returned no chunks");

  const subResults: RawTree[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    try {
      subResults.push(await smallRaw(chunk.text, opts, opts.model));
    } catch (err) {
      throw new Error(
        `decomposeLarge: chunk ${i} (chars ${chunk.sourceStart}-${chunk.sourceEnd}) failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // Flatten: each chunk contributes its roots directly. This gives synthesis
  // real titles to group, in source order.
  const allRoots: RawNode[] = subResults.flatMap((sub) => sub.roots);

  const merge = opts.synthesisMerge ?? true;
  if (!merge) {
    return {
      roots: [
        {
          title: "Document",
          children: allRoots,
        },
      ],
    };
  }

  const synthesisPrompt = buildLargeSynthesisPrompt(allRoots.map((r) => r.title));
  const merged = await opts.provider.callStructured(synthesisPrompt, SynthesisSchema, {
    model: opts.model,
    signal: opts.signal,
    traceName: "decompose.large.synthesis",
  });

  const usedIndices = new Set<number>();
  const mergedRoots: RawNode[] = merged.sections.map((sec) => {
    const indices = sec.rootIndices.filter((i) => i >= 0 && i < allRoots.length);
    for (const i of indices) usedIndices.add(i);
    const children = indices.map((i) => allRoots[i]!);
    return {
      title: sec.title,
      children,
    };
  });

  // Append any roots the merge dropped, so the source-reconstruction invariant
  // holds (no leaf detail is lost). Group them under a final fallback section.
  const dropped = allRoots.filter((_, i) => !usedIndices.has(i));
  if (dropped.length > 0) {
    mergedRoots.push({
      title: "Additional content",
      children: dropped,
    });
  }

  return { roots: mergedRoots };
}
