import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
import { getSeriesByLevel, getContentBySeries } from '../data/contentRegistry';

/** 取込モーダル等へ「今開いているコンテンツ」を初期選択として渡すための型 */
export interface ContentSelectionDefault {
  contentId: string | null;
  level: ContentLevel | null;
  category: ContentCategory | null;
  title: string;
}

/** 零式・絶のみドロップダウン選択。それ以外は自由入力。 */
export function hasContentRegistry(
  cat: ContentCategory | null,
): cat is 'savage' | 'ultimate' {
  return cat === 'savage' || cat === 'ultimate';
}

/**
 * 零式・絶のコンテンツ一覧（フラットリスト）。
 * シリーズ単位で patch 降順、シリーズ内は registry 既定順。
 * NewPlanModal の filteredBosses と同一ロジック。
 */
export function getFilteredBosses(
  level: ContentLevel | null,
  category: ContentCategory | null,
): ContentDefinition[] {
  if (!level || !hasContentRegistry(category)) return [];
  const series = getSeriesByLevel(level).filter((s) => s.category === category);
  const seriesWithContents = series.map((s) => ({ series: s, contents: getContentBySeries(s.id) }));
  seriesWithContents.sort((a, b) => {
    const maxPatch = (items: ContentDefinition[]) =>
      items.reduce((acc, c) => (c.patch.localeCompare(acc, undefined, { numeric: true }) > 0 ? c.patch : acc), '0');
    return maxPatch(b.contents).localeCompare(maxPatch(a.contents), undefined, { numeric: true });
  });
  return seriesWithContents.flatMap((sc) => sc.contents);
}

/**
 * 選択状態から contentId を決める。
 * - 零式・絶: 選択ボスの id
 * - それ以外: 入力タイトル（空なら null）
 */
export function deriveContentId(
  boss: ContentDefinition | null,
  category: ContentCategory | null,
  title: string,
): string | null {
  if (boss) return boss.id;
  if (hasContentRegistry(category)) return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}
