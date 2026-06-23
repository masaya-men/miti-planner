/**
 * スプシ取込の「攻撃の対象(AoE/MT/ST)引き継ぎ」用の純粋マッチング。
 * 取込時(applyTargetsFromTemplate) と 管理プレビュー(buildSheetMatchReport) の双方が使う(DRY)。
 *
 * 精度優先: 正規化後の完全一致 + スプシ別名一致のみ。編集距離の曖昧一致はしない
 * (対象の誤付け=タンバスMT/ST誤誘導が有害)。自信が無ければ付けない(undefined)。
 */
import type { TimelineEvent } from '../../types';
import { stripParenthetical } from './resolveSheetSkill';

export type CarryTarget = 'AoE' | 'MT' | 'ST';

export interface SheetMatchRow {
  action: string;
  status: 'carried' | 'matched_no_target' | 'unmatched';
  templateName: string | null;
  target: CarryTarget | null;
}

/** 攻撃名の正規化: 末尾括弧除去 → NFKC(全半角統一) → 空白除去 → trim。 */
export function normalizeAttackName(s: string): string {
  return stripParenthetical(s).normalize('NFKC').replace(/\s+/g, '').trim();
}

/** 「スプシ表記」入力(カンマ/改行区切り)を string[] へ。trim・空除去。 */
export function parseSheetAliases(input: string): string[] {
  return input.split(/[,、\n]/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** action 名がテンプレ技に一致するか(name.ja 正規化一致 or 別名正規化一致)。 */
function matches(actionName: string, ev: TimelineEvent): boolean {
  const n = normalizeAttackName(actionName);
  if (normalizeAttackName(ev.name.ja) === n) return true;
  return (ev.sheetAliases ?? []).some((a) => normalizeAttackName(a) === n);
}

/** action 名に一致するテンプレ技を全件返す(入力順)。 */
export function findTemplateAttacks(actionName: string, templateEvents: TimelineEvent[]): TimelineEvent[] {
  return templateEvents.filter((ev) => matches(actionName, ev));
}

/**
 * 候補から対象を解決。target undefined 候補は無視。1種なら確定。
 * 食い違いは時刻最近傍。最近傍が等距離で食い違うなら undefined(推測しない)。
 */
export function resolveTargetFromMatches(matchesList: TimelineEvent[], time: number): CarryTarget | undefined {
  const withTarget = matchesList.filter((m): m is TimelineEvent & { target: CarryTarget } => m.target !== undefined);
  if (withTarget.length === 0) return undefined;
  const distinct = new Set(withTarget.map((m) => m.target));
  if (distinct.size === 1) return withTarget[0].target;
  const minDist = Math.min(...withTarget.map((m) => Math.abs(m.time - time)));
  const nearest = withTarget.filter((m) => Math.abs(m.time - time) === minDist);
  const nearestTargets = new Set(nearest.map((m) => m.target));
  return nearestTargets.size === 1 ? nearest[0].target : undefined;
}

/** action 名+時刻 → 引き継ぐ対象(なければ undefined)。 */
export function matchTemplateTarget(actionName: string, time: number, templateEvents: TimelineEvent[]): CarryTarget | undefined {
  return resolveTargetFromMatches(findTemplateAttacks(actionName, templateEvents), time);
}

/** target が空の event だけテンプレから対象を補完(非破壊・新配列)。 */
export function applyTargetsFromTemplate(events: TimelineEvent[], templateEvents: TimelineEvent[]): TimelineEvent[] {
  return events.map((ev) => {
    if (ev.target !== undefined) return ev;
    const target = matchTemplateTarget(ev.name.ja, ev.time, templateEvents);
    return target !== undefined ? { ...ev, target } : ev;
  });
}

/** 管理プレビュー用: スプシ各 action のマッチ結果一覧(action 重複は初出のみ)。 */
export function buildSheetMatchReport(
  rows: { action: string; time: number }[],
  templateEvents: TimelineEvent[],
): SheetMatchRow[] {
  const seen = new Set<string>();
  const out: SheetMatchRow[] = [];
  for (const { action, time } of rows) {
    if (seen.has(action)) continue;
    seen.add(action);
    const found = findTemplateAttacks(action, templateEvents);
    if (found.length === 0) {
      out.push({ action, status: 'unmatched', templateName: null, target: null });
      continue;
    }
    const target = resolveTargetFromMatches(found, time);
    if (target === undefined) {
      out.push({ action, status: 'matched_no_target', templateName: found[0].name.ja, target: null });
      continue;
    }
    const named = found.find((m) => m.target === target) ?? found[0];
    out.push({ action, status: 'carried', templateName: named.name.ja, target });
  }
  return out;
}
