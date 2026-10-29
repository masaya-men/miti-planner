import type { PlanData, SavedPlan } from '../types';
import { isSharedPlanContentEqual } from './planContentEqual';

/**
 * サーバーから読み直す処理(ログイン直後の取り込み / 取り直し / 手動同期)の最中に、手元でした編集を守る。
 *
 * 背景(2026-10-28 本番の消失): 読み直しは「始めた時点」の表一覧を元に結果を作り、終わった時に
 * 一覧を丸ごと置き換え、画面(作業ストア)も読み直していた。重くて読み直しが長引くと、その間に
 * 置いた軽減が、終わった瞬間に古い内容で上書きされて消えていた。
 *
 * 決まり:
 * - 「手元で編集された」は、読み直しを始めた時の表と**中身**(保存される内容)を比べて本当に違う時だけ。
 *   表を開く・切り替える・圧縮するだけ(中身が同じで updatedAt だけ進む)は編集とみなさない
 *   (敵対レビュー Critical 1: 切替だけで古い手元が勝ち、別端末の新しい編集を上書きしていた)。
 * - 手元が本当に編集されていて、サーバー側の中身も始めた時から変わっていた(本当の競合)時は上書きしない。
 *   表はサーバーの物を採り、手元の編集は競合コピー(別の表)として残す。
 * - 手元で何も変えていない表は、今まで通り読み直しの結果(新しい方)を採る。
 */

/** 中身を手元で比べられない表(アーカイブ・起動時の黙った圧縮で data が外れた表)。 */
function contentUnreadable(p: SavedPlan): boolean {
  return !!p.archived || (!p.data && !!p.compressedData);
}

/** 表ごとの表示設定(共同編集の部屋には載らないが、表と一緒に保存される)が同じか。 */
function sameViewSettings(a?: PlanData, b?: PlanData): boolean {
  return (a?.myMemberId ?? null) === (b?.myMemberId ?? null)
    && JSON.stringify(a?.hiddenPartyMemberIds ?? []) === JSON.stringify(b?.hiddenPartyMemberIds ?? [])
    && (a?.timelineSortOrder ?? 'light_party') === (b?.timelineSortOrder ?? 'light_party');
}

/** 保存される中身が同じか(updatedAt は見ない)。圧縮された表は中身を比べられないので同じとみなす。 */
export function samePlanContent(a: SavedPlan, b: SavedPlan): boolean {
  if (contentUnreadable(a) || contentUnreadable(b)) return true;
  return (a.title ?? '') === (b.title ?? '')
    && (a.contentId ?? null) === (b.contentId ?? null)
    && (a.isPublic ?? false) === (b.isPublic ?? false)
    && isSharedPlanContentEqual(a.data, b.data)
    && sameViewSettings(a.data, b.data);
}

/** 作業ストアのうち、ここで使う物(持ち主の札と、保存される中身を取り出す関数)。 */
export interface WorkingStoreLike {
  _loadedPlanId: string | null;
  getSnapshot: () => PlanData;
}

export interface WorkingStoreMark {
  planId: string | null;
  snapshot: PlanData;
}

/** 読み直しを始めた時点の作業ストアの印。 */
export function markWorkingStore(s: WorkingStoreLike): WorkingStoreMark {
  return { planId: s._loadedPlanId, snapshot: s.getSnapshot() };
}

/**
 * 印を付けた後に、同じ表のまま作業ストアの中身が本当に変わったか。
 * 表を切り替えた(持ち主の札が変わった)場合は編集とみなさない。
 */
export function workingStoreEditedSince(mark: WorkingStoreMark, now: WorkingStoreLike): boolean {
  if (!mark.planId || mark.planId !== now._loadedPlanId) return false;
  return !isSharedPlanContentEqual(mark.snapshot, now.getSnapshot());
}

export interface RemoteLoadResolution {
  /** 置き換える表一覧 */
  plans: SavedPlan[];
  /** 手元の物を残した表の ID(保存待ちの印を残す対象) */
  keptIds: Set<string>;
  /** 競合コピーとして残す手元の版 */
  conflicts: SavedPlan[];
  /** 今の表について、画面(作業ストア)を読み直さずに残すか */
  keepWorking: boolean;
}

/**
 * 読み直しの結果(merged)と、その間の手元の変化を突き合わせる。
 * @param inputPlans 読み直しに渡した表一覧(=始めた時点)
 * @param currentPlans 終わった時点の手元の表一覧
 * @param bases 中身を比べる「もと」を差し替える表(起動時に書き戻した表は、書き戻す前の表がもと)
 */
export function resolveRemoteLoad(args: {
  merged: SavedPlan[];
  inputPlans: SavedPlan[];
  currentPlans: SavedPlan[];
  currentPlanId: string | null;
  workingMark: WorkingStoreMark;
  working: WorkingStoreLike;
  bases?: Map<string, SavedPlan>;
}): RemoteLoadResolution {
  const { merged, inputPlans, currentPlans, currentPlanId, workingMark, working } = args;
  const inputMap = new Map(inputPlans.map((p) => [p.id, p]));
  const mergedMap = new Map(merged.map((p) => [p.id, p]));
  const currentIds = new Set(currentPlans.map((p) => p.id));
  const baseOf = (id: string) => args.bases?.get(id) ?? inputMap.get(id);

  const editedLocally = (p: SavedPlan) => {
    const base = baseOf(p.id);
    if (!base) return true; // 読み直しの間に作った表
    if (base === p || contentUnreadable(p)) return false; // 圧縮・アーカイブしただけは編集ではない
    // 始めた時は圧縮されていて、間に開かれた表は比べられない。編集を消さない側(編集あり)へ倒す
    if (contentUnreadable(base)) return true;
    return !samePlanContent(p, base);
  };
  const changedRemotely = (id: string) => {
    const r = mergedMap.get(id);
    const base = baseOf(id);
    if (!r || !base || r === inputMap.get(id)) return false; // 手元の版が採られた
    // 中身を比べられない時は、サーバーの版が新しく保存されていれば変わったとみなす(手元の編集を競合コピーに残す側へ倒す)
    if (contentUnreadable(r) || contentUnreadable(base)) return r.updatedAt > base.updatedAt;
    return !samePlanContent(r, base);
  };
  const workingIsCurrent = !!currentPlanId && working._loadedPlanId === currentPlanId;
  const workingEdited = workingStoreEditedSince(workingMark, working);
  const localVersion = (p: SavedPlan) =>
    (p.id === currentPlanId && workingIsCurrent && workingEdited ? { ...p, data: working.getSnapshot() } : p);

  const kept = new Map<string, SavedPlan>();
  const conflicts: SavedPlan[] = [];
  for (const p of currentPlans) {
    if (!editedLocally(p)) continue;
    if (changedRemotely(p.id)) conflicts.push(localVersion(p));
    else kept.set(p.id, p);
  }
  let keepWorking = !!currentPlanId && kept.has(currentPlanId);
  if (currentPlanId && workingIsCurrent && workingEdited && !kept.has(currentPlanId)
      && !conflicts.some((c) => c.id === currentPlanId)) {
    const cur = currentPlans.find((p) => p.id === currentPlanId);
    if (cur && changedRemotely(currentPlanId)) conflicts.push(localVersion(cur));
    else keepWorking = true;
  }

  const plans: SavedPlan[] = [];
  for (const p of merged) {
    if (inputMap.has(p.id) && !currentIds.has(p.id)) continue; // 間に消した表は戻さない
    plans.push(kept.get(p.id) ?? p);
  }
  for (const p of kept.values()) if (!mergedMap.has(p.id)) plans.push(p);
  return { plans, keptIds: new Set(kept.keys()), conflicts, keepWorking };
}
