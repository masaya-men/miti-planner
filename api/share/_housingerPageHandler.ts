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

import { getStorage } from 'firebase-admin/storage';
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { normalizeHousingerUid, stripHashedPrefix, HOUSINGER_BIO_MAX_LENGTH } from '../../src/lib/housing/housingerProfile.js';
import { buildHousingerOgCardParams } from '../../src/lib/ogpHousingerCard.js';
import type { HousingerCardPattern } from '../../src/lib/ogpHousingerCard.js';
import { computeOgCardImageHash } from '../../src/lib/ogpImageHash.js';
import { isEligibleForOgRepresentative } from '../../src/lib/housing/listingPublish.js';
import { buildYoutubeThumbnailUrlFallback } from '../../src/lib/housing/youtubeUrl.js';
import { toPngSiblingPath } from '../housing/_imageArrayLogic.js';

const PROFILE_COLLECTION = 'housing_profiles';
const LISTING_COLLECTION = 'housing_listings';
/** api/og-cache/index.ts と同じバケット(OGPカードの永続キャッシュ先)。 */
const OG_STORAGE_BUCKET = 'lopo-7793e.firebasestorage.app';
/** カード生成パラメータのカードに載せる画像は最大10枚(src/lib/ogpHousingerCard.ts の MAX_CARD_IMAGES と一致させる)。 */
const MAX_CARD_IMAGES = 10;
/** 配信時にランダムに選ぶ2案。両方を事前生成・キャッシュしておく(配信時に生成コストを払わせない)。 */
const CARD_PATTERNS: HousingerCardPattern[] = ['grid', 'sidebar'];

// _sharePageHandler.ts のデフォルトと同じ文言 (専用メタを出さないケースの統一フォールバック)。
const DEFAULT_OG_TITLE = 'LoPo | FF14 軽減プランナー';
const DEFAULT_OG_DESCRIPTION = 'FF14の軽減プランをサクサク作れるウェブアプリ。FFLogsから自動生成されたタイムラインで、最適な軽減配置を。';
const DEFAULT_OG_IMAGE = '/api/og';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 公開 listing 1 件分から代表画像 URL を「複数」解決する(2026-08-03: OGPカードの写真スロットが
 * 常に10枚固定になったため、1物件1枚だけでなく持っている分だけ返すよう拡張)。
 * 優先順: thumbnail(複数可) → YouTubeサムネイル(youtubeVideoIdから再構築・1枚のみ) →
 * sns(sourceImageUrls優先・複数可、無ければogImageUrl1枚) → Twitter動画のvideoPosterUrl(1枚) → なし。
 * 動画のみ登録(imageMode:'none')の物件も、動画由来の静止画があればここで拾う
 * (2026-07-31: 従来はimageMode==='none'を一律除外していたため、動画メインのハウジンガーの
 * カードが空になっていた不具合の修正)。
 *
 * 戻り値の先頭 = 呼び出し側が「この物件の代表1枚」として使う画像(呼び出し順序を変えないため)。
 * 2枚目以降は「登録物件が10件に満たないユーザー」の穴埋め用の追加候補。
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
export function listingRepresentativeImages(listing: {
  imageMode?: unknown;
  thumbnailPath?: unknown;
  thumbnailPaths?: unknown;
  ogImageUrl?: unknown;
  sourceImageUrls?: unknown;
  videoPosterUrl?: unknown;
  youtubeVideoId?: unknown;
}): string[] {
  if (listing.imageMode === 'thumbnail') {
    if (Array.isArray(listing.thumbnailPaths) && listing.thumbnailPaths.length > 0) {
      return listing.thumbnailPaths
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .map((p) => toPngSiblingPath(p));
    }
    if (typeof listing.thumbnailPath === 'string' && listing.thumbnailPath) {
      return [toPngSiblingPath(listing.thumbnailPath)];
    }
  }
  if (typeof listing.youtubeVideoId === 'string' && listing.youtubeVideoId) {
    return [buildYoutubeThumbnailUrlFallback(listing.youtubeVideoId)];
  }
  if (listing.imageMode === 'sns') {
    if (Array.isArray(listing.sourceImageUrls) && listing.sourceImageUrls.length > 0) {
      return listing.sourceImageUrls.filter((u): u is string => typeof u === 'string' && u.length > 0);
    }
    if (typeof listing.ogImageUrl === 'string' && listing.ogImageUrl) {
      return [listing.ogImageUrl];
    }
  }
  if (typeof listing.videoPosterUrl === 'string' && listing.videoPosterUrl) {
    return [listing.videoPosterUrl];
  }
  return [];
}

/**
 * 複数 listing の画像候補配列(各要素=1物件分、先頭が代表画像)から、カードの写真スロットを
 * 優先順位付きで埋める: ①各物件の代表1枚ずつ ②足りなければ各物件の2枚目以降。
 * 巡回コピーでの穴埋めは行わない(それは呼び出し側=カード描画側 `_housingerCard.ts` の責務)。
 */
export function collectImagesFromListings(listingImageArrays: string[][], target: number): string[] {
  const result: string[] = [];
  for (const imgs of listingImageArrays) {
    if (result.length >= target) break;
    if (imgs.length > 0) result.push(imgs[0]);
  }
  if (result.length < target) {
    outer: for (const imgs of listingImageArrays) {
      for (let i = 1; i < imgs.length; i++) {
        if (result.length >= target) break outer;
        result.push(imgs[i]);
      }
    }
  }
  return result;
}

/**
 * `listingImageArrays` の中から `backgroundListingId` に一致する要素を先頭へ移動する。
 * 一致なし(未指定/代表作から外れた/非公開になった等)ならそのまま返す = 既存の並び順を使う
 * (このあとの `collectImagesFromListings` が並び順の先頭を「背景兼ヒーロー」として扱う)。
 */
export function reorderListingImageArraysByBackgroundId(
  entries: { id: string; images: string[] }[],
  backgroundListingId: string | null | undefined,
): { id: string; images: string[] }[] {
  if (!backgroundListingId) return entries;
  const idx = entries.findIndex((e) => e.id === backgroundListingId);
  if (idx <= 0) return entries;
  const copy = [...entries];
  const [target] = copy.splice(idx, 1);
  copy.unshift(target);
  return copy;
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
          // 2026-08-03: 写真スロットが常に10枚固定になったため、各listingから複数枚(thumbnailPaths/
          // sourceImageUrls)拾えるだけ拾い、それでも10枚に満たない場合のみ呼び出し側でのカード描画時に
          // 巡回コピーで埋める(cycleToLength、_housingerCard.ts側の責務)。
          const nowMs = Date.now();
          let resolvedImages: string[] = [];
          try {
            const selectedIds: string[] = Array.isArray(profile.ogRepresentativeListingIds)
              ? profile.ogRepresentativeListingIds.slice(0, 10)
              : [];

            const listingImageEntries: { id: string; images: string[] }[] = [];
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
                listingImageEntries.push({ id: snap.id, images: listingRepresentativeImages(data) });
              }
            } else {
              const listingSnap = await db.collection(LISTING_COLLECTION)
                .where('ownerUid', '==', uid)
                .where('visibility', '==', 'public')
                .where('isHidden', '==', false)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .select('visibility', 'isHidden', 'deletedAt', 'createdAt', 'imageMode', 'thumbnailPath', 'thumbnailPaths', 'ogImageUrl', 'sourceImageUrls', 'videoPosterUrl', 'youtubeVideoId', 'ownerUid', 'publishUntil')
                .get();
              for (const doc of listingSnap.docs) {
                const data = doc.data();
                if (data.deletedAt != null) continue;
                if (!isEligibleForOgRepresentative(data, nowMs)) continue;
                listingImageEntries.push({ id: doc.id, images: listingRepresentativeImages(data) });
              }
            }
            const backgroundListingId = typeof profile.ogBackgroundListingId === 'string' ? profile.ogBackgroundListingId : null;
            const orderedEntries = reorderListingImageArraysByBackgroundId(listingImageEntries, backgroundListingId);
            resolvedImages = collectImagesFromListings(orderedEntries.map((e) => e.images), MAX_CARD_IMAGES);
          } catch (err) {
            console.error('Housinger page listing fetch error:', err);
          }

          // OGP画像: アバター+名前+公開ハウジング画像の「ページ風カード」を
          // 安全なキャッシュ経路(/og/{hash}.png・Storage+Cloudflare長期キャッシュ)で配信する。
          // 内容ハッシュを og_image_meta に保存し、og-cache が MISS 時だけ /api/og?type=housinger を叩く
          // (直接 /api/og を毎回叩いていた旧実装は Cloudflare の Bypass 対象で件数が無防備だった)。
          //
          // 2026-08-03: デザイン2案(grid/sidebar)を「配信時にランダム選択」する運用にしたため、
          // 両方を毎回ここで生成・キャッシュしておく(未キャッシュな方が偶然選ばれて生成待ちになる
          // リクエストが起きないようにするため)。既にキャッシュ済みなら Storage の exists() だけで
          // 済ませ、実際の生成(satoriレンダリング)はデータが変わって新しいhashになった時だけ走る。
          let cardUrl: string | null = null;
          try {
            const bucket = getStorage().bucket(OG_STORAGE_BUCKET);
            const patternUrls = await Promise.all(CARD_PATTERNS.map(async (pattern) => {
              const params = buildHousingerOgCardParams({
                pattern,
                name: displayName,
                bio,
                avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl, origin) : null,
                imageUrls: resolvedImages.map((img) => toAbsoluteUrl(img, origin)),
              });
              const hash = computeOgCardImageHash(params);
              await db.collection('og_image_meta').doc(hash).set({
                type: 'housinger',
                pattern,
                name: displayName,
                bio,
                avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl, origin) : null,
                imageUrls: resolvedImages.map((img) => toAbsoluteUrl(img, origin)),
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
              });
              const url = `${origin}/og/${hash}.png`;
              try {
                const [exists] = await bucket.file(`og-images/${hash}.png`).exists();
                if (!exists) {
                  // 未キャッシュ = このリクエストが初回。ここで生成させておけば、後で別のリクエストが
                  // このパターンをランダムに選んだ時にはもう生成待ちにならない。
                  await fetch(url, { headers: { 'User-Agent': 'LoPo-HousingerWarmup/1.0' } });
                }
              } catch (warmErr) {
                console.error('Housinger OG card warm-up error:', pattern, warmErr);
              }
              return url;
            }));
            cardUrl = patternUrls[Math.floor(Math.random() * patternUrls.length)];
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
