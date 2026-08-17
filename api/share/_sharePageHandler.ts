/**
 * 共有ページHTML返却ハンドラー
 *
 * /share/:id へのアクセスを受けて、動的OGPメタタグ付きHTMLを返す。
 * - クローラー: OGPメタタグ + 可視テキストスナップショットを読み取る
 * - 通常ユーザー: SPAのindex.htmlを返してReact Routerで表示 (即 /miti へ遷移)
 * - 共有が存在しない (期限切れ/削除済み/不正ID) 場合は真の404を返す (ソフト404対策)。
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getContentName, buildOgImageUrl, type OgpLang } from '../../src/lib/ogpHelpers.js';
import { escapeHtml, injectSeoSnapshot } from '../../src/lib/ogpPageShell.js';

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

/** 共有プランページのSEOスナップショット (Googlebot向けに<div id="root">へ埋め込む可視テキスト)。 */
export function buildSharePageSeoSnapshotHtml(ogTitle: string, ogDescription: string): string {
    return `<h1>${escapeHtml(ogTitle)}</h1><p>${escapeHtml(ogDescription)}</p>`;
}

export default async function handler(req: any, res: any) {
    const shareId = (req.query.id as string) || '';

    let ogTitle = 'LoPo | FF14 軽減プランナー';
    let ogDescription = 'FF14の軽減プランをサクサク作れるウェブアプリ。FFLogsから自動生成されたタイムラインで、最適な軽減配置を。';
    let ogImageUrl = '/api/og';
    let lang: OgpLang = 'ja';
    let httpStatus = 200;
    let found = false;

    try {
        if (shareId) {
            initAdmin();
            const db = getFirestore();
            const snap = await db.collection(COLLECTION).doc(shareId).get();

            if (snap.exists) {
                found = true;
                const data = snap.data()!;
                lang = data.lang === 'en' ? 'en' : 'ja';

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
                const logoHashStr = typeof data.logoHash === 'string' ? data.logoHash : undefined;

                const imageHashFromDoc = typeof data.imageHash === 'string' ? data.imageHash : '';
                if (/^[a-f0-9]{16}$/.test(imageHashFromDoc)) {
                    ogImageUrl = `${ogProtocol}://${ogHost}/og/${imageHashFromDoc}.png`;
                } else {
                    ogImageUrl = buildOgImageUrl(`${ogProtocol}://${ogHost}`, shareId, {
                        showLogo: hasLogo,
                        logoHash: hasLogo ? logoHashStr : undefined,
                        lang,
                    });
                }
            }
        }
    } catch (err) {
        console.error('Share page data fetch error:', err);
    }

    if (!found) httpStatus = 404;
    const seoSnapshotHtml = found ? buildSharePageSeoSnapshotHtml(ogTitle, ogDescription) : '';

    try {
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
            if (seoSnapshotHtml) html = injectSeoSnapshot(html, seoSnapshotHtml);

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
            res.status(httpStatus);
            return res.send(html);
        }
    } catch (err) {
        console.error('Index.html fetch error:', err);
    }

    const safeTitle = escapeHtml(ogTitle);
    const safeDesc = escapeHtml(ogDescription);
    const safeImg = escapeHtml(ogImageUrl);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(httpStatus);
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
<div id="root">${seoSnapshotHtml}</div>
</body>
</html>`);
}
