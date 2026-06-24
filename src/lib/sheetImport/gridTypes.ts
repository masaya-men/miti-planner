import type { PartySlot } from './partyAssignment';

/** グリッド各列の意味。member=パーティメンバー列、ignore=無視、unknown=未割当(要指定)。 */
export type GridField =
  | 'phase' | 'label' | 'time' | 'action' | 'damage' | 'target' | 'damageType'
  | 'member' | 'ignore' | 'unknown';

export interface GridColumn {
  /** 列の意味 */
  field: GridField;
  /** 元の見出しセル文字列(表示・再判定用) */
  header: string;
  /** member 列のみ: 見出しジョブ名から解決した jobId(未解決は null) */
  jobId?: string | null;
  /** member 列のみ: 割当枠(未割当は null) */
  slot?: PartySlot | null;
}

/** 列定義 + データ行(rows[r][c] は columns[c] に対応)。 */
export interface GridTable {
  columns: GridColumn[];
  rows: string[][];
}
