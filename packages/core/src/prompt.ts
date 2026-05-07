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

PARAGRAPH-AS-LEAF (primary rule)
A paragraph (text between blank-line breaks) carrying one main idea is emitted as a LEAF whose "detail" is the VERBATIM paragraph text, copied EXACTLY as written including punctuation, capitalization, and internal whitespace. Do NOT split such a paragraph into a parent + one paraphrasing child — that loses verbatim and adds no information.

Subdivide a paragraph only when it genuinely contains multiple distinct claims that benefit from being read separately. Default is "leaf"; subdivision is the exception.

NO PARENT WITH ONE PARAPHRASING CHILD
Never emit a parent that has exactly one child whose detail (or title) is substantially the parent's source. Collapse: drop the parent and promote the child, or drop the child and keep the parent's title with the child's detail.

VERBATIM RECONSTRUCTION INVARIANT
Concatenating all leaf "detail" in tree order MUST reconstruct the original source (whitespace differences are tolerated). A parent title is a SUMMARY of what's beneath it; it is NOT a replacement for source text. If your parent title contains content from the source's opening sentence, that sentence MUST still appear verbatim somewhere in the leaves below — typically as the first sentence of the paragraph-leaf's detail.

TITLE STYLE
Each "title" is the SHORTEST single sentence that DELIVERS that chunk's actual gist — the reader should LEARN the thing from the title alone, not just learn that the thing exists. Plain language. No "Topic:" prefixes, no labels, no headlines.

  GOOD: "Matter is any substance with mass and volume, but excludes massless phenomena like photons."
  BAD:  "Definition of matter."
  GOOD: "Atoms are quantum entities without inherent size; fermions claim space via the exclusion principle."
  BAD:  "Quantum nature of matter."

If the source naturally states a contrast or qualified claim ("X, but Y" / "X, though Y"), KEEP IT in one title. Splitting it across siblings loses the relationship.

A SECTION title must reflect the WHOLE section, not just its first paragraph. If the section title only describes paragraph 1, rewrite it to cover the rest.

NO REPETITION
A child title MUST add concrete information beyond what its parent already says. If a child paraphrases its parent — even with extra hedging or examples — collapse them per the rule above.

  BAD nesting (child paraphrases parent):
    parent: "Matter is any substance with mass and volume, composed of atoms and subatomic particles."
      child: "Matter includes all touchable objects and anything made of atoms or particles with rest mass and volume."
  GOOD nesting:
    parent: "Matter is any substance with mass and volume, but excludes massless phenomena."
      child: "Massless particles like photons and energy waves like light or heat are explicitly excluded."

STRUCTURE
- Top level: 3-6 sections that together cover the entire source. Roughly one section per heading or major topic shift.
- A top-level section that says one cohesive thing should stay as a SINGLE LEAF — do not invent sub-divisions to hit a fanout target.
- When a section sub-divides, its children are typically paragraph-leaves of that section (one leaf per paragraph), per the primary rule above.
- Depth is a BUDGET, not a target. Use the SHALLOWEST tree that loses no information. Maximum depth ${opts.maxDepth}. Most content needs depth 1 or 2.
- Cover the entire source. Do not drop content. Children appear in source order.

LEAF vs PARENT
- LEAVES carry "detail" — VERBATIM source text for that segment, EXACTLY as written.
- PARENTS carry "children" and NEVER "detail".
- A node has EITHER "children" OR "detail", never both.

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

export function buildMediumOutlinePrompt(
  source: string,
  opts: { maxDepth: number; fanoutHint: [number, number] },
): string {
  const [lo, hi] = opts.fanoutHint;
  return `You will produce a TOP-LEVEL OUTLINE of the source text — titles only, no detail. A second pass will decompose each section in depth.

OUTLINE STYLE
- ${lo}-${hi} top-level sections that together cover the entire source, in source order. Roughly one section per heading or major topic shift.
- Each "title" is the SHORTEST single sentence that DELIVERS that section's gist — the reader should LEARN the thing from the title alone. Plain language. No "Topic:" prefixes.
- A section title must reflect the WHOLE section, not just its first paragraph. If your title only describes the first paragraph, rewrite it to cover the rest.

For each section, return:
- "title": one info-dense sentence as above.
- "anchor": a short VERBATIM substring copied EXACTLY from the source — the first line where the section begins. If the section starts at a markdown heading (e.g. "# Introduction"), copy that whole heading line. If there is no heading, copy the first 40-80 characters of the section's first sentence, exactly as written including punctuation and case. The anchor must appear verbatim in the source — we use it to locate the section. Do NOT paraphrase. Do NOT include text from before the section starts.

OUTPUT
Return JSON matching the provided schema: { sections: { title, anchor }[] }.

SOURCE TEXT (verbatim, between <<< and >>>):
<<<
${source}
>>>`;
}

export function buildLargeSynthesisPrompt(rootTitles: string[]): string {
  const numbered = rootTitles.map((t, i) => `[${i}] ${t}`).join("\n");
  return `You are merging the top-level titles of a long document — produced by decomposing the document chunk by chunk — into ONE cohesive outline. Adjacent titles about the same idea should be grouped together; thematically distinct titles should remain in separate sections.

INPUT — top-level titles (numbered, in source order):
${numbered}

OUTPUT
Produce 3-7 merged sections. Each merged section:
- "title": one info-dense sentence that DELIVERS the section's gist (the reader should LEARN the thing from the title alone). Plain language. Same style as the input titles. Do NOT use placeholders like "Section 1" or "Chunk N" — write a real title that summarizes the grouped content.
- "rootIndices": array of integers referencing the title numbers above, in source order.

Constraints:
- EVERY index from 0 to ${rootTitles.length - 1} MUST appear in exactly one merged section.
- Within a merged section, rootIndices must be in ascending order.
- Sections themselves must appear in source order (the first index of each section ascends across sections).

Return JSON matching the provided schema: { sections: { title, rootIndices }[] }.`;
}

