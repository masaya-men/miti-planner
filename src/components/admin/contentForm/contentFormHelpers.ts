/**
 * コンテンツ編集フォーム — FFLogs URL からの ID 抽出と空フォームの初期値
 */
import type { ContentData } from './contentFormTypes';

/**
 * FFLogs URL から encounter ID を抽出する。
 * 対応パターン:
 *   https://www.fflogs.com/zone/rankings/65#encounter=1079
 *   https://www.fflogs.com/zone/statistics/encounter/1079/...
 *   https://www.fflogs.com/encounter/1079
 */
export function extractEncounterIdFromUrl(input: string): number | null {
  const match = input.match(/encounter[=/](\d+)/);
  return match ? Number(match[1]) : null;
}

/** 空のフォームデータ */
export function emptyContent(): ContentData {
  return {
    id: '',
    nameJa: '',
    nameEn: '',
    nameZh: '',
    nameZhHant: '',
    nameKo: '',
    shortNameJa: '',
    shortNameEn: '',
    category: 'savage',
    level: 100,
    patch: '',
    seriesId: '',
    order: 1,
    fflogsEncounterId: null,
    hasCheckpoint: false,
  };
}
