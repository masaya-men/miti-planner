/**
 * テンプレートエディター — mechanicGroup から labels[] を導出する計算
 */
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../types/template';
import type { TemplateLabel } from './templateEditorTypes';
import { isLegacyLabelFormat, migrateLabels } from '../../utils/labelMigration';
import { ensurePhaseEndTimes } from '../../utils/phaseMigration';

/**
 * mechanicGroup から TemplateLabel[] を導出するヘルパー。
 * migrateLabels を使って Label[] → TemplateLabel[] に変換する。
 */
export function deriveLabelsFromEvents(
  events: TimelineEvent[],
  phases: TemplateData['phases'],
): TemplateLabel[] {
  const hasLegacy = isLegacyLabelFormat({ labels: undefined, timelineEvents: events });
  if (!hasLegacy) return [];

  const maxEventTime = events.length > 0
    ? events.reduce((max, e) => Math.max(max, e.time), 0)
    : undefined;
  const phasesForMigration = ensurePhaseEndTimes((phases || []).map(p => ({
    id: `phase_${p.id}`,
    name: p.name || { ja: '', en: '' },
    startTime: p.startTimeSec,
  })), maxEventTime);
  const migrated = migrateLabels(events, phasesForMigration);

  return migrated.map((label, i) => ({
    id: i + 1,
    startTimeSec: label.startTime,
    name: label.name,
    ...(label.endTime !== undefined ? { endTimeSec: label.endTime } : {}),
  }));
}
