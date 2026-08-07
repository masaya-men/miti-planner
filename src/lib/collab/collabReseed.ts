// 共同編集 クライアント側 空上書き防御(サーバ _logic.ts emptyOverwriteSkips と同型・対の関係)。
// 「部屋(doc)側が空・手元(store)側が非空」の構造フィールドは、空を手元に適用して画面を潰さず、
// 手元を正として部屋へ再シードする。yjs 非依存の純粋ロジックとして切り出しテストする。

import type { SavedPlan } from '../../types';

/** 防御対象の構造フィールド(labels/memos は空が正常なため対象外＝サーバと一致)。 */
export const RESEED_FIELDS = ['timelineMitigations', 'timelineEvents', 'phases', 'partyMembers'] as const;
export type ReseedField = (typeof RESEED_FIELDS)[number];

export type FieldCounts = Record<ReseedField, number>;

/**
 * 「doc 側が空(0件) かつ 手元が非空(>0)」のフィールド集合を返す(=手元を正として再シードすべき)。
 * これにより「再接続/desync で一瞬空になった部屋」が手元の非空データを潰すのを防ぐ。
 */
export function fieldsNeedingReseed(doc: FieldCounts, local: FieldCounts): Set<ReseedField> {
  const out = new Set<ReseedField>();
  for (const key of RESEED_FIELDS) {
    if (doc[key] === 0 && local[key] > 0) out.add(key);
  }
  return out;
}

/**
 * データ安全(2026-08-07監査): 手元データ(loadedPlanId が指すプラン)が、今から接続する
 * 部屋(roomToken)のものだと信頼してよいかを判定する。false のときは reseedEmptyDocFields を
 * 呼ばない(部屋への書き込みだけを止める。sync 自体は継続され、部屋の真のデータで手元は
 * 上書きされるので、共同編集自体は問題なく始まる)。
 * 詳細: docs/superpowers/specs/2026-08-07-collab-reseed-trust-boundary-design.md
 */
export function canTrustLocalDataForRoom(args: {
  loadedPlanId: string | null;
  roomToken: string;
  plans: SavedPlan[];
}): boolean {
  const { loadedPlanId, roomToken, plans } = args;
  if (!loadedPlanId) return false;
  const plan = plans.find((p) => p.id === loadedPlanId);
  if (!plan) return false;
  return plan.activeCollabRoomToken === roomToken;
}
