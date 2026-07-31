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
import { buildHousingerOgCardParams } from '../../src/lib/ogpHousingerCard.js';
import { computeOgCardImageHash } from '../../src/lib/ogpImageHash.js';
import { isEligibleForOgRepresentative } from '../../src/lib/housing/listingPublish.js';
import { buildYoutubeThumbnailUrlFallback } from '../../src/lib/housing/youtubeUrl.js';
import { toPngSiblingPath } from '../housing/_imageArrayLogic.js';

const PROFILE_COLLECTION = 'housing_profiles';
const LISTING_COLLECTION = 'housing_listings';

// _sharePageHandler.ts のデフォルトと同じ文言 (専用メタを出さないケースの統一フォールバック)。
const DEFAULT_OG_TITLE = 'LoPo | FF14 軽減プランナー';
const DEFAULT_OG_DESCRIPTION = 'FF14の軽減プランをサクサク作れるウェブアプリ。FFLogsから自動生成されたタイムラインで、最適な軽減配置を。';
const DEFAULT_OG_IMAGE = '/api/og';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 公開 listing 1 件分から代表画像 URL を解決する。
 * 優先順: thumbnail → YouTubeサムネイル(youtubeVideoIdから再構築) → sns(ogImageUrl) →
 * Twitter動画のvideoPosterUrl → なし。
 * 動画のみ登録(imageMode:'none')の物件も、動画由来の静止画があればここで拾う
 * (2026-07-31: 従来はimageMode==='none'を一律除外していたため、動画メインのハウジンガーの
 * カードが空になっていた不具合の修正)。
 *
 * thumbnail経路 (直接アップロード) はブラウザ側でWebP優先圧縮されるが、OGPカード生成
 * (satori) はWebP/AVIF非対応で黙って読み飛ばす (2026-07-31実機で発覚)。アップロード時に
 * 保存した .png 兄弟ファイル (api/housing/_uploadThumbnailHandler.ts) を優先して指す。
 * 未変換の既存データ (バックフィル未実行/変換失敗) では .png が存在せず、呼び出し側の
 * fetchAsDataUri が 404 で null を返す = 従来通り「画像なし」に留まるだけで安全側に倒れる。
 *
 * youtubeVideoId は ogImageUrl より先に見る (2026-07-31実機で発覚): 登録時に保存された
 * ogImageUrl は maxresdefault.jpg (高解像度アップロード動画にしか存在しない・404になりやすい)
 * のまま残っている既存データがあり、そちらを優先すると黙って読み飛ばされてしまう。
 * youtubeVideoIdからhqdefault.jpg (全動画で必ず存在) を都度組み立てれば確実。
 */
function listingRepresentativeImage(listing: {
  imageMode?: unknown;
  thumbnailPath?: unknown;
  ogImageUrl?: unknown;
  videoPosterUrl?: unknown;
  youtubeVideoId?: unknown;
}): string | null {
  if (listing.imageMode === 'thumbnail' && typeof listing.thumbnailPath === 'string' && listing.thumbnailPath) {
    return toPngSiblingPath(listing.thumbnailPath);
  }
  if (typeof listing.youtubeVideoId === 'string' && listing.youtubeVideoId) {
    return buildYoutubeThumbnailUrlFallback(listing.youtubeVideoId);
  }
  if (listing.imageMode === 'sns' && typeof listing.ogImageUrl === 'string' && listing.ogImageUrl) {
    return listing.ogImageUrl;
  }
  if (typeof listing.videoPosterUrl === 'string' && listing.videoPosterUrl) {
    return listing.videoPosterUrl;
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
          // OGPレンダラー(satori)はWebP非対応のため、PNG派生版(Task6でアップロード)があれば
          // そちらを優先する。無ければ(旧アップロードのまま等)従来通りWebP URLを渡し、
          // レンダラー側でイニシャルプレースホルダにフォールバックさせる(致命的にしない)。
          const avatarUrl: string | null =
            typeof profile.avatarPngUrl === 'string' && profile.avatarPngUrl
              ? profile.avatarPngUrl
              : (typeof profile.avatarUrl === 'string' && profile.avatarUrl ? profile.avatarUrl : null);

          ogTitle = displayName ? `${displayName} のハウジング | LoPo` : DEFAULT_OG_TITLE;
          ogDescription = bio || 'FF14 のハウジングを巡るツアー機能で公開中のハウジング一覧です。';

          // 代表画像: ハウジンガー本人がマイページで選んだ代表作(最大10件・順序付き・先頭=背景兼ヒーロー)。
          // 未選択(ogRepresentativeListingIds が空/未設定)なら新着順上位10件を自動採用するフォールバック。
          // どちらの経路でも「選択後に非公開/住所非公開/削除された」listingはここで除外する。
          const nowMs = Date.now();
          const resolvedImages: string[] = [];
          try {
            const selectedIds: string[] = Array.isArray(profile.ogRepresentativeListingIds)
              ? profile.ogRepresentativeListingIds.slice(0, 10)
              : [];

            if (selectedIds.length > 0) {
              const snaps = await Promise.all(
                selectedIds.map((id: string) => db.collection(LISTING_COLLECTION).doc(id).get()),
              );
              for (const snap of snaps) {
                if (!snap.exists) continue;
                const data = snap.data()!;
                if (data.ownerUid !== uid) continue; // 改ざん防止: 他人のlistingを混入させない
                if (data.deletedAt != null || data.isHidden === true) continue;
                if (!isEligibleForOgRepresentative(data, nowMs)) continue;
                const img = listingRepresentativeImage(data);
                if (img) resolvedImages.push(img);
              }
            } else {
              const listingSnap = await db.collection(LISTING_COLLECTION)
                .where('ownerUid', '==', uid)
                .where('visibility', '==', 'public')
                .where('isHidden', '==', false)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .select('visibility', 'isHidden', 'deletedAt', 'createdAt', 'imageMode', 'thumbnailPath', 'ogImageUrl', 'videoPosterUrl', 'youtubeVideoId', 'ownerUid', 'publishUntil')
                .get();
              for (const doc of listingSnap.docs) {
                const data = doc.data();
                if (data.deletedAt != null) continue;
                if (!isEligibleForOgRepresentative(data, nowMs)) continue;
                const img = listingRepresentativeImage(data);
                if (img) resolvedImages.push(img);
                if (resolvedImages.length >= 10) break;
              }
            }
          } catch (err) {
            console.error('Housinger page listing fetch error:', err);
          }

          // OGP画像: アバター+名前+公開ハウジング画像(最大3枚)の「ページ風カード」を
          // 安全なキャッシュ経路(/og/{hash}.png・Storage+Cloudflare長期キャッシュ)で配信する。
          // 内容ハッシュを og_image_meta に保存し、og-cache が MISS 時だけ /api/og?type=housinger を叩く
          // (直接 /api/og を毎回叩いていた旧実装は Cloudflare の Bypass 対象で件数が無防備だった)。
          let cardUrl: string | null = null;
          try {
            const params = buildHousingerOgCardParams({
              name: displayName,
              bio,
              avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl, origin) : null,
              imageUrls: resolvedImages.map((img) => toAbsoluteUrl(img, origin)),
            });
            const hash = computeOgCardImageHash(params);
            await db.collection('og_image_meta').doc(hash).set({
              type: 'housinger',
              name: displayName,
              bio,
              avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl, origin) : null,
              imageUrls: resolvedImages.map((img) => toAbsoluteUrl(img, origin)),
              createdAt: Date.now(),
              lastAccessedAt: Date.now(),
            });
            cardUrl = `${origin}/og/${hash}.png`;
          } catch (err) {
            console.error('Housinger OG card hash/meta error:', err);
          }

          if (cardUrl) {
            ogImageUrl = cardUrl;
          } else {
            const finalImage = resolvedImages[0] || avatarUrl;
            if (finalImage) {
              ogImageUrl = toAbsoluteUrl(finalImage, origin);
            }
            // finalImage も無ければ ogImageUrl は DEFAULT_OG_IMAGE のまま。
          }
        }
        // isPublic===false の場合は専用メタを一切設定せず、デフォルトのまま下の HTML 生成に進む。
      }
    }
  } catch (err) {
    console.error('Housinger page data fetch error:', err);
  }

  const canonicalUrl = shortUid ? `${origin}/housing/housinger/${encodeURIComponent(shortUid)}` : origin;

  // OGP の画像は絶対 URL 必須 (相対 "/api/og" のままだと X が解決できずカード画像が出ない)。
  // 専用メタ分岐では絶対 URL 化済みだが、フォールバック (DEFAULT_OG_IMAGE) 経路をここで絶対化する。
  ogImageUrl = toAbsoluteUrl(ogImageUrl, origin);

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
