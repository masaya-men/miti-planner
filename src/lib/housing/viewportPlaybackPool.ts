/**
 * Tier 1 viewport playback の候補選定 (2026-05-27 Allmarks 移植)。
 * 各カードの visibility ratio (0..1) と cap から、 再生候補 N 件を返す。
 * - ratio 0 は off-screen 扱いで除外
 * - ratio < minRatio (= 画面端のスライバー) も除外、 ユーザーが「動いているもの」 を
 *   見つけられない事態を防ぐ
 * - tie-break は id 昇順で安定化
 *
 * 純関数。 IntersectionObserver からの ratio 集計は `useViewportPlaybackPool` 側。
 */
export function selectActivePlayers(
  ratios: ReadonlyMap<string, number>,
  cap: number,
  minRatio = 0,
): string[] {
  if (cap <= 0) return [];
  return [...ratios.entries()]
    .filter(([, r]) => r > 0 && r >= minRatio)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, cap)
    .map(([id]) => id);
}
