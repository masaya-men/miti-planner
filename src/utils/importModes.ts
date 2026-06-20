import type { TimelineEvent } from '../types';

export type ImportMode = 'replace_all' | 'replace_keep' | 'append';

export interface ImportEventResolution {
  /** 反映後の最終イベント列（time 昇順） */
  events: TimelineEvent[];
  /** 配置済み軽減を消すか（replace_all のみ true） */
  clearMitigations: boolean;
  /** append 時の取り込み下限時刻（既存最終時刻）。replace 系/既存空は null */
  appendFromTime: number | null;
}

const byTime = (a: TimelineEvent, b: TimelineEvent) => a.time - b.time;

export function resolveImportEvents(
  currentEvents: TimelineEvent[],
  incomingEvents: TimelineEvent[],
  mode: ImportMode,
): ImportEventResolution {
  if (mode === 'append') {
    const hasCurrent = currentEvents.length > 0;
    const lastTime = hasCurrent
      ? currentEvents.reduce((m, e) => Math.max(m, e.time), -Infinity)
      : -Infinity;
    const added = incomingEvents.filter(e => e.time > lastTime);
    const events = [...currentEvents, ...added].sort(byTime);
    return { events, clearMitigations: false, appendFromTime: hasCurrent ? lastTime : null };
  }
  const events = [...incomingEvents].sort(byTime);
  return { events, clearMitigations: mode === 'replace_all', appendFromTime: null };
}
