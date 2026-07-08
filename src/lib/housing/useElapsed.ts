import { useEffect, useState } from 'react';

/** startAt(epoch ms) からの経過秒。null なら 0。1秒ごとに再レンダーする。 */
export function useElapsed(startAt: number | null): number {
  const [, tick] = useState(0);
  useEffect(() => {
    if (startAt == null) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startAt]);
  if (startAt == null) return 0;
  return Math.max(0, Math.floor((Date.now() - startAt) / 1000));
}

/** 経過秒 → M:SS（60分以上は H:MM:SS）。 */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** epoch ms → 24時間表記 H:MM（ローカル時刻）。 */
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
