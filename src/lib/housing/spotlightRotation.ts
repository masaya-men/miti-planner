/**
 * Rotating-spotlight playback state (2026-05-27 Allmarks 移植)。
 * 一覧で `cap` 個のカードだけが「再生中」 で、 残りは waiting キュー。 一定時間で
 * 1 枚を waiting にローテーションし、 全カードに順次出番が回る仕組み。 GPU の
 * compositing コストを `cap` 個に固定するための単一レバー。
 *
 * - live    : 再生中の id、 oldest-first (= front は次に retire)
 * - waiting : 候補キュー、 front は次に promote
 *
 * Allmarks 元: c:/Users/masay/Desktop/マイコラージュ/lib/board/spotlight-rotation.ts
 */
export type SpotlightState = {
  readonly live: readonly string[];
  readonly waiting: readonly string[];
};

export const EMPTY_SPOTLIGHT: SpotlightState = { live: [], waiting: [] };

/**
 * candidates の入替時 (= scroll / motion 切替 / 再生不能化) に呼ぶ。 候補から消えた
 * id を落とし、 新規 id は waiting 末尾へ、 cap 超過分は waiting 先頭に戻す、
 * cap 未満なら waiting 先頭から live を埋める。
 */
export function reconcileSpotlight(
  prev: SpotlightState,
  candidates: ReadonlySet<string>,
  cap: number,
): SpotlightState {
  const n = Math.max(0, Math.floor(cap));
  const live = prev.live.filter((id) => candidates.has(id));
  const waiting = prev.waiting.filter((id) => candidates.has(id) && !live.includes(id));
  for (const id of candidates) {
    if (!live.includes(id) && !waiting.includes(id)) waiting.push(id);
  }
  while (live.length > n) waiting.unshift(live.shift() as string);
  while (live.length < n && waiting.length > 0) live.push(waiting.shift() as string);
  return { live, waiting };
}

/**
 * タイマーで定期的に呼ぶ。 最古 live を retire し、 waiting から 1 つ promote する。
 * `pickIndex` で waiting 内の index を選ぶ (default 0 = 先頭、 テスト時に固定値を注入)。
 * hook 側ではランダム関数を注入して順番の予測不能性を持たせる。
 * 退役カードは waiting 末尾に追加 (= 即連続再生を防ぐ)。
 */
export function rotateSpotlight(
  prev: SpotlightState,
  cap: number,
  pickIndex: (waitingLength: number) => number = () => 0,
): SpotlightState {
  const n = Math.max(0, Math.floor(cap));
  if (prev.waiting.length === 0 || prev.live.length < n || n === 0) return prev;
  const live = prev.live.slice();
  const waiting = prev.waiting.slice();
  const retired = live.shift() as string;
  const i = Math.min(waiting.length - 1, Math.max(0, Math.floor(pickIndex(waiting.length))));
  const promoted = waiting.splice(i, 1)[0] as string;
  live.push(promoted);
  waiting.push(retired);
  return { live, waiting };
}
