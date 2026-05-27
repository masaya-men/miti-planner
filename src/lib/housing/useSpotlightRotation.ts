import { useEffect, useMemo, useRef, useState } from 'react';
import {
  reconcileSpotlight,
  rotateSpotlight,
  EMPTY_SPOTLIGHT,
  type SpotlightState,
} from './spotlightRotation';

function sameIds(a: ReadonlySet<string>, b: readonly string[]): boolean {
  if (a.size !== b.length) return false;
  for (const id of b) if (!a.has(id)) return false;
  return true;
}

/**
 * candidates Set のうち、 cap 個だけが再生中。 intervalMs (default 15000=15s) ごとに
 * 1 個入れ替えてランダムに次の候補が再生される。 Allmarks `use-spotlight-rotation.ts` 移植。
 *
 * - candidates が変わった瞬間に reconcile (= scroll で in-view が変わったらすぐ反映)
 * - intervalMs<=0 か cap<=0 で rotation 停止 (= タイマー登録なし)
 */
export function useSpotlightRotation(
  candidates: ReadonlySet<string>,
  cap: number,
  intervalMs = 15000,
): ReadonlySet<string> {
  const stateRef = useRef<SpotlightState>(EMPTY_SPOTLIGHT);
  const [live, setLive] = useState<ReadonlySet<string>>(new Set());

  // 中身が同じなら再 reconcile しないための signature (Set は毎回新しい instance なので)
  const sig = useMemo(
    () => `${cap}#${[...candidates].sort().join('|')}`,
    [candidates, cap],
  );

  useEffect(() => {
    stateRef.current = reconcileSpotlight(stateRef.current, candidates, cap);
    setLive((prev) =>
      sameIds(prev, stateRef.current.live) ? prev : new Set(stateRef.current.live),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (cap <= 0 || intervalMs <= 0) return;
    const t = setInterval(() => {
      const next = rotateSpotlight(stateRef.current, cap, (len) =>
        Math.floor(Math.random() * len),
      );
      if (next === stateRef.current) return;
      stateRef.current = next;
      setLive((prev) => (sameIds(prev, next.live) ? prev : new Set(next.live)));
    }, intervalMs);
    return (): void => clearInterval(t);
  }, [cap, intervalMs]);

  return live;
}
