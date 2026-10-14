const DEFAULT_FILLERS = [
  "eh",
  "ehm",
  "uhm",
  "um",
  "uh",
  "like",
  "basically",
  "literally",
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "liksom",
  "på en måte",
  "egentlig",
  "terte",
  "hmm"
];

export interface AnswerStats {
  wordCount: number;
  durationMs: number;
  wordsPerMinute: number;
  fillerCount: number;
  fillers: Record<string, number>;
}

/**
 * Pure transcript analytics for video/voice feedback.
 */
export function answerStats(
  transcript: string,
  durationMs: number,
  fillers: string[] = DEFAULT_FILLERS
): AnswerStats {
  const normalized = transcript.toLowerCase().replace(/\s+/g, " ").trim();
  const words = normalized ? normalized.split(" ").filter(Boolean) : [];
  const minutes = Math.max(durationMs, 1) / 60_000;
  const fillerHits: Record<string, number> = {};
  let fillerCount = 0;

  for (const filler of fillers) {
    const needle = filler.toLowerCase();
    if (!needle) continue;
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(needle)}(?=\\s|$)`, "g");
    const matches = normalized.match(re);
    const count = matches?.length ?? 0;
    if (count > 0) {
      fillerHits[filler] = count;
      fillerCount += count;
    }
  }

  return {
    wordCount: words.length,
    durationMs,
    wordsPerMinute: Math.round(words.length / minutes),
    fillerCount,
    fillers: fillerHits
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
