import type { SavedPlan } from '../types';

/**
 * サーバーから読み直す処理(ログイン直後の取り込み / 取り直し)の最中に、手元でした編集を守る。
 *
 * 背景(2026-10-28 本番の消失): 読み直しは「始めた時点」の表一覧を元に結果を作り、終わった時に
 * 一覧を丸ごと置き換え、画面(作業ストア)も読み直していた。重くて読み直しが長引くと、その間に
 * 置いた軽減が、終わった瞬間に古い内容で上書きされて消えていた。
 *
 * 決まり: 読み直しの間に手元で変わった表は、サーバー側の内容で上書きしない(手元を正とする)。
 * 手元で何も変えていない表は、今まで通り「新しい方を採る」(別端末での編集を取り込む)。
 */

/** 作業ストアのうち、自動保存が見張っている欄(Layout の自動保存の監視と同じ 4 つ)と持ち主の札。 */
export interface WorkingStoreFields {
  _loadedPlanId: string | null;
  timelineMitigations: unknown;
  timelineEvents: unknown;
  phases: unknown;
  partyMembers: unknown;
}

/** 読み直しを始めた時点の作業ストアの印(中身は比べず、入れ物が差し替わったかだけを見る)。 */
export function markWorkingStore(s: WorkingStoreFields): WorkingStoreFields {
  return {
    _loadedPlanId: s._loadedPlanId,
    timelineMitigations: s.timelineMitigations,
    timelineEvents: s.timelineEvents,
    phases: s.phases,
    partyMembers: s.partyMembers,
  };
}

/**
 * 印を付けた後に、同じ表のまま作業ストアが編集されたか。
 * 表を切り替えた(持ち主の札が変わった)場合は編集とみなさない(切替は今まで通りの扱い)。
 */
export function workingStoreEditedSince(mark: WorkingStoreFields, now: WorkingStoreFields): boolean {
  if (!mark._loadedPlanId || mark._loadedPlanId !== now._loadedPlanId) return false;
  return mark.timelineMitigations !== now.timelineMitigations
    || mark.timelineEvents !== now.timelineEvents
    || mark.phases !== now.phases
    || mark.partyMembers !== now.partyMembers;
}

/**
 * 読み直しの結果(merged)に、読み直しの間に手元で起きた変更を戻す。
 * - 間に保存された表(一覧の中の物が差し替わった表・新しく作った表) → 手元の物を使う
 * - 間に消した表(始めた時にあって今は無い表) → 結果からも外す(復活させない)
 * @returns plans=直した一覧 / editedIds=手元を使った表の ID
 */
export function keepPlansEditedDuring(
  merged: SavedPlan[],
  startPlans: SavedPlan[],
  currentPlans: SavedPlan[],
): { plans: SavedPlan[]; editedIds: Set<string> } {
  const startMap = new Map(startPlans.map((p) => [p.id, p]));
  const currentIds = new Set(currentPlans.map((p) => p.id));
  const edited = new Map(currentPlans.filter((p) => startMap.get(p.id) !== p).map((p) => [p.id, p]));
  const plans: SavedPlan[] = [];
  for (const p of merged) {
    if (startMap.has(p.id) && !currentIds.has(p.id)) continue;
    plans.push(edited.get(p.id) ?? p);
  }
  const mergedIds = new Set(merged.map((p) => p.id));
  for (const p of edited.values()) if (!mergedIds.has(p.id)) plans.push(p);
  return { plans, editedIds: new Set(edited.keys()) };
}
