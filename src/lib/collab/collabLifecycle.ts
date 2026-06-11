import { useCollabSessionStore } from '../../store/useCollabSessionStore';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { loadPlanDataIntoStore } from '../planLoad';
import { decideCollabAction } from './collabReconcile';

/**
 * collab ライフサイクル管制の本体。「見ているプラン = 接続先」を常に一致させる。
 *
 * currentPlanId が newPlanId に変わったとき、collab セッションが別プランに属して
 * いれば必ず disconnect (exitCollabMode + observer 解除) し、切替先プランを再ロードする。
 * これが本番ロールバックの根治 (collab セッションを常に現在プランに束縛する不変条件2)。
 *
 * Layout の usePlanStore.subscribe から呼ぶ。stores は getState 経由で触り、stores 側は
 * このモジュールを import しない一方向依存なので循環 import を作らない。
 *
 * 注: 再ロードは loadPlanDataIntoStore に委譲。切替経路 (Sidebar 通常/アーカイブ) は
 * setCurrentPlanId の前に plan.data を確定済みなので、ここでの再ロードは同期的に走る
 * (圧縮プランの非同期解凍ウィンドウは発生しない)。
 */
export function reconcileCollabForPlan(newPlanId: string | null): void {
  const sess = useCollabSessionStore.getState();
  const p = usePlanStore.getState().plans.find((x) => x.id === newPlanId);
  const action = decideCollabAction({
    sessionActive: sess.active,
    collabPlanId: sess.collabPlanId,
    newPlanId,
    newPlanRoomToken: p?.activeCollabRoomToken,
    isOwner: !!p && p.ownerId === useAuthStore.getState().user?.uid,
  });

  if (action.type === 'disconnect-and-reload') {
    sess.session?.disconnect(); // exitCollabMode + observer 解除 (collabProvider.disconnect)
    useCollabSessionStore.setState({ active: false, roomToken: null, session: null, collabPlanId: null, maxParticipants: 8 });
    // disconnect 後 (_collabActive=false) に現在プランを再ロード。
    if (p) void loadPlanDataIntoStore(p);
    return;
  }
  if (action.type === 'connect') {
    // 未接続で collab-ON の自分のプランを開いた → 既存リンクへ自動接続 (部屋が真実なので再ロードしない)。
    useCollabSessionStore.getState().connectExisting(action.roomToken, action.planId);
  }
}
