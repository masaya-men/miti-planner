import type { ParsedSheet } from './types';
import { JOB_JA_TO_ID } from './skillAliases';

/**
 * データ行で TRUE が1つでもある列のジョブ id を、全シートを時刻昇順にマージしたうえで
 * 初出順・重複排除で返す。JOB_JA_TO_ID 未登録のジョブ表記は除外。
 */
export function detectUsedJobIds(parsedSheets: ParsedSheet[]): string[] {
  const merged = parsedSheets.flatMap((s) => s.rows.map((row) => ({ row, columns: s.columns })));
  merged.sort((a, b) => a.row.totalTimeSec - b.row.totalTimeSec);

  const usedJobJa = new Set<string>();
  for (const { row, columns } of merged) {
    for (const idx of row.trueColumnIndexes) {
      const col = columns.find((c) => c.index === idx);
      if (col) usedJobJa.add(col.job);
    }
  }
  return [...usedJobJa].map((ja) => JOB_JA_TO_ID[ja]).filter(Boolean) as string[];
}
