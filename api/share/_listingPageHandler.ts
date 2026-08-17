/**
 * ハウジング物件詳細ページ (/housing/listing/:id) 動的OGP+SEOスナップショットハンドラー。
 * _housingerPageHandler.ts / _tourInvitePageHandler.ts と同じ仕組み。vercel.json の rewrite で
 * /housing/listing/:id → /api/share?type=listing&id=:id に内部委譲される。
 *
 * データ取得・公開可否判定・住所射影は api/housing/_publicWindow.ts の action=listing と
 * 完全に同じロジック (isPubliclyViewable / projectPublicListing) を再利用する。
 * 独自の住所フィルタリングを書かない (住所非公開機能の二重実装によるドリフトを防ぐため)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { isPubliclyViewable } from '../housing/_publicWindow.js';
import { projectPublicListing } from '../../src/lib/housing/publicListingProjection.js';
import { formatFullHousingAddress } from '../../src/lib/housing/formatHousingAddress.js';
import { regionForDC } from '../../src/data/housing/dcServerMap.js';
import { escapeHtml, injectSeoSnapshot } from '../../src/lib/ogpPageShell.js';

const COLLECTION = 'housing_listings';
const DEFAULT_OG_TITLE = 'LoPo | FF14 軽減プランナー';
const DEFAULT_OG_DESCRIPTION = 'FF14の軽減プランをサクサク作れるウェブアプリ。FFLogsから自動生成されたタイムラインで、最適な軽減配置を。';
const DEFAULT_OG_IMAGE = '/api/og';
const DESCRIPTION_MAX_LENGTH = 140;

/** 物件詳細ページのSEOスナップショット (Googlebot向けに<div id="root">へ埋め込む可視テキスト)。 */
export function buildListingSeoSnapshotHtml(input: {
  title: string;
  addressText: string | null;
  description: string;
}): string {
  const addressHtml = input.addressText ? `<p>${escapeHtml(input.addressText)}</p>` : '';
  const trimmed = input.description.length > DESCRIPTION_MAX_LENGTH
    ? `${input.description.slice(0, DESCRIPTION_MAX_LENGTH)}…`
    : input.description;
  const descHtml = trimmed ? `<p>${escapeHtml(trimmed)}</p>` : '';
  return `<h1>${escapeHtml(input.title)}</h1>${addressHtml}${descHtml}`;
}

export default async function handler(req: any, res: any) {
  const listingId = (req.query?.id as string) || '';

  let ogTitle = DEFAULT_OG_TITLE;
  let ogDescription = DEFAULT_OG_DESCRIPTION;
  let ogImageUrl: string = DEFAULT_OG_IMAGE;
  let httpStatus = 200;
  let seoSnapshotHtml = '';

  const allowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
  const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
  const rawHost = req.headers?.host || 'lopoly.app';
  const host = allowedHosts.find((h) => rawHost.includes(h))
    || (previewPattern.test(rawHost) ? rawHost : null)
    || 'lopoly.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  try {
    if (listingId) {
      initAdmin();
      const db = getAdminFirestore();
      const snap = await db.collection(COLLECTION).doc(listingId).get();

      if (snap.exists && isPubliclyViewable(snap.data()!, Date.now())) {
        const projected = projectPublicListing(listingId, snap.data()!);
        const title = typeof projected.title === 'string' && projected.title ? projected.title : DEFAULT_OG_TITLE;
        const description = typeof projected.description === 'string' ? projected.description : '';

        let addressText: string | null = null;
        if (
          typeof projected.area === 'string'
          && typeof projected.ward === 'number'
          && typeof projected.dc === 'string'
          && typeof projected.server === 'string'
        ) {
          addressText = formatFullHousingAddress(
            {
              area: projected.area as any,
              ward: projected.ward,
              buildingType: projected.buildingType as 'house' | 'apartment' | undefined,
              plot: projected.plot as number | undefined,
              apartmentBuilding: projected.apartmentBuilding as 1 | 2 | undefined,
              roomNumber: projected.roomNumber as number | undefined,
              region: regionForDC(projected.dc),
              dc: projected.dc,
              server: projected.server,
            },
            'ja',
          );
        }

        ogTitle = `${title} - LoPo Housing`;
        ogDescription = description || DEFAULT_OG_DESCRIPTION;
        seoSnapshotHtml = buildListingSeoSnapshotHtml({ title, addressText, description });
      } else {
        httpStatus = 404;
      }
    } else {
      httpStatus = 404;
    }
  } catch (err) {
    console.error('Listing page data fetch error:', err);
  }

  const canonicalUrl = listingId ? `${origin}/housing/listing/${encodeURIComponent(listingId)}` : origin;
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
      if (seoSnapshotHtml) html = injectSeoSnapshot(html, seoSnapshotHtml);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
      res.status(httpStatus);
      return res.send(html);
    }
  } catch (err) {
    console.error('Listing page index.html fetch error:', err);
  }

  const safeTitle = escapeHtml(ogTitle);
  const safeDesc = escapeHtml(ogDescription);
  const safeImg = escapeHtml(ogImageUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(httpStatus);
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
<div id="root">${seoSnapshotHtml}</div>
</body>
</html>`);
}
