export type Tier = "small" | "medium" | "large";

export interface TierThresholds {
  /** Inputs strictly shorter than this go to the small path. */
  small: number;
  /** Inputs strictly shorter than this (and ≥ small) go to medium. */
  medium: number;
}

/**
 * Char-based thresholds. At ~4 chars/token: 8k chars ≈ 2k tokens (a few
 * paragraphs, comfortably one-shot with output budget); 40k chars ≈ 10k tokens
 * (multi-section text that pays for an outline+sections pass). Inputs at or
 * above 40k chars get the chunk+merge path. Phase 2.5 may revisit with
 * token-accurate logic.
 */
export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  small: 8_000,
  medium: 40_000,
};

export function detectTier(
  input: string,
  opts: { thresholds?: Partial<TierThresholds> } = {},
): Tier {
  const t = { ...DEFAULT_TIER_THRESHOLDS, ...(opts.thresholds ?? {}) };
  const n = input.length;
  if (n < t.small) return "small";
  if (n < t.medium) return "medium";
  return "large";
}
