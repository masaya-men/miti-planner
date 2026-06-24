import type { Mitigation, Job } from '../../types';
import type { GridColumn } from './gridTypes';
import { mmssToSec } from './time';
import { normalizeTarget, normalizeDamageType } from './normalizeFields';
import { resolveSheetSkill } from './resolveSheetSkill';

export type ColumnStatus = 'ok' | 'partial' | 'empty';

/** 列の値を検証して青(ok)/黄(partial)/灰(empty)を返す。 */
export function validateGridColumn(
  col: GridColumn,
  cells: string[],
  deps: { mitigations: Mitigation[]; jobs: Job[] },
): ColumnStatus {
  const nonEmpty = cells.map((c) => (c ?? '').trim()).filter((c) => c !== '');
  if (nonEmpty.length === 0) return 'empty';

  const check = (ok: (v: string) => boolean): ColumnStatus =>
    nonEmpty.every(ok) ? 'ok' : 'partial';

  switch (col.field) {
    case 'time': return check((v) => mmssToSec(v) !== null);
    case 'target': return check((v) => normalizeTarget(v) !== null);
    case 'damageType': return check((v) => normalizeDamageType(v) !== null);
    case 'damage': return check((v) => isFinite(Number(v.replace(/,/g, ''))));
    case 'member': {
      const jobJa = deps.jobs.find((j) => j.id === col.jobId)?.name.ja ?? '';
      return check((v) => resolveSheetSkill(jobJa, v, deps.mitigations) !== null);
    }
    case 'phase': case 'label': case 'action': return 'ok'; // 値があれば OK(任意)
    default: return 'empty'; // unknown/ignore
  }
}
