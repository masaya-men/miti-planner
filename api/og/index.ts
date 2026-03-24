/**
 * Vercel Edge Function — OGP画像生成
 *
 * GET /api/og?id=shareId — 共有プランのOGPカード画像(1200×630)を動的生成
 * Edge Runtimeで動作し、共有データはshare APIからHTTPで取得する
 */

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// コンテンツID→日本語名マッピング
const CONTENT_NAMES: Record<string, string> = {
    m9s: '至天の座アルカディア零式：ヘビー級1',
    m10s: '至天の座アルカディア零式：ヘビー級2',
    m11s: '至天の座アルカディア零式：ヘビー級3',
    m12s_p1: '至天の座アルカディア零式：ヘビー級4（前半）',
    m12s_p2: '至天の座アルカディア零式：ヘビー級4（後半）',
    m5s: '至天の座アルカディア零式：クルーザー級1',
    m6s: '至天の座アルカディア零式：クルーザー級2',
    m7s: '至天の座アルカディア零式：クルーザー級3',
    m8s: '至天の座アルカディア零式：クルーザー級4',
    m1s: '至天の座アルカディア零式：ライトヘビー級1',
    m2s: '至天の座アルカディア零式：ライトヘビー級2',
    m3s: '至天の座アルカディア零式：ライトヘビー級3',
    m4s: '至天の座アルカディア零式：ライトヘビー級4',
    fru: '絶エデン',
    dsr_p1: '絶竜詩戦争 P1',
    dsr_p2: '絶竜詩戦争 P2',
    dsr_p3: '絶竜詩戦争 P3',
    dsr_p4: '絶竜詩戦争 P4',
    dsr_p5: '絶竜詩戦争 P5',
    dsr_p6: '絶竜詩戦争 P6',
    dsr_p7: '絶竜詩戦争 P7',
    tea: '絶アレキサンダー',
    ucob: '絶バハムート',
    uwu: '絶アルテマウェポン',
};

export default async function handler(req: Request) {
    try {
        const { searchParams, origin } = new URL(req.url);
        const shareId = searchParams.get('id');

        let contentName = '';
        let planTitle = '';

        // バンドル時は複数コンテンツ名を表示
        let bundleNames: string[] = [];

        if (shareId) {
            try {
                const res = await fetch(`${origin}/api/share?id=${encodeURIComponent(shareId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.type === 'bundle' && Array.isArray(data.plans)) {
                        bundleNames = data.plans
                            .map((p: any) => CONTENT_NAMES[p.contentId] || p.title || '')
                            .filter(Boolean);
                    } else {
                        planTitle = data.title || '';
                        contentName = CONTENT_NAMES[data.contentId] || '';
                    }
                }
            } catch {
                // データ取得失敗時はデフォルト表示
            }
        }

        let displayTitle: string;
        let subtitle = '';

        if (bundleNames.length > 0) {
            // バンドル: 共通シリーズ名があればまとめて表示
            displayTitle = bundleNames.join('\n');
            if (bundleNames.length > 3) {
                displayTitle = bundleNames.slice(0, 3).join('\n') + `\n+${bundleNames.length - 3}`;
            }
        } else {
            displayTitle = contentName || planTitle || 'LoPo';
            subtitle = contentName && planTitle ? planTitle : '';
        }

        // 表示テキストに必要な文字だけフォントを取得（日本語サブセット）
        const allText = (bundleNames.length > 0 ? bundleNames.join('') : displayTitle) + subtitle + 'LoPoFF14軽減プランナー';
        const uniqueChars = [...new Set(allText)].join('');
        const fontCssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&text=${encodeURIComponent(uniqueChars)}`;
        const fontCss = await fetch(fontCssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        }).then(r => r.text());

        // CSSからフォントURL抽出
        const fontUrls = [...fontCss.matchAll(/src:\s*url\(([^)]+)\)/g)].map(m => m[1]);
        const fontBuffers = await Promise.all(
            fontUrls.map(url => fetch(url).then(r => r.arrayBuffer()))
        );

        const fonts: { name: string; data: ArrayBuffer; style: 'normal'; weight: 400 | 700 }[] = [];
        if (fontBuffers.length >= 2) {
            fonts.push({ name: 'Noto Sans JP', data: fontBuffers[0], style: 'normal', weight: 400 });
            fonts.push({ name: 'Noto Sans JP', data: fontBuffers[1], style: 'normal', weight: 700 });
        } else if (fontBuffers.length === 1) {
            fonts.push({ name: 'Noto Sans JP', data: fontBuffers[0], style: 'normal', weight: 700 });
        }

        // Satoriはプレーンオブジェクト { type, props } を受け付ける
        const children: any[] = [
            {
                type: 'div',
                props: {
                    style: { fontSize: 28, color: '#555', letterSpacing: 6, fontWeight: 400, marginBottom: 20 },
                    children: 'LoPo',
                },
            },
            {
                type: 'div',
                props: {
                    style: { width: 100, height: 1, backgroundColor: '#333', marginBottom: 36 },
                },
            },
        ];

        if (bundleNames.length > 0) {
            // バンドル: 各コンテンツ名を縦並びで表示
            const fontSize = bundleNames.length > 4 ? 28 : bundleNames.length > 2 ? 34 : 40;
            const namesToShow = bundleNames.slice(0, 5);
            children.push({
                type: 'div',
                props: {
                    style: {
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: 1000,
                    },
                    children: namesToShow.map((name: string) => ({
                        type: 'div',
                        props: {
                            style: { fontSize, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.3 },
                            children: name,
                        },
                    })),
                },
            });
            if (bundleNames.length > 5) {
                children.push({
                    type: 'div',
                    props: {
                        style: { fontSize: 22, color: '#777', marginTop: 8 },
                        children: `+${bundleNames.length - 5}`,
                    },
                });
            }
        } else {
            const titleFontSize = displayTitle.length > 24 ? 38 : displayTitle.length > 16 ? 46 : 54;
            children.push({
                type: 'div',
                props: {
                    style: {
                        fontSize: titleFontSize, fontWeight: 700, color: '#fff',
                        textAlign: 'center', lineHeight: 1.35, maxWidth: 1000,
                    },
                    children: displayTitle,
                },
            });
        }

        if (subtitle) {
            children.push({
                type: 'div',
                props: {
                    style: { fontSize: 22, color: '#777', marginTop: 14, textAlign: 'center', fontWeight: 400 },
                    children: subtitle,
                },
            });
        }

        children.push({
            type: 'div',
            props: {
                style: { position: 'absolute', bottom: 36, fontSize: 17, color: '#444', fontWeight: 400 },
                children: 'FF14 軽減プランナー',
            },
        });

        const element = {
            type: 'div',
            props: {
                style: {
                    width: '100%', height: '100%', display: 'flex',
                    flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    backgroundColor: '#0a0a0a', padding: '60px 80px',
                    fontFamily: '"Noto Sans JP", sans-serif', position: 'relative',
                },
                children,
            },
        };

        return new ImageResponse(element as any, { width: 1200, height: 630, fonts });

    } catch (err: any) {
        console.error('OG image error:', err);
        return new Response(`OG image generation failed: ${err.message}`, { status: 500 });
    }
}
