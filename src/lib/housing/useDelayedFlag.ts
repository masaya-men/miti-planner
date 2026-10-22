import { useEffect, useState } from 'react';

/**
 * flag が true になってから delayMs 経過してもまだ true のときだけ true を返す。
 * 読み込みが一瞬で終わるときにダミー表示がチカっと出るのを防ぐ (既定 200ms)。
 * flag が false に戻ったら即座に false。
 */
export function useDelayedFlag(flag: boolean, delayMs = 200): boolean {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!flag) {
      setDelayed(false);
      return;
    }
    const id = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(id);
  }, [flag, delayMs]);
  return flag && delayed;
}
