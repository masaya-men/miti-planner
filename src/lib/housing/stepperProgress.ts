/**
 * ステッパー連続進捗リングの塗り量計算 (純関数)。
 * セグメント列 [円1, 線1, 円2, 線2, …, 円N] の各実長 (px) を受け、
 * スクロール進捗 p (0..1) から各セグメントの塗り割合 (0..1) を返す。
 *
 * total*p の長さを先頭から順にセグメントへ按分する (ペンが一定速度で進む感覚)。
 * total が 0 / 空配列 / 長さ 0 のセグメントはゼロ除算せず 0 を返す。
 */
export function computeSegmentFills(p: number, segments: number[]): number[] {
  const clamped = Math.min(1, Math.max(0, p));
  const total = segments.reduce((sum, len) => sum + len, 0);
  if (total <= 0) return segments.map(() => 0);
  let remaining = total * clamped;
  return segments.map((len) => {
    if (len <= 0) return 0;
    const fillHere = Math.min(len, Math.max(0, remaining));
    remaining -= fillHere;
    return fillHere / len;
  });
}
