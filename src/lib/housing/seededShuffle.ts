import { isNewListing, isPinnedNew, NEW_LISTING_WINDOW_MS } from './listingPublish';

/**
 * seed から決定的な Fisher-Yates シャッフルを行う (mulberry32 PRNG)。
 * 同じ items (内容配列) + seed なら常に同じ並びを返す。元配列は変更しない。
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0;
  const nextRandom = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** シャッフル用の新しいシード値を生成する (0〜0xffffffff の整数)。 */
export function generateShuffleSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

/**
 * 探すページのランダム表示 (既定) 用の並び替え。投稿から windowMs 以内 ("NEW") は seed に
 * 関わらず常に先頭にまとめ (新着順)、それ以外だけを seededShuffle でランダム化する (2026-08-16)。
 * ランダム表示の「古い物件も新鮮に見える」意図は保ったまま、投稿直後の物件が
 * シャッフルで下の方に埋もれて見えなくなる問題を解消する。
 * 「新着順」「古い順」をユーザーが明示選択したときはこの関数を使わない (呼び出し側の責務)。
 * windowMs 省略時は既定7日 (NEW_LISTING_WINDOW_MS)。呼び出し側は通常
 * master/config.newListingWindowDays 由来の値 (useMasterData) を渡す。
 */
export function shuffleWithNewPinned<T extends { createdAt: number; pinnedNewUntil?: number | null }>(
  items: readonly T[],
  seed: number,
  nowMs: number,
  windowMs: number = NEW_LISTING_WINDOW_MS,
): T[] {
  // 2026-08-24 実機報告: 管理者が pinnedNewUntil で固定した投稿 (投稿日は古いことが多い) も
  // NEWリボンと同じ扱いで先頭グループに含める。含めないと、リボンは付くのにランダム表示
  // モードでは他の投稿に埋もれて見えてしまう (「NEWは付いたが上に固定されていない」不具合)。
  const isPinned = (l: T) => isNewListing(l.createdAt, nowMs, windowMs) || isPinnedNew(l.pinnedNewUntil, nowMs);
  const pinned = items.filter(isPinned).sort((a, b) => b.createdAt - a.createdAt);
  const rest = items.filter((l) => !isPinned(l));
  return [...pinned, ...seededShuffle(rest, seed)];
}
