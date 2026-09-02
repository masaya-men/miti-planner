/**
 * ハウジング物件詳細ページ (/housing/listing/:id) 動的OGP+SEOスナップショットハンドラー。
 * _housingerPageHandler.ts / _tourInvitePageHandler.ts と同じ仕組み。vercel.json の rewrite で
 * /housing/listing/:id → /api/share?type=listing&id=:id に内部委譲される。
 *
 * データ取得・公開可否判定・住所射影は api/housing/_publicWindow.ts の action=listing と
 * 完全に同じロジック (isPubliclyViewable / projectPublicListing) を再利用する。
 * 独自の住所フィルタリングを書かない (住所非公開機能の二重実装によるドリフトを防ぐため)。
 */
import { getStorage } from 'firebase-admin/storage';
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { isPubliclyViewable } from '../housing/_publicWindow.js';
import { projectPublicListing } from '../../src/lib/housing/publicListingProjection.js';
import { formatFullHousingAddress } from '../../src/lib/housing/formatHousingAddress.js';
import { regionForDC } from '../../src/data/housing/dcServerMap.js';
import { escapeHtml, injectSeoSnapshot } from '../../src/lib/ogpPageShell.js';
import { listingRepresentativeImages } from './_listingImages.js';
import { buildListingOgCardParams } from '../../src/lib/ogpListingCard.js';
import { computeOgCardImageHash } from '../../src/lib/ogpImageHash.js';

const COLLECTION = 'housing_listings';
const DEFAULT_OG_TITLE = 'LoPo | FF14 軽減プランナー';
const DEFAULT_OG_DESCRIPTION = 'FF14の軽減プランをサクサク作れるウェブアプリ。FFLogsから自動生成されたタイムラインで、最適な軽減配置を。';
const DEFAULT_OG_IMAGE = '/api/og';
/** api/og-cache/index.ts と同じバケット(OGP カードの永続キャッシュ先)。 */
const OG_STORAGE_BUCKET = 'lopo-7793e.firebasestorage.app';
const DESCRIPTION_MAX_LENGTH = 140;
// タイトル未入力 かつ 住所も非公開(unlisted)の物件用フォールバック。ListingCard.tsx / HousingDetailContent.tsx
// の housing.card.addressPrivate (「住所は非公開です」) と同じ文言。OGP/SEOスナップショット生成はi18nを
// 経由しないため(この関数群は他ハンドラーも含め静的日本語文字列を直書きする方針)、ここも同様に固定文字列とする。
const ADDRESS_PRIVATE_FALLBACK = '住所は非公開です';

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

        // タイトルは任意入力(ハウジング全体で共通の「未入力なら住所を表示」規約・ListingCard.tsx /
        // HousingDetailContent.tsx と同じ優先順位)。空白のみの入力は未入力扱い(.trim())。
        // 住所も出せない(unlisted)場合のみ ADDRESS_PRIVATE_FALLBACK。DEFAULT_OG_TITLE(アプリ全体の
        // 汎用タイトル)へは絶対にフォールバックしない ― 複数の未入力物件が同一<title>/<h1>になり
        // SEO上重複コンテンツ扱いされるのを防ぐため(このハンドラーの目的そのもの)。
        const trimmedTitle = typeof projected.title === 'string' ? projected.title.trim() : '';
        const title = trimmedTitle || addressText || ADDRESS_PRIVATE_FALLBACK;

        ogTitle = `${title} - LoPo Housing`;
        ogDescription = description || DEFAULT_OG_DESCRIPTION;
        seoSnapshotHtml = buildListingSeoSnapshotHtml({ title, addressText, description });

        // OGP 画像: この家の代表写真を「自ドメインの整形済みカード」として配る。
        // X は他サイトのカード画像として pbs.twimg.com(Twitter 自社 CDN)を描画しないため、
        // 写真 URL をそのまま og:image にすると X 投稿由来の物件が画像なしカードになる
        // (Discord 等は出る)。写真 URL から内容ハッシュを作り、既存の安全なキャッシュ経路
        // (/og/{hash}.png・Storage + 長期キャッシュ・週次クリーンアップ cron)に乗せる。
        // _housingerPageHandler.ts の card-hash / meta / warm-up パターンと同型。
        const repImages = listingRepresentativeImages(projected as Record<string, unknown>);
        const rawPhoto = repImages[0];
        if (rawPhoto) {
          const photoUrl = /^https?:\/\//.test(rawPhoto) ? rawPhoto : `${origin}${rawPhoto}`;
          try {
            const params = buildListingOgCardParams({ img: photoUrl });
            const hash = computeOgCardImageHash(params);
            await db.collection('og_image_meta').doc(hash).set({
              type: 'listing',
              imageUrl: photoUrl,
              createdAt: Date.now(),
              lastAccessedAt: Date.now(),
            });
            const cardUrl = `${origin}/og/${hash}.png`;
            try {
              const bucket = getStorage().bucket(OG_STORAGE_BUCKET);
              const [exists] = await bucket.file(`og-images/${hash}.png`).exists();
              if (!exists) {
                // 未キャッシュ = このリクエストが初回。ここで生成させておけば後続の
                // クローラーが生成待ちにならない。失敗は握りつぶす(次リクエストで再試行)。
                await fetch(cardUrl, { headers: { 'User-Agent': 'LoPo-ListingWarmup/1.0' } });
              }
            } catch (warmErr) {
              console.error('Listing OG card warm-up error:', warmErr);
            }
            ogImageUrl = cardUrl;
          } catch (err) {
            // Firestore/Storage 障害時の degraded パス: 従来どおり生 URL(Discord では出る)。
            console.error('Listing OG card hash/meta error:', err);
            ogImageUrl = photoUrl;
          }
        }
        // rawPhoto が無ければ ogImageUrl は DEFAULT_OG_IMAGE('/api/og')のまま = 現状維持。
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
      // og:image は写真経路(自ドメイン再ホストカード /og/{hash}.png)でもフォールバック
      // (DEFAULT_OG_IMAGE = /api/og)でも常に 1200x630 の生成 PNG になるため、index.html が
      // 固定宣言している og:image:width/height (1200x630) は常に正しい。削除しない。
      if (seoSnapshotHtml) html = injectSeoSnapshot(html, seoSnapshotHtml);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Vercelはクライアント応答からs-maxageを除去する(.claude/rules/api-caching.md)ため、
      // max-ageに長い値を書くと実ブラウザが24時間キャッシュしてしまう。このHTMLはハッシュ付き
      // JSバンドル名を参照するページシェルなので、デプロイ直後に古いバンドル参照で壊れる/404が
      // 丸1日キャッシュされ続けるリスクがある。他ハンドラー(_tourInvitePageHandler.ts等)と同様
      // max-ageは短く(60秒)、CDN意図(s-maxage)だけ長く保つ。
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=60');
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
