/** 管制の入力: 現在のセッション所属と、切替先のプラン ID。 */
export interface CollabReconcileInput {
  sessionActive: boolean;
  collabPlanId: string | null;
  newPlanId: string | null;
  /** 切替先プランが collab-ON なら有効なルームトークン (OFF/非所持は undefined)。 */
  newPlanRoomToken?: string;
  /** 切替先プランのオーナーが自分か (自動接続はオーナー本人のみ。ジョイナーは /collab/:token 経路)。 */
  isOwner?: boolean;
}

/** 管制が取るアクション。 */
export type CollabAction =
  | { type: 'none' }
  | { type: 'disconnect-and-reload' }
  | { type: 'connect'; roomToken: string; planId: string };

/**
 * 「見ているプラン ≠ セッション所属プラン」になったら切断+再ロードを指示する。
 * collab セッションは常に現在プランに束縛されるべき (本番ロールバックの根治)。
 * さらに未接続で collab-ON の自分のプランを開いたらオーナーは自動接続する (Task 6)。
 */
export function decideCollabAction(input: CollabReconcileInput): CollabAction {
  // 接続中で所属プランと違う → まず切断 (connect は切断後の次サイクルで判定)
  if (input.sessionActive && input.collabPlanId !== input.newPlanId) {
    return { type: 'disconnect-and-reload' };
  }
  // 未接続で、開いたプランが collab-ON かつオーナー本人 → 自動接続
  if (!input.sessionActive && input.newPlanId && input.newPlanRoomToken && input.isOwner) {
    return { type: 'connect', roomToken: input.newPlanRoomToken, planId: input.newPlanId };
  }
  return { type: 'none' };
}
