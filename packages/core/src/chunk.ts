export interface Chunk {
  text: string;
  sourceStart: number;
  sourceEnd: number;
}

const TARGET_CHUNK_CHARS = 15_000;

/**
 * Structural chunker. Splits on markdown ATX headings (`^#{1,6} `) when present;
 * otherwise packs paragraphs (separated by blank lines) up to TARGET_CHUNK_CHARS.
 * Returned chunks cover the full input contiguously: chunks[i].sourceEnd ===
 * chunks[i+1].sourceStart, chunks[0].sourceStart === 0, last.sourceEnd === input.length.
 */
export function chunkByStructure(input: string): Chunk[] {
  const headingChunks = splitByHeadings(input);
  if (headingChunks.length > 1) return headingChunks;
  return splitByParagraphs(input);
}

function splitByHeadings(input: string): Chunk[] {
  const headingRe = /^#{1,6} /gm;
  const starts: number[] = [];
  for (const m of input.matchAll(headingRe)) {
    if (m.index !== undefined) starts.push(m.index);
  }
  if (starts.length === 0) return [];
  if (starts[0]! > 0) starts.unshift(0);

  const chunks: Chunk[] = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]!;
    const e = i + 1 < starts.length ? starts[i + 1]! : input.length;
    chunks.push({ text: input.slice(s, e), sourceStart: s, sourceEnd: e });
  }
  return packSmall(chunks);
}

function splitByParagraphs(input: string): Chunk[] {
  const sepRe = /\n\s*\n/g;
  const paragraphs: Chunk[] = [];
  let cursor = 0;
  for (const m of input.matchAll(sepRe)) {
    if (m.index === undefined) continue;
    const end = m.index + m[0].length;
    paragraphs.push({ text: input.slice(cursor, end), sourceStart: cursor, sourceEnd: end });
    cursor = end;
  }
  if (cursor < input.length) {
    paragraphs.push({ text: input.slice(cursor), sourceStart: cursor, sourceEnd: input.length });
  }
  if (paragraphs.length === 0) {
    return [{ text: input, sourceStart: 0, sourceEnd: input.length }];
  }
  return packSmall(paragraphs);
}

/** Greedily merge adjacent chunks while combined length stays ≤ target. */
function packSmall(chunks: Chunk[]): Chunk[] {
  const out: Chunk[] = [];
  for (const c of chunks) {
    const last = out[out.length - 1];
    if (
      last &&
      last.sourceEnd - last.sourceStart + (c.sourceEnd - c.sourceStart) <= TARGET_CHUNK_CHARS
    ) {
      last.text += c.text;
      last.sourceEnd = c.sourceEnd;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}
