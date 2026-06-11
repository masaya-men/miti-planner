// src/store/useCollabSessionStore.ts
// 共同編集⑤-3a: オーナーの共同編集セッションを束ねる store。
// 「リンク発行→接続」「人数変更」「失効→切断」「再発行→張り直し」を1経路にまとめる。
// CollabSession(provider/doc/disconnect)を保持するため永続化しない(非シリアライズ)。
// 実際の Yjs 接続は startCollabSession(collabProvider)、サーバ操作は collabRoomApi に委譲。
import { create } from 'zustand';
import { createRoom, setMaxParticipants, revokeRoom, reissueRoom } from '../lib/collab/collabRoomApi';
import { startCollabSession, type CollabSession } from '../lib/collab/collabProvider';

interface CollabSessionState {
  /** 共同編集モードに入っているか(常設チップ/パネルの表示判定)。 */
  active: boolean;
  /** 現在のルームトークン(発行済リンクの鍵)。未発行は null。 */
  roomToken: string | null;
  /** オーナー設定の入れる人数(サーバがクランプ済の値)。 */
  maxParticipants: number;
  /** 生きている Yjs セッション(切断用)。UI には出さない。 */
  session: CollabSession | null;
  /** 現在のセッションが属するプラン ID。未接続は null。管制 (Layout) が現在プランと突き合わせる。 */
  collabPlanId: string | null;

  /** リンク発行(冪等)→自分の表をライブ接続。label は任意の部屋名(⑤-3c)。 */
  start: (planId: string, label?: string) => Promise<void>;
  /** 既存トークンへ接続(room 新規作成なし)。collab-ON プランを開いた時の自動接続(Task 6)。 */
  connectExisting: (roomToken: string, planId: string) => void;
  /** 入れる人数を変更。 */
  setMax: (planId: string, n: number) => Promise<void>;
  /** リンク失効→切断→クリア。 */
  revoke: (planId: string) => Promise<void>;
  /** 旧を切断・失効し新リンクで張り直し。label は任意の部屋名(⑤-3c)。 */
  reissue: (planId: string, label?: string) => Promise<void>;
}

export const useCollabSessionStore = create<CollabSessionState>((set, get) => ({
  active: false,
  roomToken: null,
  maxParticipants: 8,
  session: null,
  collabPlanId: null,

  start: async (planId, label) => {
    // 二重開始リーク防止: 既存セッションがあれば先に切断してから張り直す。
    get().session?.disconnect();
    const info = await createRoom(planId, undefined, label);
    const session = startCollabSession(info.roomToken);
    set({ active: true, roomToken: info.roomToken, maxParticipants: info.maxParticipants, session, collabPlanId: planId });
    // ローカル plan にも ON を反映(バッジ・自動接続の即時性。Firestore は room API が真実)。
    const { usePlanStore } = await import('./usePlanStore');
    usePlanStore.getState().updatePlan(planId, { activeCollabRoomToken: info.roomToken });
  },

  connectExisting: (roomToken, planId) => {
    // 二重接続リーク防止: 既存セッションがあれば先に切断してから張り直す。
    get().session?.disconnect();
    const session = startCollabSession(roomToken);
    // room API を叩かず既存リンクへ繋ぐだけ。maxParticipants はオーナーパネルで取得すれば足りる(既定維持)。
    set({ active: true, roomToken, session, collabPlanId: planId });
  },

  setMax: async (planId, n) => {
    const info = await setMaxParticipants(planId, n);
    set({ maxParticipants: info.maxParticipants });
  },

  revoke: async (planId) => {
    await revokeRoom(planId);
    get().session?.disconnect();
    set({ active: false, roomToken: null, session: null, collabPlanId: null });
    // ローカル plan の ON を解除(バッジ・自動接続の即時性)。
    const { usePlanStore } = await import('./usePlanStore');
    usePlanStore.getState().updatePlan(planId, { activeCollabRoomToken: undefined });
  },

  reissue: async (planId, label) => {
    get().session?.disconnect();
    const info = await reissueRoom(planId, label);
    const session = startCollabSession(info.roomToken);
    set({ active: true, roomToken: info.roomToken, maxParticipants: info.maxParticipants, session, collabPlanId: planId });
  },
}));
