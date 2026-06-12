// src/store/useCollabSessionStore.ts
// 共同編集⑤-3a: オーナーの共同編集セッションを束ねる store。
// 「リンク発行→接続」「人数変更」「失効→切断」「再発行→張り直し」を1経路にまとめる。
// CollabSession(provider/doc/disconnect)を保持するため永続化しない(非シリアライズ)。
// 実際の Yjs 接続は startCollabSession(collabProvider)、サーバ操作は collabRoomApi に委譲。
import { create } from 'zustand';
import { createRoom, setMaxParticipants, revokeRoom, reissueRoom } from '../lib/collab/collabRoomApi';
import type { CollabSession } from '../lib/collab/collabProvider';

// collabProvider は yjs/y-partyserver を抱える遅延チャンク。ソロ利用者の初期 bundle に
// 載せないため値としては動的 import する(この store は ShareButtons 経由で main に入るので
// 静的 import すると yjs が main に混入する)。型は import type なので erase され影響なし。
const loadProvider = () => import('../lib/collab/collabProvider');

// 人数変更のデバウンス: 連打しても最後の値だけサーバへ送る(往復待ちで表示が遅れるのを防ぐ)。
let maxSyncTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_SYNC_DEBOUNCE_MS = 400;

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
  /** 既存トークンへ接続(room 新規作成なし)。collab-ON プランを開いた時の自動接続(Task 6)。
   *  collabProvider を動的 import するため async(呼び出し側は fire-and-forget で良い)。 */
  connectExisting: (roomToken: string, planId: string) => Promise<void>;
  /** 入れる人数を変更(楽観的更新で即時反映・API はデバウンスで最終値のみ送信)。 */
  setMax: (planId: string, n: number) => void;
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
    // ルーム発行済 = プランは collab-ON。先にローカル plan へ反映(バッジ・自動接続)。
    const { usePlanStore } = await import('./usePlanStore');
    usePlanStore.getState().updatePlan(planId, { activeCollabRoomToken: info.roomToken });
    // 非同期(createRoom/import)の間に別プランへ移っていたらライブ接続は張らない。
    // 「見ているプラン = 接続先」の不変条件 (本番ロールバックの根治)。戻れば Task6 自動接続が拾う。
    if (usePlanStore.getState().currentPlanId !== planId) return;
    const { startCollabSession } = await loadProvider();
    const session = startCollabSession(info.roomToken);
    set({ active: true, roomToken: info.roomToken, maxParticipants: info.maxParticipants, session, collabPlanId: planId });
  },

  connectExisting: async (roomToken, planId) => {
    // 二重接続リーク防止: 既存セッションがあれば先に切断してから張り直す。
    get().session?.disconnect();
    const { startCollabSession } = await loadProvider();
    // 非同期 import の間に別プランへ移っていたら、この接続はもう古い。
    // 「見ているプラン = 接続先」の不変条件を守り、表示プランと違う部屋に束縛させない。
    const { usePlanStore } = await import('./usePlanStore');
    if (usePlanStore.getState().currentPlanId !== planId) return;
    const session = startCollabSession(roomToken);
    // room API を叩かず既存リンクへ繋ぐだけ。maxParticipants はオーナーパネルで取得すれば足りる(既定維持)。
    set({ active: true, roomToken, session, collabPlanId: planId });
  },

  setMax: (planId, n) => {
    // 楽観的更新: クリックで即時に表示へ反映(サーバ往復を待たない)。
    set({ maxParticipants: n });
    // デバウンス: 連打中は送らず、止まってから最終値だけ送る。
    if (maxSyncTimer) clearTimeout(maxSyncTimer);
    const requested = n;
    maxSyncTimer = setTimeout(() => {
      maxSyncTimer = null;
      void setMaxParticipants(planId, requested)
        .then((info) => {
          // stale なレスポンス破棄: 送った値が今も表示されている時だけ reconcile する。
          // (例: 12→9 と動かした時、先に飛んだ 12 の応答が遅れて来ても 9 を 12 に戻さない)
          if (get().maxParticipants === requested) set({ maxParticipants: info.maxParticipants });
        })
        .catch(() => { /* 反映失敗時は楽観値のまま(次の操作で再送される) */ });
    }, MAX_SYNC_DEBOUNCE_MS);
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
    const { startCollabSession } = await loadProvider();
    // 非同期の間に別プランへ移っていたら張り直さない(現在表示プラン束縛)。
    const { usePlanStore } = await import('./usePlanStore');
    if (usePlanStore.getState().currentPlanId !== planId) return;
    const session = startCollabSession(info.roomToken);
    set({ active: true, roomToken: info.roomToken, maxParticipants: info.maxParticipants, session, collabPlanId: planId });
  },
}));
