import type { SavedPlan } from '../types';

/**
 * サーバーへの保存が終わった時に、まだ残すべき「保存待ちの印」を決める。
 *
 * 背景(2026-10-28 消失調査): 保存の完了時に「送った表の ID」をまとめて印から外していたため、
 * 送っている最中に同じ表へ来た 2 回目の編集の印まで消え、2 回目がサーバーへ届かなかった。
 *
 * 決まり: 送った表でも、送り始めた時から手元の表が差し替わっていれば(=後から編集された)印を残す。
 * 送っていない表の印(送信中に新しく付いた印)はそのまま残す。表自体が消えていれば印は外す。
 */
export function dirtyIdsAfterSync(
  currentDirty: Set<string>,
  sentIds: Set<string>,
  startPlans: SavedPlan[],
  currentPlans: SavedPlan[],
): Set<string> {
  const startMap = new Map(startPlans.map((p) => [p.id, p]));
  const currentMap = new Map(currentPlans.map((p) => [p.id, p]));
  const remaining = new Set<string>();
  for (const id of currentDirty) {
    const now = currentMap.get(id);
    if (!sentIds.has(id) || (now && now !== startMap.get(id))) remaining.add(id);
  }
  return remaining;
}
