import type { Job } from '../../types';
import type { GridTable, GridColumn } from './gridTypes';
import { detectField } from './headerAliases';

/** TRUE/FALSE 行列形式(Skill 行を含むスキル列×真偽値の表)なら true。 */
export function isMatrixSheetFormat(tsv: string): boolean {
  if (!tsv) return false;
  return tsv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .some((line) => line.split('\t').some((c) => c.trim() === 'Skill'));
}

/** TSV を「1行目=見出し / 2行目以降=データ」とみなし GridTable へ。見出しで field 自動判定。 */
export function parseGridPaste(tsv: string, jobs: Job[]): GridTable {
  if (!tsv || !tsv.trim()) return { columns: [], rows: [] };
  const lines = tsv.replace(/\r\n/g, '\n').split('\n').map((l) => l.split('\t'));
  // 末尾の完全空行を除去
  while (lines.length && lines[lines.length - 1].every((c) => c.trim() === '')) lines.pop();
  if (lines.length === 0) return { columns: [], rows: [] };
  const header = lines[0];
  const columns: GridColumn[] = header.map((h) => {
    const d = detectField(h, jobs);
    return d.field === 'member'
      ? { field: 'member', header: h, jobId: d.jobId ?? null, slot: null }
      : { field: d.field, header: h };
  });
  const rows = lines.slice(1);
  return { columns, rows };
}
