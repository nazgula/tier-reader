import { STARTER_KINDS } from "./schema.js";

export function buildDecomposePrompt(
  source: string,
  opts: {
    maxDepth: number;
    fanoutHint: [number, number];
    starterKinds: readonly string[];
    respectStructure?: boolean;
  },
): string {
  const kinds = opts.starterKinds.join(" | ");
  const structureClause = opts.respectStructure
    ? `

RESPECT SOURCE STRUCTURE
The source has structural units (headings, paragraphs separated by blank lines, lists). Honor them:
- A paragraph (text between blank-line breaks) is ONE unit. Do NOT split a paragraph across siblings at the same level. Either keep it whole as one leaf, or place it as a single subtree whose children sub-divide it.
- Where the source has heading-marked sections, sections are the higher unit and group paragraphs. Do not flatten sections away or merge paragraphs across section boundaries.
- Lists are units; list items are sub-units.
- The "3-6 top-level sections" floor below is SUBORDINATE to this rule. If respecting structure means 1 or 2 top-level sections (e.g. a single-paragraph input), that is correct.`
    : "";
  return `Decompose the following text into a hierarchical tree for progressive disclosure reading.${structureClause}

TITLE STYLE
Each "title" is the SHORTEST single sentence that DELIVERS that chunk's actual gist — the reader should LEARN the thing from the title alone, not just learn that the thing exists. Plain language. No "Topic:" prefixes, no labels, no headlines.

  GOOD: "Matter is any substance with mass and volume, but excludes massless phenomena like photons."
  BAD:  "Definition of matter."
  GOOD: "Atoms are quantum entities without inherent size; fermions claim space via the exclusion principle."
  BAD:  "Quantum nature of matter."
  GOOD: "Particulate theory of matter originated independently in ancient Greece and India."
  BAD:  "Historical background."

If the source naturally states a contrast or qualified claim ("X, but Y" / "X, though Y"), KEEP IT in one title. Splitting it across siblings loses the relationship.

NO REPETITION
A child title MUST add concrete information beyond what its parent already says. If a child is a paraphrase of the parent — even with extra hedging or examples — collapse them: drop the parent and promote the child, or drop the child and keep the parent's title with the child's detail.

  BAD nesting (child paraphrases parent):
    parent: "Matter is any substance with mass and volume, composed of atoms and subatomic particles."
      child: "Matter includes all touchable objects and anything made of atoms or particles with rest mass and volume."
  GOOD nesting:
    parent: "Matter is any substance with mass and volume, but excludes massless phenomena."
      child: "Massless particles like photons and energy waves like light or heat are explicitly excluded."

STRUCTURE
- Top level: 3-6 sections that together cover the entire source. Roughly one section per paragraph or major topic shift.
- A top-level section that says one cohesive thing should stay as a SINGLE LEAF — do not invent sub-divisions to hit a fanout target.
- When a section does sub-divide, prefer 2-5 children. Skip a layer if there'd only be one child whose title isn't materially different from the parent's.
- Depth is a BUDGET, not a target. Use the SHALLOWEST tree that loses no information. Maximum depth ${opts.maxDepth}. Most content needs depth 1 or 2.
- Cover the entire source. Do not drop content. Children appear in source order.

LEAF vs PARENT
- LEAVES carry "detail" — the VERBATIM source text for that segment, EXACTLY as written. Do not paraphrase, summarize, or omit.
- PARENTS carry "children" and NEVER "detail".
- A node has EITHER "children" OR "detail", never both.
- Concatenating all leaf "detail" in tree order MUST reconstruct the original source (whitespace differences are tolerated).

OPTIONAL METADATA (set only when obvious; omit otherwise — do not pad)
- "kind": one of [${kinds}] when one fits cleanly. Skip when uncertain.
- "tags": open-set domain tags only when clearly applicable.
- "entities": named entities, lowercased, only when clearly applicable.

OUTPUT
Return JSON matching the provided schema: { roots: RawNode[] }. The roots array IS the top-level sections (3-6 per the rule above) — do not wrap them in a single synthetic root.

SOURCE TEXT (verbatim, between <<< and >>>):
<<<
${source}
>>>`;
}
