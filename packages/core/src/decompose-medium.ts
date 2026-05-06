import { z } from "zod";
import type { DecomposeOpts, DecomposeSmallRawFn } from "./decompose.js";
import { buildMediumOutlinePrompt } from "./prompt.js";
import type { RawNode, RawTree } from "./schema.js";

const OutlineSectionSchema = z.object({
  title: z.string().min(1),
  /** Verbatim copy of the first line of the section (heading line, or first
   * sentence if no heading). We locate this anchor in the source ourselves to
   * compute char spans — models are unreliable at producing offsets directly. */
  anchor: z.string().min(1),
});

const OutlineSchema = z.object({
  sections: z.array(OutlineSectionSchema).min(1),
});

type OutlineSection = z.infer<typeof OutlineSectionSchema>;

const PARALLEL_LIMIT = 4;

/**
 * Medium strategy: pass-1 outline (top-level titles + an anchor string per
 * section); pass-2 per-section small-tier decompose in parallel.
 *
 * We compute char spans ourselves by locating each anchor in the source.
 * Asking the model to count characters is unreliable; asking it to copy a
 * short string verbatim is not.
 */
export async function decomposeMedium(
  input: string,
  opts: DecomposeOpts & { model: string },
  smallRaw: DecomposeSmallRawFn,
): Promise<RawTree> {
  const outlinePrompt = buildMediumOutlinePrompt(input, {
    maxDepth: opts.maxDepth ?? 3,
    fanoutHint: opts.fanoutHint ?? [3, 7],
  });
  const outline = await opts.provider.callStructured(outlinePrompt, OutlineSchema, {
    model: opts.model,
    signal: opts.signal,
    traceName: "decompose.medium.outline",
  });

  const sectionTexts = anchorsToSectionTexts(input, outline.sections);

  const subResults: RawTree[] = await mapWithLimit(sectionTexts, PARALLEL_LIMIT, (text, i) =>
    smallRaw(text.body, opts, opts.model).catch((err) => {
      throw new Error(
        `decomposeMedium: section ${i} (${text.title.slice(0, 40)}…) failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }),
  );

  const roots: RawNode[] = sectionTexts.map((section, i) => ({
    title: section.title,
    children: subResults[i]!.roots,
  }));

  return { roots };
}

/**
 * Locate each anchor in the source, sort by position, and slice the source
 * into contiguous section bodies. Anchors that can't be located are dropped
 * with a warning rather than failing the whole pass.
 */
function anchorsToSectionTexts(
  input: string,
  sections: OutlineSection[],
): { title: string; body: string }[] {
  const located = sections
    .map((s) => {
      const anchor = s.anchor.trim();
      const start = input.indexOf(anchor);
      return { title: s.title.trim(), start };
    })
    .filter((s) => s.start >= 0 && s.title.length > 0)
    .sort((a, b) => a.start - b.start);

  if (located.length === 0) {
    throw new Error(
      "decomposeMedium: outline returned no anchors that could be located in the source",
    );
  }

  // Force first section to start at 0 so leading content is not lost.
  located[0]!.start = 0;

  return located.map((s, i) => {
    const end = i + 1 < located.length ? located[i + 1]!.start : input.length;
    return { title: s.title, body: input.slice(s.start, end) };
  });
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}
