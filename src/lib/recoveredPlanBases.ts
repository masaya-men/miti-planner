import type { SavedPlan } from '../types';

/**
 * 起動時に「落ちる前の未保存の編集」を書き戻した表の、書き戻す前の版(=編集のもとにした版)を預かる。
 * ログイン取り込み(migrateOnLogin)が受け取り、サーバー側の中身がこの版から変わっていたら
 * 上書きせず競合コピーにする(敵対レビュー Important 2)。
 */
const bases = new Map<string, SavedPlan>();

export function setRecoveredBase(plan: SavedPlan): void {
  bases.set(plan.id, plan);
}

/** 預かった版を全部受け取り、預かりを空にする。 */
export function takeRecoveredBases(): Map<string, SavedPlan> {
  const out = new Map(bases);
  bases.clear();
  return out;
}
