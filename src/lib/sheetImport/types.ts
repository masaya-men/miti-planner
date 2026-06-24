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
  /** そのジョブの割当枠(MT/ST/...)。未割当は null。グリッド黄色セルの配置先に使う。 */
  slot?: string | null;
  /** 配置されるはずだった立ち上がり時刻(秒)。複数可。 */
  times?: number[];
}

/** モーダルが保持する「1タブ分のパース結果＋ユーザー入力フェーズ名」 */
export interface ImportSheet {
  parsed: ParsedSheet;
  phaseName: string;
}
