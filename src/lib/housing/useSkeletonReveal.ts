import { useEffect, useState } from 'react';

/**
 * 「ダミー表示が実際に見えた後に本物へ入れ替わった」ときだけ true を返す。
 * 本物の外枠に `housing-reveal` (ふわっと表示) を付けるかの判定に使う。
 * - loading 中に delayMs 経過した (= ダミーが見えた) ことを覚え、loading が false になったら true。
 * - delayMs 未満で読み込みが終わった場合は false (速いときはもったいぶらない)。
 * - loading が再び true になったら記憶をリセットする。
 * delayMs は SkeletonShell の useDelayedFlag の既定 (200ms) と揃える。
 */
export function useSkeletonReveal(loading: boolean, delayMs = 200): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!loading) return;
    setSeen(false);
    const id = setTimeout(() => setSeen(true), delayMs);
    return () => clearTimeout(id);
  }, [loading, delayMs]);
  return !loading && seen;
}
