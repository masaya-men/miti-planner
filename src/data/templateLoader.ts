/**
 * src/data/templateLoader.ts
 *
 * テンプレートデータの読み込み。
 * Firestore → localStorage → 静的ファイルの順で取得する。
 * 静的ファイル（Vite glob import）はフォールバック用に維持。
 */

import type { TimelineEvent, LocalizedString } from '../types';
import { fetchTemplate as fetchFromFirestore } from '../hooks/useMasterData';
import { isLegacyLabelFormat, migrateLabels } from '../utils/labelMigration';
import { ensurePhaseEndTimes } from '../utils/phaseMigration';

export interface TemplateData {
  contentId: string;
  generatedAt: string;
  sourceLogsCount: number;
  timelineEvents: TimelineEvent[];
  phases: { id: number; startTimeSec: number; name?: LocalizedString; }[];
  labels?: { id: number; startTimeSec: number; name: LocalizedString; endTimeSec?: number }[];
  _warning?: string;
}

/**
 * 名前のないフェーズ（CSVインポート時のデフォルト残骸）を除去する。
 * Firestoreに保存された既存データのクリーンアップ用。
 */
function filterPhantomPhases(tpl: TemplateData): TemplateData {
  if (!tpl.phases || tpl.phases.length === 0) return tpl;
  const filtered = tpl.phases.filter(p => {
    if (!p.name) return false;
    if (typeof p.name === 'string') return !!p.name;
    return !!(p.name.ja || p.name.en || p.name.zh || p.name.ko);
  });
  if (filtered.length === tpl.phases.length) return tpl;
  return { ...tpl, phases: filtered };
}

/**
 * labelsフィールドがないテンプレートに対して、
 * timelineEventsのmechanicGroupからlabelsを生成する（旧テンプレート互換）。
 */
function ensureLabels(tpl: TemplateData): TemplateData {
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

// 静的ファイル（Vite glob import）— フォールバック用に維持
const templateModules = import.meta.glob('./templates/*.json');

/**
 * Checks synchronously if a static template is available for the given contentId.
 */
export function hasTemplate(contentId: string): boolean {
  return `./templates/${contentId}.json` in templateModules;
}

/**
 * 静的テンプレートのみを読み込む（useMasterDataのフォールバック用）。
 * 循環参照を避けるため、fetchTemplateからはこちらを呼ぶ。
 */
export async function getStaticTemplate(contentId: string): Promise<TemplateData | null> {
  const modulePath = `./templates/${contentId}.json`;

  if (!(modulePath in templateModules)) {
    return null;
  }

  try {
    const module = await templateModules[modulePath]() as { default: TemplateData };
    return filterPhantomPhases(ensureLabels(module.default));
  } catch (error) {
    console.error(`Failed to load template for ${contentId}:`, error);
    return null;
  }
}

/**
 * テンプレートデータを取得する。
 * Firestore → localStorage → 静的ファイルの順でフォールバック。
 */
export async function getTemplate(contentId: string): Promise<TemplateData | null> {
  const tpl = await fetchFromFirestore(contentId);
  return tpl ? filterPhantomPhases(ensureLabels(tpl)) : null;
}
