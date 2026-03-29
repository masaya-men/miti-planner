/**
 * Vercel Edge Function — OGP画像生成（P3デザイン）
 *
 * GET /api/og?id=shareId — 共有プランのOGPカード画像(1200x630)を動的生成
 * Edge Runtimeで動作し、共有データはshare APIからHTTPで取得する
 *
 * デザイン: P3（ブドウ上 + 縦書きLoPo下 + 上下装飾ライン）
 * - 左パネル（72px幅）: 装飾ライン + ブドウロゴ + 縦書きLoPo
 * - 右パネル: カテゴリタグ + コンテンツ名（大・scaleY 0.85）+ プラン名（小）
 * - 白いアクセントライン（左下）
 * - バンドル: 同じ左パネル + 番号付きリスト
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

        // フォント取得（M PLUS 1 + Rajdhani相当の文字サブセット）
        let allText = 'LoPo';
        if (isBundle) {
            allText += bundlePlans.map(p => getContentName(p.contentId) + (p.title || '')).join('');
            allText += `${bundlePlans.length} plans shared`;
        } else {
            allText += contentName + planTitle + categoryTag;
        }
        const uniqueChars = [...new Set(allText)].join('');

        // M PLUS 1 フォント（アプリと統一）
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

        // チームロゴをBase64化（指定がある場合のみ）
        let teamLogoBase64: string | null = null;
        if (logoUrl) {
            try {
                const logoRes = await fetch(logoUrl);
                if (logoRes.ok) {
                    const buf = await logoRes.arrayBuffer();
                    const contentType = logoRes.headers.get('content-type') || 'image/webp';
                    teamLogoBase64 = `data:${contentType};base64,${arrayBufferToBase64(buf)}`;
                }
            } catch {
                // ロゴ取得失敗はスキップ（ロゴなしで生成）
            }
        }

        // ブドウロゴをBase64化（SVG優先、フォールバックでPNG）
        let logoBase64: string;
        try {
            const svgUrl = new URL('/grape.svg', origin).toString();
            const svgText = await fetch(svgUrl).then(r => r.text());
            const encoded = new TextEncoder().encode(svgText);
            let binary = '';
            for (let i = 0; i < encoded.length; i++) binary += String.fromCharCode(encoded[i]);
            logoBase64 = `data:image/svg+xml;base64,${btoa(binary)}`;
        } catch {
            const logoUrl = new URL('/icons/favicon-512x512.png', origin).toString();
            const logoBuffer = await fetch(logoUrl).then(r => r.arrayBuffer());
            logoBase64 = `data:image/png;base64,${arrayBufferToBase64(logoBuffer)}`;
        }

        // shareIdがない場合はGitHub式のシンプルなフォールバック
        const element = !shareId
            ? buildFallbackLayout()
            : isBundle
                ? buildBundleLayout(bundlePlans, logoBase64, teamLogoBase64)
                : buildSingleLayout(contentName, showTitle ? planTitle : '', categoryTag, logoBase64, teamLogoBase64);

        return new ImageResponse(element as any, { width: 1200, height: 630, fonts });

    } catch (err: any) {
        console.error('OG image error:', err);
        return new Response(`OG image generation failed: ${err.message}`, { status: 500 });
    }
}

// GitHub式フォールバック: 黒背景 + 中央に「LoPo」だけ
function buildFallbackLayout() {
    return {
        type: 'div',
        props: {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000000',
                fontFamily: '"M PLUS 1", sans-serif',
            },
            children: {
                type: 'div',
                props: {
                    style: {
                        fontSize: 200,
                        fontWeight: 900,
                        color: '#ffffff',
                        letterSpacing: -4,
                        lineHeight: 1,
                    },
                    children: 'LoPo',
                },
            },
        },
    };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// P3デザイン: 左パネル（72px）+ 上下装飾ライン + ブドウ + 縦書きLoPo
const LEFT_PANEL_WIDTH = 144; // 1200px版（プレビューの72px × 2倍）

function buildLeftPanel(logoBase64: string) {
    return {
        type: 'div',
        props: {
            style: {
                width: LEFT_PANEL_WIDTH,
                height: '100%',
                backgroundColor: '#030303',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRight: '1px solid #0e0e0e',
                position: 'relative',
                gap: 16,
                padding: '40px 0',
            },
            children: [
                // 上部の装飾ライン
                {
                    type: 'div',
                    props: {
                        style: {
                            position: 'absolute',
                            top: 32,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 1,
                            height: 72,
                            backgroundColor: '#1a1a1a',
                        },
                    },
                },
                // ブドウロゴ（SVGなのでinvert不要）
                {
                    type: 'img',
                    props: {
                        src: logoBase64,
                        width: 64,
                        height: 64,
                        style: {
                            opacity: 0.95,
                        },
                    },
                },
                // 縦書きLoPo（1文字ずつ縦に並べる — Satoriはwriting-mode未対応）
                {
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                        },
                        children: ['L', 'o', 'P', 'o'].map(ch => ({
                            type: 'div',
                            props: {
                                style: {
                                    fontSize: 28,
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    lineHeight: 1,
                                    letterSpacing: 0,
                                },
                                children: ch,
                            },
                        })),
                    },
                },
                // 下部の装飾ライン
                {
                    type: 'div',
                    props: {
                        style: {
                            position: 'absolute',
                            bottom: 32,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 1,
                            height: 72,
                            backgroundColor: '#1a1a1a',
                        },
                    },
                },
            ],
        },
    };
}

function buildSingleLayout(
    contentName: string,
    planTitle: string,
    categoryTag: string,
    logoBase64: string,
    teamLogoBase64: string | null,
) {
    const nameLen = contentName.length || planTitle.length || 4;
    const nameFontSize = nameLen > 24 ? 40 : nameLen > 16 ? 48 : 52;
    const displayName = contentName || planTitle || 'LoPo';
    const subtitle = contentName && planTitle ? planTitle : '';

    const rightChildren: any[] = [];

    // カテゴリタグ
    if (categoryTag) {
        rightChildren.push({
            type: 'div',
            props: {
                style: {
                    fontSize: 18,
                    fontWeight: 400,
                    letterSpacing: 10,
                    color: '#2a2a2a',
                    textTransform: 'uppercase',
                    marginBottom: 32,
                },
                children: categoryTag,
            },
        });
    }

    // コンテンツ名（scaleY 0.85 で横つぶし — Satoriではtransform未対応のためlineHeight調整で近似）
    rightChildren.push({
        type: 'div',
        props: {
            style: {
                fontSize: nameFontSize,
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.1,
                marginBottom: 20,
                letterSpacing: -0.5,
            },
            children: displayName,
        },
    });

    // プラン名
    if (subtitle) {
        rightChildren.push({
            type: 'div',
            props: {
                style: {
                    fontSize: 22,
                    color: '#3a3a3a',
                    letterSpacing: 1,
                },
                children: subtitle,
            },
        });
    }

    return {
        type: 'div',
        props: {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                backgroundColor: '#000000',
                fontFamily: '"M PLUS 1", sans-serif',
                position: 'relative',
            },
            children: [
                buildLeftPanel(logoBase64),
                {
                    type: 'div',
                    props: {
                        style: {
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            padding: '56px 72px',
                        },
                        children: rightChildren,
                    },
                },
                // 白いアクセントライン（左下）
                {
                    type: 'div',
                    props: {
                        style: {
                            position: 'absolute',
                            bottom: 0,
                            left: LEFT_PANEL_WIDTH,
                            width: 96,
                            height: 2,
                            backgroundColor: '#ffffff',
                        },
                    },
                },
                // チームロゴ（右上）
                ...(teamLogoBase64 ? [{
                    type: 'div',
                    props: {
                        style: {
                            position: 'absolute',
                            top: 24,
                            right: 24,
                            width: 80,
                            height: 80,
                            borderRadius: 12,
                            overflow: 'hidden',
                            border: '2px solid rgba(255,255,255,0.15)',
                        },
                        children: {
                            type: 'img',
                            props: {
                                src: teamLogoBase64,
                                width: 80,
                                height: 80,
                                style: {
                                    objectFit: 'cover',
                                },
                            },
                        },
                    },
                }] : []),
            ],
        },
    };
}

function buildBundleLayout(
    plans: { contentId: string | null; title: string }[],
    logoBase64: string,
    teamLogoBase64: string | null,
) {
    const itemsToShow = plans.slice(0, 5);
    const itemChildren: any[] = [];

    itemsToShow.forEach((plan, i) => {
        if (i > 0) {
            itemChildren.push({
                type: 'div',
                props: {
                    style: { height: 1, backgroundColor: '#0a0a0a', width: '100%' },
                },
            });
        }

        const name = getContentName(plan.contentId) || plan.title || '';
        const shortName = plan.contentId
            ? plan.contentId.replace(/_p(\d+)$/, ' P$1').toUpperCase()
            : '';

        itemChildren.push({
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 0',
                    width: '100%',
                },
                children: [
                    {
                        type: 'div',
                        props: {
                            style: {
                                fontSize: 20,
                                fontWeight: 400,
                                color: '#222222',
                                minWidth: 40,
                                textAlign: 'right',
                                marginRight: 20,
                            },
                            children: String(i + 1).padStart(2, '0'),
                        },
                    },
                    {
                        type: 'div',
                        props: {
                            style: {
                                fontSize: 30,
                                fontWeight: 700,
                                color: '#cccccc',
                                lineHeight: 1.1,
                                flex: 1,
                            },
                            children: name,
                        },
                    },
                    ...(shortName ? [{
                        type: 'div',
                        props: {
                            style: {
                                fontSize: 18,
                                color: '#2a2a2a',
                                letterSpacing: 2,
                                marginLeft: 16,
                            },
                            children: shortName,
                        },
                    }] : []),
                ],
            },
        });
    });

    if (plans.length > 5) {
        itemChildren.push({
            type: 'div',
            props: {
                style: { fontSize: 20, color: '#333333', marginTop: 8 },
                children: `+${plans.length - 5}`,
            },
        });
    }

    return {
        type: 'div',
        props: {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                backgroundColor: '#000000',
                fontFamily: '"M PLUS 1", sans-serif',
                position: 'relative',
            },
            children: [
                buildLeftPanel(logoBase64),
                {
                    type: 'div',
                    props: {
                        style: {
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            padding: '40px 60px',
                        },
                        children: [
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        fontSize: 18,
                                        fontWeight: 400,
                                        letterSpacing: 10,
                                        color: '#2a2a2a',
                                        textTransform: 'uppercase',
                                        marginBottom: 24,
                                    },
                                    children: `${plans.length} plans shared`,
                                },
                            },
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        width: '100%',
                                    },
                                    children: itemChildren,
                                },
                            },
                        ],
                    },
                },
                {
                    type: 'div',
                    props: {
                        style: {
                            position: 'absolute',
                            bottom: 0,
                            left: LEFT_PANEL_WIDTH,
                            width: 96,
                            height: 2,
                            backgroundColor: '#ffffff',
                        },
                    },
                },
                // チームロゴ（右上）
                ...(teamLogoBase64 ? [{
                    type: 'div',
                    props: {
                        style: {
                            position: 'absolute',
                            top: 24,
                            right: 24,
                            width: 80,
                            height: 80,
                            borderRadius: 12,
                            overflow: 'hidden',
                            border: '2px solid rgba(255,255,255,0.15)',
                        },
                        children: {
                            type: 'img',
                            props: {
                                src: teamLogoBase64,
                                width: 80,
                                height: 80,
                                style: {
                                    objectFit: 'cover',
                                },
                            },
                        },
                    },
                }] : []),
            ],
        },
    };
}
