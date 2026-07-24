/**
 * 画像URL配列 (thumbnailPaths / sourceImageUrls) の削除・並び替えの純粋ロジック。
 * Firebase Admin SDK に依存しないため、モック無しで単体テストできる。
 */

export type DeletionResult<T> =
  | { ok: true; next: T[]; removed: T }
  | { ok: false; error: 'invalid_index' | 'last_item' };

/** index位置の要素を削除し、後続を詰める。最後の1件は削除させない(最低1枚を保証)。 */
export function computeArrayDeletion<T>(current: T[], index: number): DeletionResult<T> {
  if (!Number.isInteger(index) || index < 0 || index >= current.length) {
    return { ok: false, error: 'invalid_index' };
  }
  if (current.length <= 1) {
    return { ok: false, error: 'last_item' };
  }
  const next = current.filter((_, i) => i !== index);
  return { ok: true, next, removed: current[index] };
}

export type ReorderResult =
  | { ok: true; permutation: number[] }
  | { ok: false; error: 'invalid_reorder' };

/**
 * newOrder が current の並び替え (同じ多重集合) であることを検証し、
 * permutation[i] = 「newOrder の i 番目は current の何番目だったか」を返す。
 * 呼び出し側はこの permutation を使って、対応する副配列 (aspectRatios 等) も
 * 同じ順序で並び替えられる。
 */
export function computeArrayReorder<T>(current: T[], newOrder: T[]): ReorderResult {
  if (newOrder.length !== current.length) {
    return { ok: false, error: 'invalid_reorder' };
  }
  const used = new Set<number>();
  const permutation: number[] = [];
  for (const item of newOrder) {
    const idx = current.findIndex((c, i) => c === item && !used.has(i));
    if (idx === -1) return { ok: false, error: 'invalid_reorder' };
    used.add(idx);
    permutation.push(idx);
  }
  return { ok: true, permutation };
}

/**
 * Firebase Storage の公開URL (`_uploadThumbnailHandler.ts` が生成する形式) から
 * バケット内の実パスを逆算する。firebasestorage.googleapis.com 以外のURL
 * (外部SNS画像等) は null を返し、誤って外部リソースを削除対象にしないようにする。
 *
 * 2026-07-24: Cloudflareキャッシュ化に伴い、`lopoly.app/housing-media/:listingId/:filename`
 * 形式 (新形式) からも逆算できるよう対応。旧形式 (firebasestorage.googleapis.com) は
 * 既存データ・ロールバック時のため引き続きサポートする。
 */
export function parseStoragePathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'firebasestorage.googleapis.com') {
      const marker = '/o/';
      const idx = u.pathname.indexOf(marker);
      if (idx === -1) return null;
      const encodedPath = u.pathname.slice(idx + marker.length);
      return decodeURIComponent(encodedPath);
    }
    if (u.hostname === 'lopoly.app') {
      const marker = '/housing-media/';
      const idx = u.pathname.indexOf(marker);
      if (idx === -1) return null;
      const rest = u.pathname.slice(idx + marker.length);
      // rest = "{listingId}/{filename}" (両方ともスラッシュを含まない1セグメントずつ)
      const parts = rest.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
      return `housing/listings/${decodeURIComponent(parts[0])}/${decodeURIComponent(parts[1])}`;
    }
    return null;
  } catch {
    return null;
  }
}
