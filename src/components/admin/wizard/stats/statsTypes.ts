// ---- 型定義 ----------------------------------------------------------------

export interface PatchStatEntry {
  hp: number;
  mainStat: number;
  det: number;
  wd: number;
}

export interface StatsData {
  levelModifiers: Record<string, { hpMultiplier: number; [key: string]: number }>;
  patchStats: Record<string, {
    tank: PatchStatEntry;
    other: PatchStatEntry;
  }>;
  defaultStatsByLevel: Record<string, string>;
}

export type TopMode = 'add' | 'edit' | 'level';

