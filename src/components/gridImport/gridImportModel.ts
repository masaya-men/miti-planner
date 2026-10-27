import type { Job } from '../../types';
import type { SheetImportResult } from '../../lib/sheetImport/buildPlanFromSheets';
import type { GridTable, GridField, GridColumn } from '../../lib/sheetImport/gridTypes';
import { SLOTS_BY_ROLE, PARTY_SLOTS, type PartySlot, type SlotRole } from '../../lib/sheetImport/partyAssignment';

/** 貼り付け内容の取込ソース。grid=自作(編集可) / matrix=行列形式(実証パーサ・読み取り表示)。 */
export type ImportSource = 'none' | 'grid' | 'matrix';

/** ウィザードのステップ。1=コンテンツ選択 / 2=スプシ風グリッド / 3=パーティ割当。 */
export type WizardStep = 1 | 2 | 3;

/** 固定の正典列(member は検出後に動的追加)。 */
export const BASE_FIELDS: GridField[] = ['phase', 'label', 'time', 'action', 'damage', 'target', 'damageType'];

/**
 * 「この列は？」セレクタに表示する割当可能フィールド。モジュールレベルで定義してレンダーごとの再生成を避ける。
 * member は jobId なしで手動設定すると確定ブロックの永久デッドエンドになるため除外。
 * unknown も選択肢に含めない（解除先がないため意味なし）。
 */
export const ASSIGNABLE_FIELDS: GridField[] = ['phase', 'label', 'time', 'action', 'damage', 'target', 'damageType', 'ignore'];

export type Lang4 = 'ja' | 'en' | 'ko' | 'zh' | 'zh-Hant';

/** 見出しだけの空グリッド(コンテンツ選択直後の初期表示用)。t は呼び出し側で渡す。 */
export function emptyHeaderTable(t: (k: string) => string): GridTable {
  return {
    columns: BASE_FIELDS.map((f) => ({ field: f, header: t(`gridImport.col_${f}`) })),
    rows: [],
  };
}

/**
 * 指定列インデックスに values を書き込んだ新しい GridTable を返す純粋関数。
 * - 既存行より values が多い場合は行を追加し、他列を '' で埋める。
 * - 既存行の方が多い場合は values の末尾を '' として扱う。
 * - rows は常に columns 長さに揃える。
 */
export function setColumnValues(table: GridTable, colIndex: number, values: string[]): GridTable {
  const numCols = table.columns.length;
  const targetRows = Math.max(table.rows.length, values.length);
  const newRows: string[][] = [];
  for (let r = 0; r < targetRows; r++) {
    const existing = table.rows[r] ?? [];
    const row: string[] = [];
    for (let c = 0; c < numCols; c++) {
      if (c === colIndex) {
        row.push(values[r] ?? '');
      } else {
        row.push(existing[c] ?? '');
      }
    }
    newRows.push(row);
  }
  return { ...table, rows: newRows };
}

/**
 * member 列を対象に、ロール内にメンバー列が1本だけかつ空き枠があれば先頭枠を自動割当。
 * autoFillSingles の GridTable 版。
 */
export function autoAssignSingleSlots(table: GridTable, jobs: Job[]): GridTable {
  // role → 割当済みスロット を先に集計
  const usedSlots = new Set<PartySlot>();
  for (const col of table.columns) {
    if (col.field === 'member' && col.slot) usedSlots.add(col.slot);
  }

  // role → 未割当のメンバー列インデックス一覧
  const byRole: Record<SlotRole, number[]> = { tank: [], healer: [], dps: [] };
  table.columns.forEach((col, i) => {
    if (col.field !== 'member' || col.slot) return;
    const job = jobs.find((j) => j.id === col.jobId);
    if (!job) return;
    const role = job.role as SlotRole;
    if (role in byRole) byRole[role].push(i);
  });

  const updatedCols: GridColumn[] = [...table.columns];
  const localUsed = new Set<PartySlot>(usedSlots);

  for (const role of (['tank', 'healer', 'dps'] as SlotRole[])) {
    const indices = byRole[role];
    if (indices.length !== 1) continue; // ロール内が1本だけの時のみ自動割当
    const freeSlots = SLOTS_BY_ROLE[role].filter((s) => !localUsed.has(s));
    if (freeSlots.length === 0) continue;
    const slot = freeSlots[0];
    updatedCols[indices[0]] = { ...updatedCols[indices[0]], slot };
    localUsed.add(slot);
  }

  return { ...table, columns: updatedCols };
}

/**
 * result.party を PARTY_SLOTS(MT,ST,H1,H2,D1..D4)順に並べ替えた SheetImportResult を返す純粋関数。
 * gridRowsFromResult は party 順でメンバー列を出すため、これを通すと列が必ず MT→D4 順になる。
 * resolveImportParty は検出順で party を返すため(現在の貼り付けプレビュー)、表示前に整列する。
 */
export function sortResultPartyBySlots(result: SheetImportResult): SheetImportResult {
  const order = (slot: string) => {
    const i = (PARTY_SLOTS as readonly string[]).indexOf(slot);
    return i === -1 ? PARTY_SLOTS.length : i;
  };
  const party = [...result.party].sort((a, b) => order(a.slot) - order(b.slot));
  return { ...result, party };
}
