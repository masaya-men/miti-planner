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
import { getCategoryTag, getContentName, trySeriesSummary, type OgpLang } from '../../src/lib/ogpHelpers.js';

export const config = { runtime: 'edge' };

// 左パネル幅
const LEFT_PANEL_WIDTH = 144;

// ========================================
// メインハンドラ
// ========================================

export default async function handler(req: Request) {
    try {
        const { searchParams, origin } = new URL(req.url);
        const shareId = searchParams.get('id');
        const showTitle = searchParams.get('showTitle') !== 'false';
        const showLogo = searchParams.get('showLogo') === 'true';
        const lang: OgpLang = searchParams.get('lang') === 'en' ? 'en' : 'ja';

        let contentId: string | null = null;
        let contentName = '';
        let planTitle = '';
        let categoryTag = '';
        let bundlePlans: { contentId: string | null; title: string }[] = [];
        let isBundle = false;
        let logoBase64FromShare: string | null = null;

        if (shareId) {
            try {
                const res = await fetch(`${origin}/api/share?id=${encodeURIComponent(shareId)}`);
                if (res.ok) {
                    const data = await res.json();
                    // 共有データに埋め込まれたロゴを取得
                    if (data.logoBase64) logoBase64FromShare = data.logoBase64;

                    if (data.type === 'bundle' && Array.isArray(data.plans)) {
                        isBundle = true;
                        bundlePlans = data.plans.map((p: any) => ({
                            contentId: p.contentId || null,
                            title: p.title || '',
                        }));
                    } else {
                        contentId = data.contentId || null;
                        planTitle = data.title || '';
                        contentName = getContentName(contentId, lang);
                        categoryTag = getCategoryTag(contentId);
                    }
                }
            } catch { /* デフォルト表示 */ }
        }

        // フォント取得（M PLUS 1）
        let allText = 'LoPo｜前半後半';
        if (isBundle) {
            allText += bundlePlans.map(p => getContentName(p.contentId, lang) + (p.title || '')).join('');
            allText += lang === 'en' ? `${bundlePlans.length} plans shared` : `${bundlePlans.length}件の軽減プラン`;
            const series = trySeriesSummary(bundlePlans, lang);
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

        // チームロゴ: 共有データに埋め込まれたbase64を使用（showLogoフラグで制御）
        const teamLogoSrc = (showLogo && logoBase64FromShare) ? logoBase64FromShare : null;

        // ファビコンをBase64化
        const faviconUrl = new URL('/icons/favicon-512x512.png', origin).toString();
        const faviconBuffer = await fetch(faviconUrl).then(r => r.arrayBuffer());
        const faviconBase64 = `data:image/png;base64,${arrayBufferToBase64(faviconBuffer)}`;

        // レイアウト選択
        const element = !shareId
            ? buildFallbackLayout()
            : isBundle
                ? buildBundleLayout(bundlePlans, faviconBase64, teamLogoSrc, lang)
                : buildSingleLayout(contentName, showTitle ? planTitle : '', categoryTag, faviconBase64, teamLogoSrc);

        return new ImageResponse(element as any, { width: 1200, height: 630, fonts });

    } catch (err: any) {
        console.error('OG image error:', err);
        console.error('OG image error detail:', err.message);
        return new Response('OG image generation failed', { status: 500 });
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
    const hasLogo = !!teamLogoSrc;

    const textChildren: any[] = [];

    // カテゴリタグ
    if (categoryTag) {
        textChildren.push({
            type: 'div', props: {
                style: {
                    fontSize: 18, fontWeight: 400, letterSpacing: 10,
                    color: hasLogo ? 'rgba(255,255,255,0.5)' : '#2a2a2a',
                    textTransform: 'uppercase', marginBottom: 32,
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
                style: { fontSize: 22, letterSpacing: 1, color: hasLogo ? 'rgba(255,255,255,0.45)' : '#3a3a3a' },
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
    faviconBase64: string, teamLogoSrc: string | null, lang: OgpLang,
) {
    // 同シリーズ判定
    const series = trySeriesSummary(plans, lang);
    if (series) {
        return buildSeriesLayout(series, faviconBase64, teamLogoSrc);
    }

    // 混在コンテンツ
    return buildMixedLayout(plans, faviconBase64, teamLogoSrc, lang);
}

// 同シリーズまとめ表記
function buildSeriesLayout(
    series: { seriesName: string; summary: string; categoryTag: string },
    faviconBase64: string, teamLogoSrc: string | null,
) {
    const hasLogo = !!teamLogoSrc;
    const textChildren: any[] = [];

    if (series.categoryTag) {
        textChildren.push({
            type: 'div', props: {
                style: { fontSize: 18, fontWeight: 400, letterSpacing: 10, color: hasLogo ? 'rgba(255,255,255,0.5)' : '#2a2a2a', textTransform: 'uppercase', marginBottom: 32 },
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
            style: { fontSize: 30, fontWeight: 700, lineHeight: 1.2, color: hasLogo ? 'rgba(255,255,255,0.7)' : '#999999' },
            children: series.summary,
        },
    });

    return buildRightArea(faviconBase64, teamLogoSrc, textChildren);
}

// 混在コンテンツリスト
function buildMixedLayout(
    plans: { contentId: string | null; title: string }[],
    faviconBase64: string, teamLogoSrc: string | null, lang: OgpLang,
) {
    const hasLogo = !!teamLogoSrc;
    const textChildren: any[] = [];

    textChildren.push({
        type: 'div', props: {
            style: { fontSize: 14, fontWeight: 400, letterSpacing: 10, color: hasLogo ? 'rgba(255,255,255,0.5)' : '#2a2a2a', textTransform: 'uppercase', marginBottom: 24 },
            children: lang === 'en' ? `${plans.length} plans shared` : `${plans.length}件の軽減プラン`,
        },
    });

    // コンテンツリスト
    const itemsToShow = plans.slice(0, 5);
    const listChildren: any[] = [];

    itemsToShow.forEach((plan, i) => {
        if (i > 0) {
            listChildren.push({
                type: 'div', props: { style: { height: 1, backgroundColor: hasLogo ? 'rgba(255,255,255,0.1)' : '#0a0a0a', width: '100%' } },
            });
        }

        const name = getContentName(plan.contentId, lang) || plan.title || '';
        const shortName = plan.contentId ? plan.contentId.replace(/_p(\d+)$/, ' P$1').toUpperCase() : '';

        listChildren.push({
            type: 'div', props: {
                style: { display: 'flex', alignItems: 'center', padding: '8px 0', width: '100%' },
                children: [
                    { type: 'div', props: { style: { fontSize: 37, fontWeight: 900, lineHeight: 1.2, flex: 1, color: hasLogo ? '#ffffff' : '#cccccc' }, children: name } },
                    ...(shortName ? [{
                        type: 'div', props: { style: { fontSize: 17, letterSpacing: 4, marginLeft: 16, color: hasLogo ? 'rgba(255,255,255,0.4)' : '#2a2a2a' }, children: shortName },
                    }] : []),
                ],
            },
        });
    });

    if (plans.length > 5) {
        listChildren.push({
            type: 'div', props: { style: { fontSize: 20, color: hasLogo ? 'rgba(255,255,255,0.4)' : '#333333', marginTop: 8 }, children: `+${plans.length - 5}` },
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
