/**
 * src/data/templateNormalize.ts
 *
 * 取得したテンプレートの後処理(フェーズ残骸の除去・旧形式ラベルの補完)。
 * templateLoader(取得の窓口)と staticTemplates(静的ファイル)の両方が使う。
 */

import type { TemplateData } from '../types/template';
import { isLegacyLabelFormat, migrateLabels } from '../utils/labelMigration';
import { ensurePhaseEndTimes } from '../utils/phaseMigration';

/**
 * 名前のないフェーズ（CSVインポート時のデフォルト残骸）を除去する。
 * Firestoreに保存された既存データのクリーンアップ用。
 */
export function filterPhantomPhases(tpl: TemplateData): TemplateData {
  if (!tpl.phases || tpl.phases.length === 0) return tpl;
  const filtered = tpl.phases.filter(p => {
    if (!p.name) return false;
    if (typeof p.name === 'string') return !!p.name;
    return !!(p.name.ja || p.name.en || p.name.zh || p.name['zh-Hant'] || p.name.ko);
  });
  if (filtered.length === tpl.phases.length) return tpl;
  return { ...tpl, phases: filtered };
}

/**
 * labelsフィールドがないテンプレートに対して、
 * timelineEventsのmechanicGroupからlabelsを生成する（旧テンプレート互換）。
 */
export function ensureLabels(tpl: TemplateData): TemplateData {
  if (tpl.labels && tpl.labels.length > 0) return tpl;

  // labelsがない場合、mechanicGroupから変換を試みる
  const hasLegacy = isLegacyLabelFormat({
    labels: tpl.labels ? [] : undefined,
    timelineEvents: tpl.timelineEvents,
  });
  if (!hasLegacy) return tpl;

  // migrateLabelsはPhase[]形式を期待するので変換
  const maxEventTime = tpl.timelineEvents.length > 0
    ? tpl.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
    : undefined;
  const phasesForMigration = ensurePhaseEndTimes((tpl.phases || []).map(p => ({
    id: `phase_${p.id}`,
    name: p.name || { ja: '', en: '' },
    startTime: p.startTimeSec,
  })), maxEventTime);
  const migratedLabels = migrateLabels(tpl.timelineEvents, phasesForMigration);

  if (migratedLabels.length === 0) return tpl;

  // Label[] → TemplateData.labels形式に変換
  return {
    ...tpl,
    labels: migratedLabels.map((label, i) => ({
      id: i + 1,
      startTimeSec: label.startTime,
      name: label.name,
      ...(label.endTime !== undefined ? { endTimeSec: label.endTime } : {}),
    })),
  };
}
