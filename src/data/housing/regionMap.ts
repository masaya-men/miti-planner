import type { Region } from './dcServerMap.js';

export type RegionLocale = 'ja' | 'en' | 'ko' | 'zh' | 'zh-Hant';

export const REGION_LABELS: Record<Region, Record<RegionLocale, string>> = {
    JP: { ja: '日本', en: 'Japan', ko: '일본', zh: '日本', 'zh-Hant': '日本' },
    NA: { ja: '北米', en: 'North America', ko: '북미', zh: '北美', 'zh-Hant': '北美' },
    EU: { ja: '欧州', en: 'Europe', ko: '유럽', zh: '欧洲', 'zh-Hant': '歐洲' },
    OCE: { ja: 'オセアニア', en: 'Oceania', ko: '오세아니아', zh: '大洋洲', 'zh-Hant': '大洋洲' },
    KR: { ja: '韓国', en: 'Korea', ko: '한국', zh: '韩国', 'zh-Hant': '韓國' },
    CN: { ja: '中国', en: 'China', ko: '중국', zh: '中国', 'zh-Hant': '中國' },
    // 台湾 (物理分離リージョン)。zh-Hant キーは Task 5 で追加済み。
    TW: { ja: '台湾', en: 'Taiwan', ko: '대만', zh: '台湾', 'zh-Hant': '台灣' },
};

export function regionLabel(region: Region, locale: RegionLocale): string {
    return REGION_LABELS[region][locale];
}

/** i18n.language ("ja" / "en-US" / "zh-Hant" 等) を RegionLocale に正規化。未知/空は ja。
 *  zh-Hant は zh(簡体字)より先に判定すること (順序を変えると zh-Hant が zh に丸め込まれる)。 */
export function pickRegionLocale(language: string): RegionLocale {
    const lang = (language || 'ja').toLowerCase();
    if (lang === 'zh-hant' || lang.startsWith('zh-hant-')) return 'zh-Hant';
    const head = lang.slice(0, 2);
    if (head === 'en' || head === 'ko' || head === 'zh') return head as RegionLocale;
    return 'ja';
}
