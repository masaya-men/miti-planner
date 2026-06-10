// ④-b-2: カーソル補間の純関数。WebRTC/yjs 非依存。
// 受信パケットはまばら(~10–15Hz)なので、描画側で目標位置へ lerp して滑らかに見せる。

/** タイムライン上の位置。null = タイムライン外 → 非表示。 */
export type CursorPos = { timeSec: number; xRatio: number } | null;

/** 線形補間。alpha を [0,1] にクランプ。 */
export function lerp(current: number, target: number, alpha: number): number {
  const a = Math.max(0, Math.min(1, alpha));
  return current + (target - current) * a;
}

/** 受信パケットが手元の最新より新しいか(古い/同時刻パケットは破棄)。last=null は初回。 */
export function isFresher(incomingT: number, lastT: number | null): boolean {
  return lastT === null || incomingT > lastT;
}
