/**
 * ハウジング物件画像の公開URL (Cloudflareキャッシュ経由 `lopoly.app/housing-media/...`) に関する
 * 純粋関数。Firebase Admin SDK 等への依存が無い文字列変換ロジックのみ。
 *
 * `api/housing/_imageArrayLogic.ts` の `buildHousingImagePublicUrl` / `parseStoragePathFromPublicUrl`
 * と同じ変換規則 (2026-07-24 Cloudflareキャッシュ化)。移行スクリプト
 * (`scripts/migrate-housing-images-to-cf-cache.ts`) 専用に切り出したロジックだが、両者が
 * 静かにズレないよう `__tests__/housingMediaUrl.test.ts` でパリティを検証している。
 */

/**
 * ハウジング物件画像の新公開URL (Cloudflareキャッシュ経由) を組み立てる。
 * `api/housing/_imageArrayLogic.ts` の `buildHousingImagePublicUrl` と同一規則。
 */
export function buildHousingMediaUrl(listingId: string, filename: string): string {
  return `https://lopoly.app/housing-media/${listingId}/${filename}`;
}

/**
 * 旧形式URL (firebasestorage.googleapis.com) かどうかを判定し、指定 listingId の
 * 物件のファイル名部分だけを取り出す。listingId が一致しない・旧形式でない・
 * 不正なURLの場合は null を返す。
 */
export function extractHousingMediaFilenameFromOldUrl(url: string, listingId: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'firebasestorage.googleapis.com') return null;
    const marker = '/o/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const decoded = decodeURIComponent(u.pathname.slice(idx + marker.length));
    const expectedPrefix = `housing/listings/${listingId}/`;
    if (!decoded.startsWith(expectedPrefix)) return null;
    return decoded.slice(expectedPrefix.length);
  } catch {
    return null;
  }
}

/**
 * housing_listings ドキュメントから画像URL配列を読み取る。
 * `api/housing/_uploadThumbnailHandler.ts` と同一の正規化ロジック: thumbnailPaths (配列) が
 * 無い旧データは、単数フィールド thumbnailPath を1件配列として扱う。どちらも無ければ空配列。
 */
export function readThumbnailPaths(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.thumbnailPaths)) return data.thumbnailPaths;
  if (typeof data.thumbnailPath === 'string' && data.thumbnailPath) return [data.thumbnailPath];
  return [];
}
