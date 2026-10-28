import type { SavedPlan } from '../types';
import { setRecoveredBase } from './recoveredPlanBases';

/**
 * 「作業ストアに、まだ表(plan-storage)へ保存していない編集がある」印を手元(localStorage)に残す。
 *
 * 背景(2026-10-28 本番消失・経路 3): 作業ストアは変更のたびに mitigation-storage へ即保存されるが、
 * 表への保存は 0.5 秒待ってから。固まったタブを閉じる/リロードするとその保存が走らず、
 * 次の起動でログイン取り込みが表の古い内容で読み直して、置いた軽減が消えていた。
 * 閉じる瞬間にサーバーへ送るのは間に合わない前提で、印を残し、次の起動で表へ書き戻す。
 *
 * 敵対レビュー Important 2 を受けて:
 * - 書き戻しの updatedAt は起動した時刻ではなく「編集した時刻」。何日も後に開いても、
 *   その間の別端末の編集より新しいことにはならない。
 * - 書き戻す前の表(編集のもと)を預け、取り込みでサーバー側の中身がそこから変わっていれば
 *   上書きせず競合コピーにする(recoveredPlanBases → migrateOnLogin)。
 * - 共同編集の表は対象外(部屋の内容が正。他人の編集でも作業ストアは変わるため)。
 * - 印は起動のたびに必ず消す(書き戻した時・対象外だった時・表が消えていた時も)。
 *
 * 中身の比べ合いで「未保存か」を決めることはしない(読み込み時の補正で毎回違うと誤判定するため)。
 */
const KEY = 'lopo-unsaved-working-plan';

interface Marker {
  planId: string;
  /** 最後に編集した時刻(書き戻しの updatedAt にする) */
  editedAt: number;
  /** 最初の未保存の編集のもとにした表の updatedAt(記録用) */
  baseUpdatedAt: number | null;
}

function read(): Marker | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Marker;
    return m && typeof m.planId === 'string' && typeof m.editedAt === 'number' ? m : null;
  } catch { return null; }
}

function remove(): void {
  try { localStorage.removeItem(KEY); } catch { /* 保存できない環境では何もしない */ }
}

/** 作業ストアの編集を見た時: その持ち主の表に「未保存あり」の印を立てる(共同編集中・共同編集の表は立てない)。 */
export function markUnsavedWorking(planId: string | null, plans: SavedPlan[], collabActive: boolean): void {
  if (!planId || collabActive) return;
  const plan = plans.find((p) => p.id === planId);
  if (!plan || plan.activeCollabRoomToken) return;
  const prev = read();
  const marker: Marker = {
    planId,
    editedAt: Date.now(),
    baseUpdatedAt: prev?.planId === planId ? prev.baseUpdatedAt : plan.updatedAt,
  };
  try { localStorage.setItem(KEY, JSON.stringify(marker)); } catch { /* 同上 */ }
}

/** 表へ保存した時: その表の印を倒す。 */
export function clearUnsavedWorking(planId: string | null): void {
  if (!planId) return;
  if (read()?.planId === planId) remove();
}

/** 起動時に書き戻しの対象にならない経路(作業ストアを表から読み直す等)で、印を捨てる。 */
export function discardUnsavedWorking(): void {
  remove();
}

/**
 * 起動時: 前回、表へ保存しないまま終わっていて、作業ストアが今の表のものなら、表へ書き戻す。
 * @param writeBack 作業ストアの中身を今の表へ保存し、updatedAt を editedAt にする処理
 * @returns 書き戻したか
 */
export function recoverUnsavedWorkingOnBoot(args: {
  currentPlanId: string | null;
  loadedPlanId: string | null;
  plans: SavedPlan[];
  writeBack: (planId: string, editedAt: number) => void;
}): boolean {
  const marker = read();
  remove();
  if (!marker || marker.planId !== args.currentPlanId || args.loadedPlanId !== args.currentPlanId) return false;
  const plan = args.plans.find((p) => p.id === marker.planId);
  // 表が消えた・共同編集の表・編集の後に表が保存されていた → 書き戻さない
  if (!plan || plan.activeCollabRoomToken || plan.updatedAt > marker.editedAt) return false;
  setRecoveredBase(plan);
  args.writeBack(plan.id, marker.editedAt);
  return true;
}
