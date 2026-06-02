/**
 * OGPロジック — コンテンツメタデータ・シリーズ判定ヘルパー
 *
 * api/og/index.ts から切り出した純粋ロジック。
 * Edge Functionに依存しないため、単体テスト可能。
 *
 * **重要**: JSON import (`import ... from '../data/contents.json'`) は
 * Vercel Edge Functions では動くが Node Functions (api/share 等) では
 * バンドラーがパス解決に失敗し FUNCTION_INVOCATION_FAILED を起こす。
 * そのため OGP 用データは TypeScript 定数 (contentsOgpData.ts) として保持する。
 * 新コンテンツ追加時は `node scripts/generate-ogp-data.mjs` で再生成。
 */

import { CONTENTS_OGP_DATA } from './contentsOgpData.js';

/**
 * コンテンツID→メタデータ（ja/en/category/level）。
 *
 * 正本は `src/data/contents.json`。OGP 用の抜粋を `contentsOgpData.ts` に
 * TypeScript 定数として保持し、Node/Edge 両方のバンドラーで確実に解決できるようにする。
 */
export const CONTENT_META = CONTENTS_OGP_DATA;

export const CATEGORY_LABELS: Record<string, string> = {
    savage: 'Savage',
    ultimate: 'Ultimate',
    dungeon: 'Dungeon',
    raid: 'Raid',
    custom: 'Misc',
};

export function getCategoryTag(contentId: string | null): string {
    if (!contentId) return '';
    const meta = CONTENT_META[contentId];
    if (!meta) return '';
    return `${CATEGORY_LABELS[meta.category] || meta.category} — Lv.${meta.level}`;
}

export type OgpLang = 'ja' | 'en';

/**
 * OGP画像URLを構築する共通関数（クライアント／サーバー共用）。
 *
 * 重要: Vercel edge cache は URL 文字列単位でキーを作るため、
 *       モーダルプレビュー・サーバーOGPメタ・サーバー側プリウォームの
 *       すべてでこの関数を使い、URL を完全一致させること。
 *
 * logoHash: ロゴ内容の SHA-256 先頭16文字。
 *   ロゴ内容が変わるとハッシュが変わり URL も変わるため、
 *   CDN キャッシュは別エントリ扱いになり常に最新ロゴ画像が生成される。
 *   showLogo=true のときのみ意味を持つ。
 *
 * パラメータ順序（固定）:
 *   id → showLogo? → lh? → lang
 */
export function buildOgImageUrl(
    origin: string,
    shareId: string,
    opts: { showLogo: boolean; logoHash?: string; lang: OgpLang },
): string {
    let url = `${origin}/api/og?id=${encodeURIComponent(shareId)}`;
    if (opts.showLogo) {
        url += '&showLogo=true';
        if (opts.logoHash) url += `&lh=${encodeURIComponent(opts.logoHash)}`;
    }
    url += `&lang=${opts.lang}`;
    return url;
}

export function getContentName(contentId: string | null, lang: OgpLang = 'ja'): string {
    if (!contentId) return '';
    const meta = CONTENT_META[contentId];
    if (!meta) return '';
    return meta[lang] || meta.ja || '';
}

export interface ParsedTier {
    seriesName: string;   // 例: "至天の座アルカディア零式"
    tierName: string;     // 例: "ヘビー級"
    label: string;        // 例: "1" or "4前半"
}

// コンテンツ名から シリーズ名・階級名・番号を分解する
// 例: "至天の座アルカディア零式：ヘビー級4（前半）" → { seriesName: "至天の座アルカディア零式", tierName: "ヘビー級", label: "4前半" }
export function parseTier(ja: string): ParsedTier | null {
    const m = ja.match(/^(.+?)：(.+?)(\d+)(?:（(.+?)）)?$/);
    if (!m) return null;
    const suffix = m[4] || '';  // "前半" / "後半" / ""
    return { seriesName: m[1], tierName: m[2], label: m[3] + suffix };
}

// バンドルプランが全て同シリーズかどうか判定し、まとめ表記を返す
export function trySeriesSummary(
    plans: { contentId: string | null; title: string }[],
    lang: OgpLang = 'ja',
): {
    seriesName: string;
    tierName: string;
    summary: string;
    categoryTag: string;
} | null {
    if (plans.length < 2) return null;

    // parseTierは日本語名の構造に依存するため、英語モードではまとめ表記を使わない
    if (lang !== 'ja') return null;

    const parsed: ParsedTier[] = [];
    for (const plan of plans) {
        const name = getContentName(plan.contentId, 'ja');
        if (!name) return null;
        const p = parseTier(name);
        if (!p) return null;
        parsed.push(p);
    }

    // 全て同じシリーズ名+階級名か
    const first = parsed[0];
    if (!parsed.every(p => p.seriesName === first.seriesName && p.tierName === first.tierName)) {
        return null;
    }

    const summary = first.tierName + ' ' + parsed.map(p => p.label).join(' / ');
    const categoryTag = plans[0].contentId ? getCategoryTag(plans[0].contentId) : '';

    return { seriesName: first.seriesName, tierName: first.tierName, summary, categoryTag };
}
