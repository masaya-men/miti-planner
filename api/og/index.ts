/**
 * Vercel Edge Function — OGP画像生成
 *
 * GET /api/og?id=shareId — 共有プランのOGPカード画像(1200x630)を動的生成
 * Edge Runtimeで動作し、共有データはshare APIからHTTPで取得する
 *
 * デザイン:
 * - 左パネル（144px幅）: 装飾ライン + ファビコン + 縦書きLoPo（浸食不可）
 * - 右エリア: ロゴあり→ユーザー画像背景(50%暗)+中央大文字 / ロゴなし→黒背景+テキスト
 * - バンドル: 同シリーズまとめ表記 or 混在リスト
 */

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// コンテンツID→メタデータマッピング
const CONTENT_META: Record<string, { ja: string; category: string; level: number }> = {
    m9s:     { ja: '至天の座アルカディア零式：ヘビー級1', category: 'savage', level: 100 },
    m10s:    { ja: '至天の座アルカディア零式：ヘビー級2', category: 'savage', level: 100 },
    m11s:    { ja: '至天の座アルカディア零式：ヘビー級3', category: 'savage', level: 100 },
    m12s_p1: { ja: '至天の座アルカディア零式：ヘビー級4（前半）', category: 'savage', level: 100 },
    m12s_p2: { ja: '至天の座アルカディア零式：ヘビー級4（後半）', category: 'savage', level: 100 },
    m5s:     { ja: '至天の座アルカディア零式：クルーザー級1', category: 'savage', level: 100 },
    m6s:     { ja: '至天の座アルカディア零式：クルーザー級2', category: 'savage', level: 100 },
    m7s:     { ja: '至天の座アルカディア零式：クルーザー級3', category: 'savage', level: 100 },
    m8s:     { ja: '至天の座アルカディア零式：クルーザー級4', category: 'savage', level: 100 },
    m1s:     { ja: '至天の座アルカディア零式：ライトヘビー級1', category: 'savage', level: 100 },
    m2s:     { ja: '至天の座アルカディア零式：ライトヘビー級2', category: 'savage', level: 100 },
    m3s:     { ja: '至天の座アルカディア零式：ライトヘビー級3', category: 'savage', level: 100 },
    m4s:     { ja: '至天の座アルカディア零式：ライトヘビー級4', category: 'savage', level: 100 },
    fru:     { ja: '絶もうひとつの未来', category: 'ultimate', level: 100 },
    dsr_p1:  { ja: '絶竜詩戦争P1', category: 'ultimate', level: 90 },
    dsr:     { ja: '絶竜詩戦争', category: 'ultimate', level: 90 },
    top:     { ja: '絶オメガ検証戦', category: 'ultimate', level: 90 },
    tea:     { ja: '絶アレキサンダー討滅戦', category: 'ultimate', level: 80 },
    ucob:    { ja: '絶バハムート討滅戦', category: 'ultimate', level: 70 },
    uwu:     { ja: '絶アルテマウェポン破壊作戦', category: 'ultimate', level: 70 },
    p9s:     { ja: '万魔殿パンデモニウム零式：天獄編1', category: 'savage', level: 90 },
    p10s:    { ja: '万魔殿パンデモニウム零式：天獄編2', category: 'savage', level: 90 },
    p11s:    { ja: '万魔殿パンデモニウム零式：天獄編3', category: 'savage', level: 90 },
    p12s_p1: { ja: '万魔殿パンデモニウム零式：天獄編4（前半）', category: 'savage', level: 90 },
    p12s_p2: { ja: '万魔殿パンデモニウム零式：天獄編4（後半）', category: 'savage', level: 90 },
    p5s:     { ja: '万魔殿パンデモニウム零式：煉獄編1', category: 'savage', level: 90 },
    p6s:     { ja: '万魔殿パンデモニウム零式：煉獄編2', category: 'savage', level: 90 },
    p7s:     { ja: '万魔殿パンデモニウム零式：煉獄編3', category: 'savage', level: 90 },
    p8s_p1:  { ja: '万魔殿パンデモニウム零式：煉獄編4（前半）', category: 'savage', level: 90 },
    p8s_p2:  { ja: '万魔殿パンデモニウム零式：煉獄編4（後半）', category: 'savage', level: 90 },
    p1s:     { ja: '万魔殿パンデモニウム零式：辺獄編1', category: 'savage', level: 90 },
    p2s:     { ja: '万魔殿パンデモニウム零式：辺獄編2', category: 'savage', level: 90 },
    p3s:     { ja: '万魔殿パンデモニウム零式：辺獄編3', category: 'savage', level: 90 },
    p4s_p1:  { ja: '万魔殿パンデモニウム零式：辺獄編4（前半）', category: 'savage', level: 90 },
    p4s_p2:  { ja: '万魔殿パンデモニウム零式：辺獄編4（後半）', category: 'savage', level: 90 },
    e9s:     { ja: '希望の園エデン零式：再生編1', category: 'savage', level: 80 },
    e10s:    { ja: '希望の園エデン零式：再生編2', category: 'savage', level: 80 },
    e11s:    { ja: '希望の園エデン零式：再生編3', category: 'savage', level: 80 },
    e12s_p1: { ja: '希望の園エデン零式：再生編4（前半）', category: 'savage', level: 80 },
    e12s_p2: { ja: '希望の園エデン零式：再生編4（後半）', category: 'savage', level: 80 },
    e5s:     { ja: '希望の園エデン零式：共鳴編1', category: 'savage', level: 80 },
    e6s:     { ja: '希望の園エデン零式：共鳴編2', category: 'savage', level: 80 },
    e7s:     { ja: '希望の園エデン零式：共鳴編3', category: 'savage', level: 80 },
    e8s:     { ja: '希望の園エデン零式：共鳴編4', category: 'savage', level: 80 },
    e1s:     { ja: '希望の園エデン零式：覚醒編1', category: 'savage', level: 80 },
    e2s:     { ja: '希望の園エデン零式：覚醒編2', category: 'savage', level: 80 },
    e3s:     { ja: '希望の園エデン零式：覚醒編3', category: 'savage', level: 80 },
    e4s:     { ja: '希望の園エデン零式：覚醒編4', category: 'savage', level: 80 },
    o9s:     { ja: '次元狭間オメガ零式：アルファ編1', category: 'savage', level: 70 },
    o10s:    { ja: '次元狭間オメガ零式：アルファ編2', category: 'savage', level: 70 },
    o11s:    { ja: '次元狭間オメガ零式：アルファ編3', category: 'savage', level: 70 },
    o12s_p1: { ja: '次元狭間オメガ零式：アルファ編4（前半）', category: 'savage', level: 70 },
    o12s_p2: { ja: '次元狭間オメガ零式：アルファ編4（後半）', category: 'savage', level: 70 },
    o5s:     { ja: '次元狭間オメガ零式：シグマ編1', category: 'savage', level: 70 },
    o6s:     { ja: '次元狭間オメガ零式：シグマ編2', category: 'savage', level: 70 },
    o7s:     { ja: '次元狭間オメガ零式：シグマ編3', category: 'savage', level: 70 },
    o8s_p1:  { ja: '次元狭間オメガ零式：シグマ編4（前半）', category: 'savage', level: 70 },
    o8s_p2:  { ja: '次元狭間オメガ零式：シグマ編4（後半）', category: 'savage', level: 70 },
    o1s:     { ja: '次元狭間オメガ零式：デルタ編1', category: 'savage', level: 70 },
    o2s:     { ja: '次元狭間オメガ零式：デルタ編2', category: 'savage', level: 70 },
    o3s:     { ja: '次元狭間オメガ零式：デルタ編3', category: 'savage', level: 70 },
    o4s_p1:  { ja: '次元狭間オメガ零式：デルタ編4（前半）', category: 'savage', level: 70 },
    o4s_p2:  { ja: '次元狭間オメガ零式：デルタ編4（後半）', category: 'savage', level: 70 },
};

const CATEGORY_LABELS: Record<string, string> = {
    savage: 'Savage',
    ultimate: 'Ultimate',
    dungeon: 'Dungeon',
    raid: 'Raid',
    custom: 'Misc',
};

function getCategoryTag(contentId: string | null): string {
    if (!contentId) return '';
    const meta = CONTENT_META[contentId];
    if (!meta) return '';
    return `${CATEGORY_LABELS[meta.category] || meta.category} — Lv.${meta.level}`;
}

function getContentName(contentId: string | null): string {
    if (!contentId) return '';
    return CONTENT_META[contentId]?.ja || '';
}

// 左パネル幅
const LEFT_PANEL_WIDTH = 144;

// ========================================
// 同シリーズ判定
// ========================================

interface ParsedTier {
    seriesName: string;   // 例: "至天の座アルカディア零式"
    tierName: string;     // 例: "ヘビー級"
    label: string;        // 例: "1" or "4前半"
}

// コンテンツ名から シリーズ名・階級名・番号を分解する
// 例: "至天の座アルカディア零式：ヘビー級4（前半）" → { seriesName: "至天の座アルカディア零式", tierName: "ヘビー級", label: "4前半" }
function parseTier(ja: string): ParsedTier | null {
    const m = ja.match(/^(.+?)：(.+?)(\d+)(?:（(.+?)）)?$/);
    if (!m) return null;
    const suffix = m[4] || '';  // "前半" / "後半" / ""
    return { seriesName: m[1], tierName: m[2], label: m[3] + suffix };
}

// バンドルプランが全て同シリーズかどうか判定し、まとめ表記を返す
function trySeriesSummary(plans: { contentId: string | null; title: string }[]): {
    seriesName: string;
    tierName: string;
    summary: string;
    categoryTag: string;
} | null {
    if (plans.length < 2) return null;

    const parsed: ParsedTier[] = [];
    for (const plan of plans) {
        const name = getContentName(plan.contentId);
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

    const summary = first.tierName + ' ' + parsed.map(p => p.label).join(' ｜ ');
    const categoryTag = plans[0].contentId ? getCategoryTag(plans[0].contentId) : '';

    return { seriesName: first.seriesName, tierName: first.tierName, summary, categoryTag };
}

// ========================================
// メインハンドラ
// ========================================

export default async function handler(req: Request) {
    try {
        const { searchParams, origin } = new URL(req.url);
        const shareId = searchParams.get('id');
        const showTitle = searchParams.get('showTitle') !== 'false';
        const logoUrl = searchParams.get('logoUrl');

        let contentId: string | null = null;
        let contentName = '';
        let planTitle = '';
        let categoryTag = '';
        let bundlePlans: { contentId: string | null; title: string }[] = [];
        let isBundle = false;

        if (shareId) {
            try {
                const res = await fetch(`${origin}/api/share?id=${encodeURIComponent(shareId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.type === 'bundle' && Array.isArray(data.plans)) {
                        isBundle = true;
                        bundlePlans = data.plans.map((p: any) => ({
                            contentId: p.contentId || null,
                            title: p.title || '',
                        }));
                    } else {
                        contentId = data.contentId || null;
                        planTitle = data.title || '';
                        contentName = getContentName(contentId);
                        categoryTag = getCategoryTag(contentId);
                    }
                }
            } catch { /* デフォルト表示 */ }
        }

        // フォント取得（M PLUS 1）
        let allText = 'LoPo｜前半後半';
        if (isBundle) {
            allText += bundlePlans.map(p => getContentName(p.contentId) + (p.title || '')).join('');
            allText += `${bundlePlans.length} plans shared`;
            const series = trySeriesSummary(bundlePlans);
            if (series) allText += series.summary;
        } else {
            allText += contentName + planTitle + categoryTag;
        }
        const uniqueChars = [...new Set(allText)].join('');

        const fontCssUrl = `https://fonts.googleapis.com/css2?family=M+PLUS+1:wght@400;700;900&text=${encodeURIComponent(uniqueChars)}`;
        const fontCss = await fetch(fontCssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        }).then(r => r.text());

        const fontUrls = [...fontCss.matchAll(/src:\s*url\(([^)]+)\)/g)].map(m => m[1]);
        const fontBuffers = await Promise.all(
            fontUrls.map(url => fetch(url).then(r => r.arrayBuffer()))
        );

        const fonts: { name: string; data: ArrayBuffer; style: 'normal'; weight: 400 | 700 | 900 }[] = [];
        if (fontBuffers.length >= 3) {
            fonts.push({ name: 'M PLUS 1', data: fontBuffers[0], style: 'normal', weight: 400 });
            fonts.push({ name: 'M PLUS 1', data: fontBuffers[1], style: 'normal', weight: 700 });
            fonts.push({ name: 'M PLUS 1', data: fontBuffers[2], style: 'normal', weight: 900 });
        } else if (fontBuffers.length >= 1) {
            fonts.push({ name: 'M PLUS 1', data: fontBuffers[0], style: 'normal', weight: 700 });
        }

        // チームロゴをBase64化（タイムアウト5秒、失敗時はロゴなしで生成）
        let teamLogoSrc: string | null = null;
        const debugMode = searchParams.get('debug');
        if (logoUrl) {
            try {
                console.log('[OG] ロゴフェッチ開始:', logoUrl.substring(0, 80) + '...');
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const logoRes = await fetch(logoUrl, { signal: controller.signal });
                clearTimeout(timeout);
                console.log('[OG] ロゴフェッチ結果: status=', logoRes.status, 'ok=', logoRes.ok, 'content-type=', logoRes.headers.get('content-type'));
                if (logoRes.ok) {
                    const buf = await logoRes.arrayBuffer();
                    console.log('[OG] ロゴバッファサイズ:', buf.byteLength, 'bytes');
                    const ct = logoRes.headers.get('content-type') || 'image/jpeg';
                    teamLogoSrc = `data:${ct};base64,${arrayBufferToBase64(buf)}`;
                    console.log('[OG] ロゴbase64生成成功: data URI長=', teamLogoSrc.length, '文字');
                } else {
                    console.log('[OG] ロゴフェッチ失敗: status=', logoRes.status);
                }
            } catch (err: any) {
                console.log('[OG] ロゴフェッチ例外:', err?.name, err?.message);
            }
        }

        // ファビコンをBase64化
        const faviconUrl = new URL('/icons/favicon-512x512.png', origin).toString();
        const faviconBuffer = await fetch(faviconUrl).then(r => r.arrayBuffer());
        const faviconBase64 = `data:image/png;base64,${arrayBufferToBase64(faviconBuffer)}`;

        // デバッグ: favicon をロゴ代わりに使って Satori の大画像レンダリングを検証
        if (debugMode === 'favicon' && !teamLogoSrc) {
            teamLogoSrc = faviconBase64;
            console.log('[OG] デバッグモード: faviconをロゴ代わりに使用');
        }
        console.log('[OG] 最終 teamLogoSrc:', teamLogoSrc ? `あり (${teamLogoSrc.length}文字)` : 'なし');

        // レイアウト選択
        const element = !shareId
            ? buildFallbackLayout()
            : isBundle
                ? buildBundleLayout(bundlePlans, faviconBase64, teamLogoSrc)
                : buildSingleLayout(contentName, showTitle ? planTitle : '', categoryTag, faviconBase64, teamLogoSrc);

        return new ImageResponse(element as any, { width: 1200, height: 630, fonts });

    } catch (err: any) {
        console.error('OG image error:', err);
        return new Response(`OG image generation failed: ${err.message}`, { status: 500 });
    }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// ========================================
// フォールバック（shareIdなし）
// ========================================

function buildFallbackLayout() {
    return {
        type: 'div',
        props: {
            style: {
                width: '100%', height: '100%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#000000', fontFamily: '"M PLUS 1", sans-serif',
            },
            children: { type: 'div', props: { style: { fontSize: 200, fontWeight: 900, color: '#ffffff', letterSpacing: -4, lineHeight: 1 }, children: 'LoPo' } },
        },
    };
}

// ========================================
// 左パネル（浸食不可）
// ========================================

function buildLeftPanel(faviconBase64: string) {
    return {
        type: 'div',
        props: {
            style: {
                width: LEFT_PANEL_WIDTH, height: '100%', backgroundColor: '#030303',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRight: '1px solid #111111', position: 'relative', gap: 16, padding: '40px 0',
            },
            children: [
                // 上部装飾ライン
                { type: 'div', props: { style: { position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)', width: 1, height: 72, backgroundColor: '#1a1a1a' } } },
                // ファビコン
                { type: 'img', props: { src: faviconBase64, width: 64, height: 64, style: { borderRadius: 32 } } },
                // 縦書きLoPo
                {
                    type: 'div',
                    props: {
                        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
                        children: ['L', 'o', 'P', 'o'].map(ch => ({
                            type: 'div', props: { style: { fontSize: 28, fontWeight: 700, color: '#ffffff', lineHeight: 1 }, children: ch },
                        })),
                    },
                },
                // 下部装飾ライン
                { type: 'div', props: { style: { position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', width: 1, height: 72, backgroundColor: '#1a1a1a' } } },
            ],
        },
    };
}

// ========================================
// 右エリアの背景（ユーザー画像 or 黒）
// ========================================

function buildRightArea(faviconBase64: string, teamLogoSrc: string | null, textChildren: any[]) {
    // ロゴなし → 現行の黒背景
    if (!teamLogoSrc) {
        return {
            type: 'div',
            props: {
                style: { width: '100%', height: '100%', display: 'flex', backgroundColor: '#000000', fontFamily: '"M PLUS 1", sans-serif', position: 'relative' },
                children: [
                    buildLeftPanel(faviconBase64),
                    { type: 'div', props: { style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 72px' }, children: textChildren } },
                ],
            },
        };
    }

    // ロゴあり → img要素で背景画像 + 暗オーバーレイ + テキスト
    const RW = 1200 - LEFT_PANEL_WIDTH;
    return {
        type: 'div',
        props: {
            style: { width: '100%', height: '100%', display: 'flex', backgroundColor: '#000000', fontFamily: '"M PLUS 1", sans-serif' },
            children: [
                buildLeftPanel(faviconBase64),
                {
                    type: 'div',
                    props: {
                        style: { width: RW, height: 630, display: 'flex', position: 'relative' },
                        children: [
                            { type: 'img', props: { src: teamLogoSrc, width: RW, height: 630, style: { position: 'absolute', objectFit: 'cover' } } },
                            { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: RW, height: 630, backgroundColor: 'rgba(0,0,0,0.5)' } } },
                            { type: 'div', props: { style: { position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', padding: '56px 72px' }, children: textChildren } },
                        ],
                    },
                },
            ],
        },
    };
}

// ========================================
// 単体プラン
// ========================================

function buildSingleLayout(
    contentName: string, planTitle: string, categoryTag: string,
    faviconBase64: string, teamLogoSrc: string | null,
) {
    const displayName = contentName || planTitle || 'LoPo';
    const nameLen = displayName.length;
    const nameFontSize = nameLen > 24 ? 40 : nameLen > 16 ? 48 : 52;
    const subtitle = contentName && planTitle ? planTitle : '';

    const textChildren: any[] = [];

    // カテゴリタグ
    if (categoryTag) {
        textChildren.push({
            type: 'div', props: {
                style: {
                    fontSize: 18, fontWeight: 400, letterSpacing: 10,
                    color: '#2a2a2a', textTransform: 'uppercase', marginBottom: 32,
                },
                children: categoryTag,
            },
        });
    }

    // コンテンツ名
    textChildren.push({
        type: 'div', props: {
            style: {
                fontSize: nameFontSize, fontWeight: 900, color: '#ffffff',
                lineHeight: 1.1, marginBottom: 20, letterSpacing: -0.5,
            },
            children: displayName,
        },
    });

    // プラン名
    if (subtitle) {
        textChildren.push({
            type: 'div', props: {
                style: { fontSize: 22, letterSpacing: 1, color: '#3a3a3a' },
                children: subtitle,
            },
        });
    }

    return buildRightArea(faviconBase64, teamLogoSrc, textChildren);
}

// ========================================
// バンドル
// ========================================

function buildBundleLayout(
    plans: { contentId: string | null; title: string }[],
    faviconBase64: string, teamLogoSrc: string | null,
) {
    // 同シリーズ判定
    const series = trySeriesSummary(plans);
    if (series) {
        return buildSeriesLayout(series, faviconBase64, teamLogoSrc);
    }

    // 混在コンテンツ
    return buildMixedLayout(plans, faviconBase64, teamLogoSrc);
}

// 同シリーズまとめ表記
function buildSeriesLayout(
    series: { seriesName: string; summary: string; categoryTag: string },
    faviconBase64: string, teamLogoSrc: string | null,
) {
    const textChildren: any[] = [];

    if (series.categoryTag) {
        textChildren.push({
            type: 'div', props: {
                style: { fontSize: 18, fontWeight: 400, letterSpacing: 10, color: '#2a2a2a', textTransform: 'uppercase', marginBottom: 32 },
                children: series.categoryTag,
            },
        });
    }

    textChildren.push({
        type: 'div', props: {
            style: { fontSize: 42, fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginBottom: 20 },
            children: series.seriesName,
        },
    });

    textChildren.push({
        type: 'div', props: {
            style: { fontSize: 30, fontWeight: 700, lineHeight: 1.2, color: '#999999' },
            children: series.summary,
        },
    });

    return buildRightArea(faviconBase64, teamLogoSrc, textChildren);
}

// 混在コンテンツリスト
function buildMixedLayout(
    plans: { contentId: string | null; title: string }[],
    faviconBase64: string, teamLogoSrc: string | null,
) {
    const textChildren: any[] = [];

    textChildren.push({
        type: 'div', props: {
            style: { fontSize: 14, fontWeight: 400, letterSpacing: 10, color: '#2a2a2a', textTransform: 'uppercase', marginBottom: 24 },
            children: `${plans.length} plans shared`,
        },
    });

    // コンテンツリスト
    const itemsToShow = plans.slice(0, 5);
    const listChildren: any[] = [];

    itemsToShow.forEach((plan, i) => {
        if (i > 0) {
            listChildren.push({
                type: 'div', props: { style: { height: 1, backgroundColor: '#0a0a0a', width: '100%' } },
            });
        }

        const name = getContentName(plan.contentId) || plan.title || '';
        const shortName = plan.contentId ? plan.contentId.replace(/_p(\d+)$/, ' P$1').toUpperCase() : '';

        listChildren.push({
            type: 'div', props: {
                style: { display: 'flex', alignItems: 'center', padding: '8px 0', width: '100%' },
                children: [
                    { type: 'div', props: { style: { fontSize: 37, fontWeight: 900, lineHeight: 1.2, flex: 1, color: '#cccccc' }, children: name } },
                    ...(shortName ? [{
                        type: 'div', props: { style: { fontSize: 17, letterSpacing: 4, marginLeft: 16, color: '#2a2a2a' }, children: shortName },
                    }] : []),
                ],
            },
        });
    });

    if (plans.length > 5) {
        listChildren.push({
            type: 'div', props: { style: { fontSize: 20, color: '#333333', marginTop: 8 }, children: `+${plans.length - 5}` },
        });
    }

    textChildren.push({
        type: 'div', props: {
            style: { display: 'flex', flexDirection: 'column', width: '100%' },
            children: listChildren,
        },
    });

    return buildRightArea(faviconBase64, teamLogoSrc, textChildren);
}
