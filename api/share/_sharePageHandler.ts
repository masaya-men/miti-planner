/**
 * 共有ページHTML返却ハンドラー
 *
 * /share/:id へのアクセスを受けて、動的OGPメタタグ付きHTMLを返す。
 * - クローラー: OGPメタタグを読み取ってカード表示
 * - 通常ユーザー: SPAのindex.htmlを返してReact Routerで表示
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getContentName, buildOgImageUrl, type OgpLang } from '../../src/lib/ogpHelpers.js';

const COLLECTION = 'shared_plans';

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
    let ogImageUrl = '/api/og';
    let lang: OgpLang = 'ja';

    try {
        if (shareId) {
            initAdmin();
            const db = getFirestore();
            const snap = await db.collection(COLLECTION).doc(shareId).get();

            if (snap.exists) {
                const data = snap.data()!;
                lang = data.lang === 'en' ? 'en' : 'ja';

                // バンドル共有
                if (data.type === 'bundle' && Array.isArray(data.plans)) {
                    const names = data.plans
                        .map((p: any) => getContentName(p.contentId, lang) || p.title || '')
                        .filter(Boolean);
                    if (names.length > 0) {
                        ogTitle = `${names.join(' / ')} - LoPo`;
                        ogDescription = lang === 'en'
                            ? `${names.length} mitigation plans`
                            : `${names.length}件の軽減プラン`;
                    }
                } else {
                    // 単一プラン
                    const contentName = getContentName(data.contentId, lang);
                    const planTitle = data.title || '';

                    if (contentName) {
                        ogTitle = `${contentName} - LoPo`;
                        ogDescription = lang === 'en'
                            ? (planTitle ? `${planTitle} | Mitigation plan for ${contentName}` : `Mitigation plan for ${contentName}`)
                            : (planTitle ? `${planTitle} | ${contentName} の軽減プラン` : `${contentName} の軽減プラン`);
                    } else if (planTitle) {
                        ogTitle = `${planTitle} - LoPo`;
                        ogDescription = lang === 'en'
                            ? `Mitigation plan: ${planTitle}`
                            : `${planTitle} の軽減プラン`;
                    }
                }

                const ogAllowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173'];
                const ogPreviewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
                const ogRawHost = req.headers.host || 'lopoly.app';
                const ogHost = ogAllowedHosts.find(h => ogRawHost.includes(h))
                    || (ogPreviewPattern.test(ogRawHost) ? ogRawHost : null)
                    || 'lopoly.app';
                const ogProtocol = ogHost.includes('localhost') ? 'http' : 'https';
                const hasLogo = typeof data.logoBase64 === 'string' && data.logoBase64.length > 0;
                // showTitle は POST/PUT で永続化された値を読む。未設定は true（デフォルト）扱い。
                const showTitleState = typeof data.showTitle === 'boolean' ? data.showTitle : true;
                // 共通ビルダーで URL を生成。クライアント（ShareModal）、/api/share のプリウォーム、
                // このサーバー OGP メタタグの3箇所で同じ関数を使うことで
                // Vercel edge cache キーが完全一致する。
                ogImageUrl = buildOgImageUrl(`${ogProtocol}://${ogHost}`, shareId, {
                    showTitle: showTitleState,
                    showLogo: hasLogo,
                    lang,
                });
            }
        }
    } catch (err) {
        console.error('Share page data fetch error:', err);
    }

    // ビルド済みindex.htmlを取得してメタタグを差し替え
    try {
        // 自サイトのホスト名を固定（hostヘッダー偽装対策）
        const allowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
        const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
        const rawHost = req.headers.host || 'lopoly.app';
        const host = allowedHosts.find(h => rawHost.includes(h))
            || (previewPattern.test(rawHost) ? rawHost : null)
            || 'lopoly.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const indexRes = await fetch(`${protocol}://${host}/index.html`);

        if (indexRes.ok) {
            let html = await indexRes.text();

            // 共有ページの正規 URL（OGP の og:url を共有 URL に正しく差し替え）
            const sharePageUrl = shareId ? `${protocol}://${host}/share/${encodeURIComponent(shareId)}` : `${protocol}://${host}`;

            html = html
                .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(ogTitle)}</title>`)
                .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`)
                .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`)
                .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(sharePageUrl)}" />`)
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
<html lang="${lang}">
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
