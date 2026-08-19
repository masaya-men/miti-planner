import { useEffect, useState } from 'react';
import {
  pickHouseCount,
  layoutHouses,
  nearestNeighborOrder,
  buildPathD,
  phaseDurationMs,
  nextPhase,
  type FallingHousesPhase,
  type HousePoint,
} from './fallingHousesCycle';
import { useReducedMotion } from './useReducedMotion';

export interface FallingHousesState {
  cycleId: number;
  houses: HousePoint[];
  order: number[];
  pathD: string;
  phase: FallingHousesPhase;
  reducedMotion: boolean;
}

interface CycleData {
  cycleId: number;
  houses: HousePoint[];
  order: number[];
  pathD: string;
}

function buildCycle(cycleId: number): CycleData {
  const houses = layoutHouses(pickHouseCount());
  const order = nearestNeighborOrder(houses);
  const pathD = buildPathD(houses, order);
  return { cycleId, houses, order, pathD };
}

/**
 * Allmarksまとめてインポート中の「家が降ってくる→道でつながる→歩く→消える」ループの
 * 状態を返す。 falling→path→walking→hold→fading を自動で進め、fading の後は新しい
 * 家の配置で cycleId を進めて falling から再開する(無限ループ)。
 * `prefers-reduced-motion` のときはタイマーを起動せず、初期配置を静的に返すのみ
 * (呼び出し側 = `AllmarksFallingHouses` が phase を無視して静止表示に切り替える)。
 */
export function useFallingHousesCycle(): FallingHousesState {
  const reducedMotion = useReducedMotion();
  const [cycleData, setCycleData] = useState<CycleData>(() => buildCycle(0));
  const [phase, setPhase] = useState<FallingHousesPhase>('falling');

  useEffect(() => {
    if (reducedMotion) return;
    let timer: number;
    const advance = (data: CycleData, currentPhase: FallingHousesPhase): void => {
      const duration = phaseDurationMs(currentPhase, data.houses.length);
      timer = window.setTimeout(() => {
        const next = nextPhase(currentPhase);
        if (next) {
          setPhase(next);
          advance(data, next);
        } else {
          const newData = buildCycle(data.cycleId + 1);
          setCycleData(newData);
          setPhase('falling');
          advance(newData, 'falling');
        }
      }, duration);
    };
    advance(cycleData, phase);
    return (): void => window.clearTimeout(timer);
    // cycleData/phase を意図的に依存配列から外す(このeffectは自前のタイマー連鎖で
    // 進行を追跡するため、React state の変化で再スケジュールさせない)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return { ...cycleData, phase, reducedMotion };
}
