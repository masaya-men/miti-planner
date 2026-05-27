/**
 * 「ちがった」 ボタン用の長押し確定 hook。
 *
 * - duration ミリ秒押し続けると onConfirm 発火
 * - 途中 cancel すれば progress=0 に戻る、 onConfirm は呼ばれない
 * - progress は 16ms (= 約 60fps) tick で 0 → 1 に上がる
 * - 既に押下中なら start を無視 (= 二重起動防止)
 *
 * 設計書: docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.2
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseLongPressConfirmOptions {
  /** 確定までの時間 (ms)。 デフォルト 2000 */
  duration?: number;
  onConfirm: () => void;
}

export interface UseLongPressConfirmReturn {
  start: () => void;
  cancel: () => void;
  isPressing: boolean;
  progress: number;
}

const PROGRESS_TICK_MS = 16;

export function useLongPressConfirm(
  options: UseLongPressConfirmOptions,
): UseLongPressConfirmReturn {
  const { duration = 2000, onConfirm } = options;
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onConfirmRef = useRef(onConfirm);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTick();
    startTimeRef.current = null;
    setIsPressing(false);
    setProgress(0);
  }, [clearTick]);

  const start = useCallback(() => {
    if (startTimeRef.current !== null) return;
    startTimeRef.current = Date.now();
    setIsPressing(true);
    setProgress(0);

    tickRef.current = setInterval(() => {
      const startedAt = startTimeRef.current;
      if (startedAt === null) return;
      const elapsed = Date.now() - startedAt;
      const next = Math.min(1, elapsed / duration);
      setProgress(next);
      if (next >= 1) {
        clearTick();
        startTimeRef.current = null;
        setIsPressing(false);
        onConfirmRef.current();
      }
    }, PROGRESS_TICK_MS);
  }, [duration, clearTick]);

  useEffect(() => clearTick, [clearTick]);

  return { start, cancel, isPressing, progress };
}
