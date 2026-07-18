/**
 * ツアー招待ページ (/housing/tour/:tourToken) 動的OGPハンドラー
 * _housingerPageHandler.ts と同じ仕組み(クローラーにはOGPメタ入りHTML、通常ユーザーには
 * 同じHTML内の <div id="root"> 経由で React Router が SPA を描画する)。vercel.json の
 * rewrite で /housing/tour/:tourToken → /api/share?type=tour&token=:tourToken に内部委譲される。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { buildTourInviteOgCardParams } from '../../src/lib/ogpTourInviteCard.js';
import { computeOgCardImageHash } from '../../src/lib/ogpImageHash.js';
import { SHARED_TOUR_NAME_MAX_LENGTH } from '../../src/types/sharedTour.js';

const DEFAULT_OG_TITLE = 'LoPo Housing Tour';
const DEFAULT_OG_DESCRIPTION = 'FF14のハウジングを巡るツアーに招待されました。リンクを開くと幹事と同じ景色を一緒に見られます。';
const DEFAULT_OG_IMAGE = '/api/og?type=tour';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req: any, res: any) {
  const rawToken = (req.query?.token as string) || '';

  let ogTitle = DEFAULT_OG_TITLE;
  const ogDescription = DEFAULT_OG_DESCRIPTION;
  let ogImageUrl: string = DEFAULT_OG_IMAGE;

  const allowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
  const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
  const rawHost = req.headers?.host || 'lopoly.app';
  const host = allowedHosts.find((h) => rawHost.includes(h))
    || (previewPattern.test(rawHost) ? rawHost : null)
    || 'lopoly.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  try {
    if (rawToken) {
      initAdmin();
      const db = getAdminFirestore();
      const snap = await db.collection('shared_tours').doc(rawToken).get();
      if (snap.exists) {
        const data = snap.data()!;
        const tourName: string = typeof data.tourName === 'string' ? data.tourName.slice(0, SHARED_TOUR_NAME_MAX_LENGTH) : '';

        ogTitle = tourName ? `${tourName} | LoPo Housing Tour` : DEFAULT_OG_TITLE;

        try {
          const params = buildTourInviteOgCardParams({ name: tourName });
          const hash = computeOgCardImageHash(params);
          await db.collection('og_image_meta').doc(hash).set({
            type: 'tour',
            name: tourName,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
          });
          ogImageUrl = `${origin}/og/${hash}.png`;
        } catch (err) {
          console.error('Tour invite OG card hash/meta error:', err);
        }
      }
    }
  } catch (err) {
    console.error('Tour invite page data fetch error:', err);
  }

  const canonicalUrl = rawToken ? `${origin}/housing/tour/${encodeURIComponent(rawToken)}` : origin;
  if (!/^https?:\/\//.test(ogImageUrl)) ogImageUrl = `${origin}${ogImageUrl}`;

  try {
    const indexRes = await fetch(`${origin}/index.html`);
    if (indexRes.ok) {
      let html = await indexRes.text();
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(ogTitle)}</title>`)
        .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`)
        .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`)
        .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
      return res.send(html);
    }
  } catch (err) {
    console.error('Tour invite page index.html fetch error:', err);
  }

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
