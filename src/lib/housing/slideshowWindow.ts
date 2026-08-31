/**
 * スライドショーで実際に <img> をマウントすべきフレーム index の集合を返す(純関数)。
 * クロスフェードは「現在＋退場」の2枚で足りるが、退場フレームがフェードし切るまで1ステップ
 * 残すため {prev, cur, next} の3枚窓にする。フレーム総数が3以下なら全 index。
 * 返り値は 0..n-1(環状: index=0 の prev は n-1)。
 */
export function slideshowWindowIndices(n: number, index: number): number[] {
  if (n <= 0) return [];
  if (n <= 3) return Array.from({ length: n }, (_, i) => i);
  const i = ((index % n) + n) % n;
  return [(i - 1 + n) % n, i, (i + 1) % n];
}
