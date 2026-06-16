import type { TimelineEvent, LocalizedString } from '../../../types';

/** ドロップダウン用コンテンツ（AdminTemplates が読むのは id / nameJa / name?.ja のみ） */
export interface ContentItem {
  id: string;
  nameJa?: string;
  name?: { ja?: string; en?: string };
}

/** 一覧テーブル1行（API レスポンス形。AdminTemplates が lastUpdatedAt→updatedAt にマップする） */
export interface TemplateRow {
  contentId: string;
  source: string;
  eventCount: number;
  phaseCount: number;
  lockedAt: string | null;
  lastUpdatedAt: string;
}

/** 昇格候補 */
export interface PromotionCandidate {
  shareId: string;
  contentId: string;
  title: string;
  copyCount: number;
}

/** スプレッドシート詳細（GET ?resource=templates&id=◯◯ のレスポンス形） */
export interface TemplateDetail {
  timelineEvents: TimelineEvent[];
  phases: { id: number; startTimeSec: number; name?: LocalizedString }[];
  labels: { id: number; startTimeSec: number; name: LocalizedString; endTimeSec?: number }[];
}

const SOURCES = ['admin_editor', 'csv_import', 'plan_promote', 'fflogs'];

const contentId = (i: number) => `content-${String(i + 1).padStart(3, '0')}`;

/** 決定的な ISO 日付（Date.now を使わず再現性を確保） */
const isoDate = (i: number) => {
  const day = String((i % 28) + 1).padStart(2, '0');
  return `2026-05-${day}T08:30:00.000Z`;
};

export function makeContents(n: number): ContentItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: contentId(i),
    nameJa: `ダミーコンテンツ ${i + 1}`,
    name: { ja: `ダミーコンテンツ ${i + 1}`, en: `Dummy Content ${i + 1}` },
  }));
}

export function makeTemplateRows(n: number): TemplateRow[] {
  return Array.from({ length: n }, (_, i) => ({
    contentId: contentId(i),
    source: SOURCES[i % SOURCES.length],
    eventCount: 20 + (i % 30),
    phaseCount: 3 + (i % 5),
    lockedAt: i % 4 === 0 ? isoDate(i) : null,
    lastUpdatedAt: isoDate(i),
  }));
}

export function makeCandidates(n: number): PromotionCandidate[] {
  return Array.from({ length: n }, (_, i) => ({
    shareId: `share-${String(i + 1).padStart(3, '0')}`,
    contentId: contentId(i),
    title: `みんなの軽減表 候補 ${i + 1}`,
    copyCount: 50 - i * 3,
  }));
}

/** id を渡すと、その表の中身を決定的に生成する */
export function makeTimelineDetail(id: string): TemplateDetail {
  const damageTypes: TimelineEvent['damageType'][] = ['magical', 'physical', 'unavoidable', 'enrage'];
  const targets = ['AoE', 'MT', 'ST'] as const;

  const timelineEvents: TimelineEvent[] = Array.from({ length: 40 }, (_, i) => ({
    id: `${id}-ev-${i + 1}`,
    time: 10 + i * 15,
    // 3件に1件は en 未翻訳にして「未翻訳あり」状態の見た目も確認できるようにする
    name: { ja: `ギミック${i + 1}`, en: i % 3 === 0 ? '' : `Mechanic ${i + 1}` },
    damageType: damageTypes[i % damageTypes.length],
    damageAmount: 80000 + (i % 5) * 10000,
    target: targets[i % targets.length],
  }));

  const phases = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    startTimeSec: i * 120,
    name: { ja: `フェーズ${i + 1}`, en: `Phase ${i + 1}` } as LocalizedString,
  }));

  const labels = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    startTimeSec: i * 100,
    name: { ja: `ラベル${i + 1}`, en: `Label ${i + 1}` } as LocalizedString,
  }));

  return { timelineEvents, phases, labels };
}
