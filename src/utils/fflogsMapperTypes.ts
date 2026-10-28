// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

export interface Norm {
    timeSec: number;
    timeMs: number;
    rawDmg: number;
    aa: boolean;
    enName: string;
    jpName: string;
    guid: number;
    aType: number | undefined;
    tgtID: number;
    multiplier: number;
}
