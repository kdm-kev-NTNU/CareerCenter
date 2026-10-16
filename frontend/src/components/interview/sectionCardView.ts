import type { SectionAttempt, SectionKey } from "@careercenter/shared";
import { latestSectionAttempt } from "@careercenter/shared";

export interface SectionCardView {
  done: boolean;
  meta: string;
}

export function formatScoreDelta(delta: number | undefined): string {
  if (delta === undefined) return "";
  const sign = delta > 0 ? "+" : "";
  return ` (${sign}${delta})`;
}

/**
 * How a plan section card looks. A section in `freshStartKey` is shown as never practised,
 * even though its earlier attempts stay in the history.
 */
export function sectionCardView(
  history: ReadonlyMap<SectionKey, readonly SectionAttempt[]>,
  key: SectionKey,
  unpractisedMeta: string,
  freshStartKey: SectionKey | null
): SectionCardView {
  const latest = key === freshStartKey ? undefined : latestSectionAttempt(history, key);
  if (!latest) return { done: false, meta: unpractisedMeta };
  if (latest.sum === undefined) return { done: true, meta: `v${latest.version}` };
  return { done: true, meta: `v${latest.version} · sum ${latest.sum}${formatScoreDelta(latest.deltaFromPrevious)}` };
}
