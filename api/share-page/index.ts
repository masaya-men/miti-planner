/**
 * Vercel Serverless Function — 共有ページHTML返却
 *
 * /share/:id へのアクセスを受けて、動的OGPメタタグ付きHTMLを返す。
 * - クローラー: OGPメタタグを読み取ってカード表示
 * - 通常ユーザー: SPAのindex.htmlを返してReact Routerで表示
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COLLECTION = 'shared_plans';

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
    dsr_p1: '絶竜詩戦争 P1', dsr_p2: '絶竜詩戦争 P2', dsr_p3: '絶竜詩戦争 P3',
    dsr_p4: '絶竜詩戦争 P4', dsr_p5: '絶竜詩戦争 P5', dsr_p6: '絶竜詩戦争 P6',
    dsr_p7: '絶竜詩戦争 P7',
    tea: '絶アレキサンダー',
    ucob: '絶バハムート',
    uwu: '絶アルテマウェポン',
};

function initAdmin() {
    if (!getApps().length) {
        let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
        if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
        pk = pk.replace(/\\n/g, '\n');
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID!,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
                privateKey: pk,
            }),
        });
    }
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req: any, res: any) {
    const shareId = (req.query.id as string) || '';

    let ogTitle = 'LoPo | FF14 軽減プランナー';
    let ogDescription = 'FF14の軽減プランをサクサク作れるウェブアプリ。FFLogsから自動生成されたタイムラインで、最適な軽減配置を。';
    let ogImageUrl = '/icons/logo.png';

    try {
        if (shareId) {
            initAdmin();
            const db = getFirestore();
            const snap = await db.collection(COLLECTION).doc(shareId).get();

            if (snap.exists) {
                const data = snap.data()!;

                // バンドル共有
                if (data.type === 'bundle' && Array.isArray(data.plans)) {
                    const names = data.plans
                        .map((p: any) => CONTENT_NAMES[p.contentId] || p.title || '')
                        .filter(Boolean);
                    if (names.length > 0) {
                        ogTitle = `${names.join(' / ')} - LoPo`;
                        ogDescription = `${names.length}件の軽減プラン`;
                    }
                } else {
                    // 単一プラン
                    const contentName = CONTENT_NAMES[data.contentId] || '';
                    const planTitle = data.title || '';

                    if (contentName) {
                        ogTitle = `${contentName} - LoPo`;
                        ogDescription = planTitle
                            ? `${planTitle} | ${contentName} の軽減プラン`
                            : `${contentName} の軽減プラン`;
                    } else if (planTitle) {
                        ogTitle = `${planTitle} - LoPo`;
                        ogDescription = `${planTitle} の軽減プラン`;
                    }
                }

                const host = req.headers.host || 'lopo-eta.vercel.app';
                const protocol = host.includes('localhost') ? 'http' : 'https';
                ogImageUrl = `${protocol}://${host}/api/og?id=${encodeURIComponent(shareId)}`;
            }
        }
    } catch (err) {
        console.error('Share page data fetch error:', err);
    }

    // ビルド済みindex.htmlを取得してメタタグを差し替え
    try {
        const host = req.headers.host || 'lopo-eta.vercel.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const indexRes = await fetch(`${protocol}://${host}/index.html`);

        if (indexRes.ok) {
            let html = await indexRes.text();

            html = html
                .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(ogTitle)}</title>`)
                .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`)
                .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`)
                .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`)
                .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`)
                .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`)
                .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`);

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
            return res.send(html);
        }
    } catch (err) {
        console.error('Index.html fetch error:', err);
    }

    // フォールバック: 最小限のOGP HTMLを返す
    const safeTitle = escapeHtml(ogTitle);
    const safeDesc = escapeHtml(ogDescription);
    const safeImg = escapeHtml(ogImageUrl);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${safeTitle}</title>
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${safeImg}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDesc}" />
<meta name="twitter:image" content="${safeImg}" />
</head>
<body>
<div id="root"></div>
<p style="text-align:center;margin-top:40vh;color:#888">読み込み中...</p>
</body>
</html>`);
}
