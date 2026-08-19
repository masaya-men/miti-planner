import type { Region } from '../../data/housing/dcServerMap.js';

/**
 * i18n.language から推測する既定リージョンの優先順。 ja/en系は日本を含むグローバル圏
 * (JP/NA/EU/OCE)、ko は韓国、zh(簡体)は中国、zh-Hant は台湾。
 * `useHousingFilterStore` の地域フィルタ既定値と、Allmarksまとめてインポートで
 * リージョンが混在したときの選択肢デフォルトで共有する (2026-08-19)。
 */
export function localeDefaultRegionOrder(lang: string): Region[] {
  const head = (lang || 'ja').toLowerCase();
  if (head === 'zh-hant' || head.startsWith('zh-hant-')) return ['TW'];
  if (head.slice(0, 2) === 'ko') return ['KR'];
  if (head.slice(0, 2) === 'zh') return ['CN'];
  return ['JP', 'NA', 'EU', 'OCE'];
}

/**
 * i18n.language から推測する単一の既定リージョン。 `localeDefaultRegionOrder` は地域フィルタ
 * 向けに ja/en を「グローバル圏まるごと」返すが、こちらは「1つだけ選ぶ」場面向けに ja/en は
 * 日本を既定とする(Allmarksまとめてインポートのリージョン競合ダイアログで使用、2026-08-19)。
 */
export function localeDefaultRegion(lang: string): Region {
  const head = (lang || 'ja').toLowerCase();
  if (head === 'zh-hant' || head.startsWith('zh-hant-')) return 'TW';
  if (head.slice(0, 2) === 'ko') return 'KR';
  if (head.slice(0, 2) === 'zh') return 'CN';
  return 'JP';
}
