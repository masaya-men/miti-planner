import type { Region } from './dcServerMap';

export type RegionLocale = 'ja' | 'en' | 'ko' | 'zh';

export const REGION_LABELS: Record<Region, Record<RegionLocale, string>> = {
    JP: { ja: '日本', en: 'Japan', ko: '일본', zh: '日本' },
    NA: { ja: '北米', en: 'North America', ko: '북미', zh: '北美' },
    EU: { ja: '欧州', en: 'Europe', ko: '유럽', zh: '欧洲' },
    OCE: { ja: 'オセアニア', en: 'Oceania', ko: '오세아니아', zh: '大洋洲' },
    KR: { ja: '韓国', en: 'Korea', ko: '한국', zh: '韩国' },
    CN: { ja: '中国', en: 'China', ko: '중국', zh: '中国' },
};

export function regionLabel(region: Region, locale: RegionLocale): string {
    return REGION_LABELS[region][locale];
}

/** i18n.language ("ja" / "en-US" 等) を RegionLocale ('ja'|'en'|'ko'|'zh') に正規化。未知/空は ja。 */
export function pickRegionLocale(language: string): RegionLocale {
    const head = (language || 'ja').slice(0, 2).toLowerCase();
    if (head === 'en' || head === 'ko' || head === 'zh') return head;
    return 'ja';
}
