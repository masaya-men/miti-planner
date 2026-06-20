import type { TemplateData } from '../data/templateLoader';

/**
 * テンプレートエディター向けのフェーズ取り込み解決（純粋関数）。
 * ストアの importTimelineEvents（useMitigationStore.ts:932-951）のフェーズ追記ロジックの
 * テンプレ型版。ストア Phase 型（startTime/endTime）とは別に TemplateData['phases']
 * （startTimeSec・endTime なし）で動く。ensurePhaseEndTimes は通さない（描画前に補完される）。
 */
export function resolveTemplatePhaseAppend(
  currentPhases: TemplateData['phases'],
  incomingPhases: TemplateData['phases'],
  mode: 'replace_all' | 'append',
  appendFromTime: number | null,
): TemplateData['phases'] {
  if (mode === 'replace_all') {
    return incomingPhases;
  }
  // append: cutoff より後の新規フェーズだけ既存に足す（負値除外・同時刻除外。null ガード必須）
  const added = incomingPhases.filter(
    (p) => p.startTimeSec >= 0 && (appendFromTime === null || p.startTimeSec > appendFromTime),
  );
  if (added.length === 0) {
    return currentPhases;
  }
  return [...currentPhases, ...added].sort((a, b) => a.startTimeSec - b.startTimeSec);
}
