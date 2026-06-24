import type { Job } from '../../types';
import type { GridField } from './gridTypes';
import { resolveJobId } from './resolveJob';

/** field ごとの見出し別名(小文字・前後空白除去で比較)。多言語+よくある表記。 */
const ALIASES: Record<Exclude<GridField, 'member' | 'ignore' | 'unknown'>, string[]> = {
  phase: ['フェーズ', 'phase', '페이즈', '阶段'],
  label: ['ラベル', 'label', 'セクション', 'section', '라벨', '标签'],
  time: ['時間', '時刻', 'time', 'total time', '시간', '时间'],
  action: ['敵の攻撃', '攻撃', '技', 'action', 'ability', 'attack', '공격', '技能', '攻击'],
  damage: ['ダメージ', 'damage', 'hit', 'dmg', '데미지', '伤害'],
  target: ['攻撃の対象', '対象', 'target', '대상', '目标'],
  damageType: ['ダメージ種別', '種別', 'type', 'damage type', '속성', '类型', '属性'],
};

/** 見出し文字から GridField を判定。ジョブ名なら member(jobId付き)。判定不能は unknown。 */
export function detectField(header: string, jobs: Job[]): { field: GridField; jobId?: string | null } {
  const n = header.trim().toLowerCase();
  if (!n) return { field: 'unknown' };
  for (const [field, names] of Object.entries(ALIASES)) {
    if (names.some((a) => a.toLowerCase() === n)) return { field: field as GridField };
  }
  const jobId = resolveJobId(header, jobs);
  if (jobId) return { field: 'member', jobId };
  return { field: 'unknown' };
}
