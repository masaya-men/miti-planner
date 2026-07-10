import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** リップル 1 個分の描画情報 (クリック座標由来なので実行時値)。 */
export interface RippleInstance {
  id: number;
  x: number;
  y: number;
  size: number;
}

// CSS 側のアニメーション尺 (0.6s) より少し長め。掃除タイマーがアニメ終了を必ず追い越すための余裕。
const RIPPLE_LIFETIME_MS = 650;

export interface UseRippleResult {
  ripples: RippleInstance[];
  /** ボタンの onClick に渡す。クリック位置から波紋を 1 個追加する。 */
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
}

/**
 * クリック波紋 (リップル) の状態管理フック。
 * - クリック座標を起点に円を追加し、CSS アニメーション (scale(0)→scale(3) ease-out 0.6s) で拡散消滅させる
 * - `prefers-reduced-motion: reduce` では波紋を生成しない (useReducedMotion 経由)
 * - RIPPLE_LIFETIME_MS 後に state から取り除く。アンマウント時は残タイマーを clearTimeout する
 *   (unmount 後の setState を防ぐ)
 *
 * 描画は呼び出し側が `<HousingRipple ripples={ripples} />` を
 * `position: relative; overflow: hidden` なボタンの中に置く (色/尺は housing.css の token 経由)。
 */
export function useRipple(): UseRippleResult {
  const [ripples, setRipples] = useState<RippleInstance[]>([]);
  const reducedMotion = useReducedMotion();
  const nextIdRef = useRef(0);
  const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;
    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
      timeoutIds.clear();
    };
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (reducedMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      const id = nextIdRef.current++;
      setRipples((prev) => [...prev, { id, x, y, size }]);
      const timeoutId = setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
        timeoutIdsRef.current.delete(timeoutId);
      }, RIPPLE_LIFETIME_MS);
      timeoutIdsRef.current.add(timeoutId);
    },
    [reducedMotion],
  );

  return { ripples, onClick };
}
