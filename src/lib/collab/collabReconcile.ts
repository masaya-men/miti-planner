/** 管制の入力: 現在のセッション所属と、切替先のプラン ID。 */
export interface CollabReconcileInput {
  sessionActive: boolean;
  collabPlanId: string | null;
  newPlanId: string | null;
}

/** 管制が取るアクション。Task 6 で 'connect' を追加する。 */
export type CollabAction =
  | { type: 'none' }
  | { type: 'disconnect-and-reload' };

/**
 * 「見ているプラン ≠ セッション所属プラン」になったら切断+再ロードを指示する。
 * collab セッションは常に現在プランに束縛されるべき (本番ロールバックの根治)。
 */
export function decideCollabAction(input: CollabReconcileInput): CollabAction {
  if (input.sessionActive && input.collabPlanId !== input.newPlanId) {
    return { type: 'disconnect-and-reload' };
  }
  return { type: 'none' };
}
