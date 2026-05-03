import { STARTER_KINDS } from "./schema.js";

export function buildDecomposePrompt(
  source: string,
  opts: { maxDepth: number; fanoutHint: [number, number]; starterKinds: readonly string[] },
): string {
  const [minF, maxF] = opts.fanoutHint;
  const kinds = opts.starterKinds.join(" | ");
  return `You are decomposing a piece of text into a tree for progressive disclosure.

GOAL
Each non-leaf "title" must be an INFO-DENSE one-liner (~12 words) that a reader can LEARN FROM on its own — not a label, not a section header. Reading just the titles top-to-bottom should teach the reader what the text says, in increasing detail as they descend.

LEAVES carry "detail" containing the VERBATIM source text for that segment. Concatenating all leaf details in tree order MUST reproduce the original source (whitespace differences are tolerated; do not paraphrase, summarize, or omit).

NON-LEAVES MUST NOT have "detail" — only "title" and "children".

STRUCTURE
- Aim for ${minF}–${maxF} children per parent. Deviate only when content clearly warrants.
- Default depth is up to ${opts.maxDepth}. Go deeper only when a child genuinely needs sub-decomposition.
- Cover the entire source. Do not drop content.
- Children appear in source order.

SEMANTICS (per node)
- "kind": one of [${kinds}] when one fits. If nothing fits, set "kind": "other" AND "kindSuggestion": "<your label>".
- "tags": optional open-set domain tags (e.g. "physics", "biography").
- "entities": optional named entities, lowercased.

TITLE QUALITY
- BAD: "Background", "Definition", "Examples", "Conclusion".
- GOOD: "Photosynthesis converts light energy into chemical bonds inside chloroplasts.", "DACS routes per-agent context by embedding-similarity to the agent's domain spec."

OUTPUT
Return a JSON object matching the provided schema: { roots: RawNode[] } where each RawNode is { title, detail?, kind?, kindSuggestion?, tags?, entities?, children? }. Leaves have "detail"; non-leaves have "children".

SOURCE TEXT (verbatim, between <<< and >>>):
<<<
${source}
>>>`;
}
