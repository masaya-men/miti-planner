import type { Mitigation } from '../../types';
import { JOB_JA_TO_ID, SKILL_ALIASES } from './skillAliases';

/** 末尾の括弧（全角/半角）以降を除去 */
export function stripParenthetical(name: string): string {
  return name.replace(/[（(].*$/, '').trim();
}

export function resolveSheetSkill(
  jobJa: string,
  skillNameRaw: string,
  mitigations: Mitigation[],
): string | null {
  const jobId = JOB_JA_TO_ID[jobJa.trim()];
  if (!jobId) return null;
  const stripped = stripParenthetical(skillNameRaw);
  const normalized = SKILL_ALIASES[stripped] ?? stripped;
  const hit = mitigations.find(
    (m) =>
      m.jobId === jobId &&
      (m.name.ja === normalized ||
        m.name.en === normalized ||
        m.name.ko === normalized ||
        m.name.zh === normalized),
  );
  return hit ? hit.id : null;
}
