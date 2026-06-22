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
  damageType: 'physical' | 'magical' | 'enrage' | null;
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

/** モーダルが保持する「1タブ分のパース結果＋ユーザー入力フェーズ名」 */
export interface ImportSheet {
  parsed: ParsedSheet;
  phaseName: string;
}
