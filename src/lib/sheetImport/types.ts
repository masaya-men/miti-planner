export interface SheetColumn {
  index: number;
  job: string;          // スプシのジョブ名（例 "ナイト"）
  skillNameRaw: string; // スプシのスキル名（例 "リプライザル"）
}

export interface SheetRow {
  phaseLabel: string;
  totalTimeSec: number;
  action: string;
  damageAmount: number | null;
  damageType: 'physical' | 'magical' | null;
  trueColumnIndexes: number[];
}

export interface ParsedSheet {
  columns: SheetColumn[];
  rows: SheetRow[];
}

export interface SkippedSkill {
  job: string;
  skillName: string;
}
