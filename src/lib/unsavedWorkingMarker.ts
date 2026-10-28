/**
 * 「作業ストアに、まだ表(plan-storage)へ保存していない編集がある」印を手元(localStorage)に残す。
 *
 * 背景(2026-10-28 本番消失・経路 3): 作業ストアは変更のたびに mitigation-storage へ即保存されるが、
 * 表への保存は 0.5 秒待ってから。固まったタブを閉じる/リロードするとその保存が走らず、
 * 次の起動でログイン取り込みが表の古い内容で読み直して、置いた軽減が消えていた。
 * 閉じる瞬間にサーバーへ送るのは間に合わない前提で、印を残し、次の起動で表へ書き戻す(送る印も付く)。
 *
 * 中身の比べ合いはしない(読み込み時に中身を直す処理があり、毎回「違う」と誤判定するため)。
 * 印は編集を見た時に立て、表へ保存した時に倒すだけ。
 */
const KEY = 'lopo-unsaved-working-plan';

/** 作業ストアの編集を見た時: その持ち主の表に「未保存あり」の印を立てる。 */
export function markUnsavedWorking(planId: string | null): void {
  if (!planId) return;
  try { localStorage.setItem(KEY, planId); } catch { /* 保存できない環境では何もしない */ }
}

/** 表へ保存した時: その表の印を倒す。 */
export function clearUnsavedWorking(planId: string | null): void {
  if (!planId) return;
  try { if (localStorage.getItem(KEY) === planId) localStorage.removeItem(KEY); } catch { /* 同上 */ }
}

/**
 * 起動時: 前回、表へ保存しないまま終わっていて、作業ストアが今の表のものなら、表へ書き戻す。
 * @param save 作業ストアを持ち主の表へ保存する処理(Layout の saveSilently と同じ中身)
 * @returns 書き戻したか
 */
export function recoverUnsavedWorkingOnBoot(
  currentPlanId: string | null,
  loadedPlanId: string | null,
  save: () => void,
): boolean {
  let marked: string | null = null;
  try { marked = localStorage.getItem(KEY); } catch { return false; }
  if (!marked) return false;
  const recovered = marked === currentPlanId && loadedPlanId === currentPlanId;
  if (recovered) save();
  try { localStorage.removeItem(KEY); } catch { /* 同上 */ }
  return recovered;
}
