/**
 * ハウジンガーページ (/housing/housinger/:uid) 動的OGPハンドラー
 *
 * _sharePageHandler.ts と同じ仕組み (クローラーにはOGPメタ入りHTML、
 * 通常ユーザーには同じHTML内の <div id="root"> 経由で React Router が
 * SPA を描画する) を踏襲する。vercel.json の rewrite で
 * /housing/housinger/:uid → /api/share?type=housinger&uid=:uid に
 * 内部委譲され、ブラウザの URL 表示は書き換わらない (rewrite であり redirect ではない)。
 *
 * 新規 Serverless Function は作らない (Vercel Hobby 12関数上限) ため、
 * このファイルはアンダースコア始まりの非公開モジュールとして
 * api/share/index.ts から呼ばれる。
 *
 * プライバシー: 公開条件 (isPublished===true && isModerationHidden!==true) を
 * 満たさない uid (非公開・運営非表示・存在しない) は、専用メタを一切出さず
 * _sharePageHandler のデフォルトと同形の HTML にフォールバックする。
 * 住所文字列は og:title/og:description のいずれにも含めない。
 */

import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { normalizeHousingerUid, stripHashedPrefix, HOUSINGER_BIO_MAX_LENGTH } from '../../src/lib/housing/housingerProfile.js';

const PROFILE_COLLECTION = 'housing_profiles';
const LISTING_COLLECTION = 'housing_listings';
const PUBLIC_VISIBILITY = ['public', 'unlisted'];

// _sharePageHandler.ts のデフォルトと同じ文言 (専用メタを出さないケースの統一フォールバック)。
const DEFAULT_OG_TITLE = 'LoPo | FF14 軽減プランナー';
const DEFAULT_OG_DESCRIPTION = 'FF14の軽減プランをサクサク作れるウェブアプリ。FFLogsから自動生成されたタイムラインで、最適な軽減配置を。';
const DEFAULT_OG_IMAGE = '/api/og';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 公開 listing 1 件分から代表画像 URL を解決する。
 * src/lib/housing/representativeImage.ts の優先順 (thumbnail → sns(ogImageUrl) → なし) と
 * 同じロジックだが、OGP では「画像なし」時にプレースホルダ SVG (mock-thumbs) を使わず、
 * 呼び出し側で avatarUrl → デフォルト画像へフォールバックさせるため null を返す。
 */
function listingRepresentativeImage(listing: {
  imageMode?: unknown;
  thumbnailPath?: unknown;
  ogImageUrl?: unknown;
}): string | null {
  if (listing.imageMode === 'thumbnail' && typeof listing.thumbnailPath === 'string' && listing.thumbnailPath) {
    return listing.thumbnailPath;
  }
  if (listing.imageMode === 'sns' && typeof listing.ogImageUrl === 'string' && listing.ogImageUrl) {
    return listing.ogImageUrl;
  }
  return null;
}

/** 相対パスの場合のみ絶対URLに組み立てる (現行データは基本的に絶対URL保存だが念のため)。 */
function toAbsoluteUrl(url: string, origin: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default async function handler(req: any, res: any) {
  const rawUid = (req.query?.uid as string) || '';

  let ogTitle = DEFAULT_OG_TITLE;
  let ogDescription = DEFAULT_OG_DESCRIPTION;
  let ogImageUrl: string = DEFAULT_OG_IMAGE;
  const lang = 'ja';

  // 自サイトのホスト名を固定 (host ヘッダー偽装対策)。_sharePageHandler.ts と同じ許可リスト。
  const allowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
  const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
  const rawHost = req.headers?.host || 'lopoly.app';
  const host = allowedHosts.find((h) => rawHost.includes(h))
    || (previewPattern.test(rawHost) ? rawHost : null)
    || 'lopoly.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  let shortUid = rawUid;

  try {
    if (rawUid) {
      const uid = normalizeHousingerUid(rawUid);
      shortUid = stripHashedPrefix(uid);

      initAdmin();
      const db = getAdminFirestore();

      const profileSnap = await db.collection(PROFILE_COLLECTION).doc(uid).get();
      if (profileSnap.exists) {
        const profile = profileSnap.data()!;
        const isPublic = profile.isPublished === true && profile.isModerationHidden !== true;

        if (isPublic) {
          const displayName: string = typeof profile.displayName === 'string' && profile.displayName
            ? profile.displayName
            : '';
          const bio: string = typeof profile.bio === 'string' ? profile.bio.slice(0, HOUSINGER_BIO_MAX_LENGTH) : '';
          const avatarUrl: string | null = typeof profile.avatarUrl === 'string' && profile.avatarUrl ? profile.avatarUrl : null;

          ogTitle = displayName ? `${displayName} のハウジング | LoPo` : DEFAULT_OG_TITLE;
          ogDescription = bio || 'FF14 のハウジングを巡るツアー機能で公開中のハウジング一覧です。';

          // 代表画像: そのハウジンガーの公開中 listing (先頭 = 新着順、探すページと同じ並び順) の
          // 代表画像。無ければ avatarUrl、それも無ければ既存デフォルト (/api/og)。
          let resolvedImage: string | null = null;
          try {
            const listingSnap = await db.collection(LISTING_COLLECTION)
              .where('ownerUid', '==', uid)
              .where('visibility', 'in', PUBLIC_VISIBILITY)
              .where('isHidden', '==', false)
              .orderBy('createdAt', 'desc')
              .limit(10)
              .select('visibility', 'isHidden', 'deletedAt', 'createdAt', 'imageMode', 'thumbnailPath', 'ogImageUrl')
              .get();
            const firstAlive = listingSnap.docs.find((d) => d.data().deletedAt == null);
            if (firstAlive) {
              resolvedImage = listingRepresentativeImage(firstAlive.data());
            }
          } catch (err) {
            console.error('Housinger page listing fetch error:', err);
          }

          const finalImage = resolvedImage || avatarUrl;
          if (finalImage) {
            ogImageUrl = toAbsoluteUrl(finalImage, origin);
          }
          // resolvedImage も avatarUrl も無ければ ogImageUrl は DEFAULT_OG_IMAGE のまま。
        }
        // isPublic===false の場合は専用メタを一切設定せず、デフォルトのまま下の HTML 生成に進む。
      }
    }
  } catch (err) {
    console.error('Housinger page data fetch error:', err);
  }

  const canonicalUrl = shortUid ? `${origin}/housing/housinger/${encodeURIComponent(shortUid)}` : origin;

  // ビルド済みindex.htmlを取得してメタタグを差し替え (_sharePageHandler.ts と同じ手法)。
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
    console.error('Housinger page index.html fetch error:', err);
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
