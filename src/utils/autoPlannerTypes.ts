import type { TimelineEvent } from '../types';

export interface DamageBlock {
    id: string;
    target: 'AoE' | 'MT' | 'ST';
    startTime: number;
    endTime: number;
    events: TimelineEvent[];
    isTB: boolean;
    maxDamageRatio: number;
}

// SA法の決定ベクトル
export interface SADecision {
    aoeRoutes: ('A' | 'B')[];   // AoEブロックごとのルート割り当て
    tbPatterns: number[];        // TBブロックごとのパターンインデックス(0-5)
}
