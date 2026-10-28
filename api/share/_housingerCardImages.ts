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
