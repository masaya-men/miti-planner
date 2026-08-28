/**
 * 公開 listing 1 件分から代表画像 URL を「複数」解決する共有ロジック。
 * (旧: api/share/_housingerPageHandler.ts。2026-08-28 に _listingPageHandler.ts と
 *  共有するため切り出し。ロジックは移設のみで挙動は 1 bit も変えていない)
 *
 * 2026-08-03: OGPカードの写真スロットが常に10枚固定になったため、1物件1枚だけでなく
 * 持っている分だけ返すよう拡張。
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
import { toPngSiblingPath } from '../housing/_imageArrayLogic.js';
import { buildYoutubeThumbnailUrlFallback } from '../../src/lib/housing/youtubeUrl.js';

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
