import { useEffect, useState } from 'react';
import { WARD_MAP_LOADERS } from '../../data/housing/wardMapManifest';
import { pickRoadSnippet, type RoadSnippet } from './mapRoadSnippet';
import { useReducedMotion } from './useReducedMotion';

export type MapRoadPhase = 'loading' | 'drawing' | 'hold' | 'fading';

export interface MapRoadState {
  cycleId: number;
  snippet: RoadSnippet | null;
  phase: MapRoadPhase;
  reducedMotion: boolean;
}

export const DRAWING_MS = 900;
export const HOLD_MS = 500;
export const FADE_MS = 400;

const MAP_KEYS = Object.keys(WARD_MAP_LOADERS);

function pickMapKey(rng: () => number = Math.random): string {
  return MAP_KEYS[Math.floor(rng() * MAP_KEYS.length)];
}

/**
 * Allmarksまとめてインポート中の「ワードマップの道路の一部が描かれる→少し止まる→消える→
 * 別のマップの別の場所でまた描かれる」ループの状態を返す(2026-08-19、ユーザー発案)。
 * ランダムなマップを1つ選んで遅延読み込みし(`WARD_MAP_LOADERS`、既存の地図表示と同じ
 * 遅延ロード資産を再利用)、その中からランダムな一角の道路スニペットを選ぶ。
 * `prefers-reduced-motion` のときはループを回さず、最初に読み込んだスニペットを
 * 静止表示するだけに留める(呼び出し側 = `AllmarksMapRoadDraw` が phase を無視する)。
 */
export function useMapRoadCycle(): MapRoadState {
  const reducedMotion = useReducedMotion();
  const [cycleId, setCycleId] = useState(0);
  const [snippet, setSnippet] = useState<RoadSnippet | null>(null);
  const [phase, setPhase] = useState<MapRoadPhase>('loading');

  // 周期ごとにランダムなマップ+切り取り範囲を読み込む。
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    WARD_MAP_LOADERS[pickMapKey()]().then(({ json }) => {
      if (cancelled) return;
      setSnippet(pickRoadSnippet(json));
      setPhase('drawing');
    });
    return (): void => {
      cancelled = true;
    };
  }, [cycleId]);

  // フェーズの自動進行。 reducedMotion 中と読み込み中はタイマーを起動しない。
  useEffect(() => {
    if (reducedMotion || phase === 'loading') return;
    const duration = phase === 'drawing' ? DRAWING_MS : phase === 'hold' ? HOLD_MS : FADE_MS;
    const timer = window.setTimeout(() => {
      if (phase === 'drawing') setPhase('hold');
      else if (phase === 'hold') setPhase('fading');
      else setCycleId((c) => c + 1); // fading の次は新しい周期(新マップ+新切り取り範囲)。
    }, duration);
    return (): void => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  return { cycleId, snippet, phase, reducedMotion };
}
