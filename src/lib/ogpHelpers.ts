/**
 * OGPロジック — コンテンツメタデータ・シリーズ判定ヘルパー
 *
 * api/og/index.ts から切り出した純粋ロジック。
 * Edge Functionに依存しないため、単体テスト可能。
 */

// コンテンツID→メタデータマッピング（ja/en両対応）
export const CONTENT_META: Record<string, { ja: string; en: string; category: string; level: number }> = {
    m9s:     { ja: '至天の座アルカディア零式：ヘビー級1', en: 'AAC Heavyweight M1 (Savage)', category: 'savage', level: 100 },
    m10s:    { ja: '至天の座アルカディア零式：ヘビー級2', en: 'AAC Heavyweight M2 (Savage)', category: 'savage', level: 100 },
    m11s:    { ja: '至天の座アルカディア零式：ヘビー級3', en: 'AAC Heavyweight M3 (Savage)', category: 'savage', level: 100 },
    m12s_p1: { ja: '至天の座アルカディア零式：ヘビー級4（前半）', en: 'AAC Heavyweight M4 (Savage) Phase 1', category: 'savage', level: 100 },
    m12s_p2: { ja: '至天の座アルカディア零式：ヘビー級4（後半）', en: 'AAC Heavyweight M4 (Savage) Phase 2', category: 'savage', level: 100 },
    m5s:     { ja: '至天の座アルカディア零式：クルーザー級1', en: 'AAC Cruiserweight M1 (Savage)', category: 'savage', level: 100 },
    m6s:     { ja: '至天の座アルカディア零式：クルーザー級2', en: 'AAC Cruiserweight M2 (Savage)', category: 'savage', level: 100 },
    m7s:     { ja: '至天の座アルカディア零式：クルーザー級3', en: 'AAC Cruiserweight M3 (Savage)', category: 'savage', level: 100 },
    m8s:     { ja: '至天の座アルカディア零式：クルーザー級4', en: 'AAC Cruiserweight M4 (Savage)', category: 'savage', level: 100 },
    m1s:     { ja: '至天の座アルカディア零式：ライトヘビー級1', en: 'AAC Light-heavyweight M1 (Savage)', category: 'savage', level: 100 },
    m2s:     { ja: '至天の座アルカディア零式：ライトヘビー級2', en: 'AAC Light-heavyweight M2 (Savage)', category: 'savage', level: 100 },
    m3s:     { ja: '至天の座アルカディア零式：ライトヘビー級3', en: 'AAC Light-heavyweight M3 (Savage)', category: 'savage', level: 100 },
    m4s:     { ja: '至天の座アルカディア零式：ライトヘビー級4', en: 'AAC Light-heavyweight M4 (Savage)', category: 'savage', level: 100 },
    fru:     { ja: '絶もうひとつの未来', en: 'Futures Rewritten (Ultimate)', category: 'ultimate', level: 100 },
    dsr_p1:  { ja: '絶竜詩戦争P1', en: "Dragonsong's Reprise P1", category: 'ultimate', level: 90 },
    dsr:     { ja: '絶竜詩戦争', en: "Dragonsong's Reprise (Ultimate)", category: 'ultimate', level: 90 },
    top:     { ja: '絶オメガ検証戦', en: 'The Omega Protocol (Ultimate)', category: 'ultimate', level: 90 },
    tea:     { ja: '絶アレキサンダー討滅戦', en: 'The Epic of Alexander (Ultimate)', category: 'ultimate', level: 80 },
    ucob:    { ja: '絶バハムート討滅戦', en: 'The Unending Coil of Bahamut (Ultimate)', category: 'ultimate', level: 70 },
    uwu:     { ja: '絶アルテマウェポン破壊作戦', en: "The Weapon's Refrain (Ultimate)", category: 'ultimate', level: 70 },
    p9s:     { ja: '万魔殿パンデモニウム零式：天獄編1', en: 'Anabaseios: The Ninth Circle (Savage)', category: 'savage', level: 90 },
    p10s:    { ja: '万魔殿パンデモニウム零式：天獄編2', en: 'Anabaseios: The Tenth Circle (Savage)', category: 'savage', level: 90 },
    p11s:    { ja: '万魔殿パンデモニウム零式：天獄編3', en: 'Anabaseios: The Eleventh Circle (Savage)', category: 'savage', level: 90 },
    p12s_p1: { ja: '万魔殿パンデモニウム零式：天獄編4（前半）', en: 'Anabaseios: The Twelfth Circle (Savage) Phase 1', category: 'savage', level: 90 },
    p12s_p2: { ja: '万魔殿パンデモニウム零式：天獄編4（後半）', en: 'Anabaseios: The Twelfth Circle (Savage) Phase 2', category: 'savage', level: 90 },
    p5s:     { ja: '万魔殿パンデモニウム零式：煉獄編1', en: 'Abyssos: The Fifth Circle (Savage)', category: 'savage', level: 90 },
    p6s:     { ja: '万魔殿パンデモニウム零式：煉獄編2', en: 'Abyssos: The Sixth Circle (Savage)', category: 'savage', level: 90 },
    p7s:     { ja: '万魔殿パンデモニウム零式：煉獄編3', en: 'Abyssos: The Seventh Circle (Savage)', category: 'savage', level: 90 },
    p8s_p1:  { ja: '万魔殿パンデモニウム零式：煉獄編4（前半）', en: 'Abyssos: The Eighth Circle (Savage) Phase 1', category: 'savage', level: 90 },
    p8s_p2:  { ja: '万魔殿パンデモニウム零式：煉獄編4（後半）', en: 'Abyssos: The Eighth Circle (Savage) Phase 2', category: 'savage', level: 90 },
    p1s:     { ja: '万魔殿パンデモニウム零式：辺獄編1', en: 'Asphodelos: The First Circle (Savage)', category: 'savage', level: 90 },
    p2s:     { ja: '万魔殿パンデモニウム零式：辺獄編2', en: 'Asphodelos: The Second Circle (Savage)', category: 'savage', level: 90 },
    p3s:     { ja: '万魔殿パンデモニウム零式：辺獄編3', en: 'Asphodelos: The Third Circle (Savage)', category: 'savage', level: 90 },
    p4s_p1:  { ja: '万魔殿パンデモニウム零式：辺獄編4（前半）', en: 'Asphodelos: The Fourth Circle (Savage) Phase 1', category: 'savage', level: 90 },
    p4s_p2:  { ja: '万魔殿パンデモニウム零式：辺獄編4（後半）', en: 'Asphodelos: The Fourth Circle (Savage) Phase 2', category: 'savage', level: 90 },
    e9s:     { ja: '希望の園エデン零式：再生編1', en: "Eden's Promise: Umbra (Savage)", category: 'savage', level: 80 },
    e10s:    { ja: '希望の園エデン零式：再生編2', en: "Eden's Promise: Litany (Savage)", category: 'savage', level: 80 },
    e11s:    { ja: '希望の園エデン零式：再生編3', en: "Eden's Promise: Anamorphosis (Savage)", category: 'savage', level: 80 },
    e12s_p1: { ja: '希望の園エデン零式：再生編4（前半）', en: "Eden's Promise: Eternity (Savage) Phase 1", category: 'savage', level: 80 },
    e12s_p2: { ja: '希望の園エデン零式：再生編4（後半）', en: "Eden's Promise: Eternity (Savage) Phase 2", category: 'savage', level: 80 },
    e5s:     { ja: '希望の園エデン零式：共鳴編1', en: "Eden's Verse: Fulmination (Savage)", category: 'savage', level: 80 },
    e6s:     { ja: '希望の園エデン零式：共鳴編2', en: "Eden's Verse: Furor (Savage)", category: 'savage', level: 80 },
    e7s:     { ja: '希望の園エデン零式：共鳴編3', en: "Eden's Verse: Iconoclasm (Savage)", category: 'savage', level: 80 },
    e8s:     { ja: '希望の園エデン零式：共鳴編4', en: "Eden's Verse: Refulgence (Savage)", category: 'savage', level: 80 },
    e1s:     { ja: '希望の園エデン零式：覚醒編1', en: "Eden's Gate: Resurrection (Savage)", category: 'savage', level: 80 },
    e2s:     { ja: '希望の園エデン零式：覚醒編2', en: "Eden's Gate: Descent (Savage)", category: 'savage', level: 80 },
    e3s:     { ja: '希望の園エデン零式：覚醒編3', en: "Eden's Gate: Inundation (Savage)", category: 'savage', level: 80 },
    e4s:     { ja: '希望の園エデン零式：覚醒編4', en: "Eden's Gate: Sepulture (Savage)", category: 'savage', level: 80 },
    o9s:     { ja: '次元狭間オメガ零式：アルファ編1', en: 'Omega: Alphascape V1.0 (Savage)', category: 'savage', level: 70 },
    o10s:    { ja: '次元狭間オメガ零式：アルファ編2', en: 'Omega: Alphascape V2.0 (Savage)', category: 'savage', level: 70 },
    o11s:    { ja: '次元狭間オメガ零式：アルファ編3', en: 'Omega: Alphascape V3.0 (Savage)', category: 'savage', level: 70 },
    o12s_p1: { ja: '次元狭間オメガ零式：アルファ編4（前半）', en: 'Omega: Alphascape V4.0 (Savage) Phase 1', category: 'savage', level: 70 },
    o12s_p2: { ja: '次元狭間オメガ零式：アルファ編4（後半）', en: 'Omega: Alphascape V4.0 (Savage) Phase 2', category: 'savage', level: 70 },
    o5s:     { ja: '次元狭間オメガ零式：シグマ編1', en: 'Omega: Sigmascape V1.0 (Savage)', category: 'savage', level: 70 },
    o6s:     { ja: '次元狭間オメガ零式：シグマ編2', en: 'Omega: Sigmascape V2.0 (Savage)', category: 'savage', level: 70 },
    o7s:     { ja: '次元狭間オメガ零式：シグマ編3', en: 'Omega: Sigmascape V3.0 (Savage)', category: 'savage', level: 70 },
    o8s_p1:  { ja: '次元狭間オメガ零式：シグマ編4（前半）', en: 'Omega: Sigmascape V4.0 (Savage) Phase 1', category: 'savage', level: 70 },
    o8s_p2:  { ja: '次元狭間オメガ零式：シグマ編4（後半）', en: 'Omega: Sigmascape V4.0 (Savage) Phase 2', category: 'savage', level: 70 },
    o1s:     { ja: '次元狭間オメガ零式：デルタ編1', en: 'Omega: Deltascape V1.0 (Savage)', category: 'savage', level: 70 },
    o2s:     { ja: '次元狭間オメガ零式：デルタ編2', en: 'Omega: Deltascape V2.0 (Savage)', category: 'savage', level: 70 },
    o3s:     { ja: '次元狭間オメガ零式：デルタ編3', en: 'Omega: Deltascape V3.0 (Savage)', category: 'savage', level: 70 },
    o4s_p1:  { ja: '次元狭間オメガ零式：デルタ編4（前半）', en: 'Omega: Deltascape V4.0 (Savage) Phase 1', category: 'savage', level: 70 },
    o4s_p2:  { ja: '次元狭間オメガ零式：デルタ編4（後半）', en: 'Omega: Deltascape V4.0 (Savage) Phase 2', category: 'savage', level: 70 },
};

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
 * パラメータ順序（固定）:
 *   id → showTitle? → showLogo? → lang
 */
export function buildOgImageUrl(
    origin: string,
    shareId: string,
    opts: { showTitle: boolean; showLogo: boolean; lang: OgpLang },
): string {
    let url = `${origin}/api/og?id=${encodeURIComponent(shareId)}`;
    if (!opts.showTitle) url += '&showTitle=false';
    if (opts.showLogo) url += '&showLogo=true';
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
