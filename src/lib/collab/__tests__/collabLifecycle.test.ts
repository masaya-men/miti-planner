import { describe, it, expect, vi, beforeEach } from 'vitest';

// loadPlanDataIntoStore は本物の loadSnapshot を走らせると重い PlanData が要るため、
// ここでは「再ロードが正しいプランで呼ばれるか」だけを観測する(loadSnapshot 自体の
// 正しさは planLoad.test.ts が担保)。
vi.mock('../../planLoad', () => ({
  loadPlanDataIntoStore: vi.fn(async () => undefined),
}));
// connectExisting が呼ぶ startCollabSession を WebSocket なしの fake に (collabProvider=遅延チャンク)。
vi.mock('../collabProvider', () => ({
  startCollabSession: vi.fn(() => ({ provider: {}, doc: {}, disconnect: vi.fn() })),
}));

import { reconcileCollabForPlan } from '../collabLifecycle';
import { loadPlanDataIntoStore } from '../../planLoad';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';
import { usePlanStore } from '../../../store/usePlanStore';
import { useAuthStore } from '../../../store/useAuthStore';

const mk = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

function fakeSession() {
  return { provider: {} as any, doc: {} as any, disconnect: vi.fn() };
}

beforeEach(() => {
  mk(loadPlanDataIntoStore).mockClear();
  useCollabSessionStore.setState({ active: false, roomToken: null, maxParticipants: 8, session: null, collabPlanId: null });
  usePlanStore.setState({ plans: [{ id: 'B', data: { marker: 'B' } } as any], currentPlanId: 'A' as any });
  useAuthStore.setState({ user: null } as any);
});

describe('reconcileCollabForPlan (collab ライフサイクル管制の本体)', () => {
  it('collab 接続中に別プランへ移動 → 必ず disconnect + セッションクリア + 現在プラン再ロード', () => {
    const sess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', session: sess, collabPlanId: 'A', maxParticipants: 8 });

    reconcileCollabForPlan('B');

    expect(sess.disconnect).toHaveBeenCalledTimes(1);            // observer 解除 + exitCollabMode
    const s = useCollabSessionStore.getState();
    expect(s.active).toBe(false);                                // セッション状態クリア
    expect(s.session).toBeNull();
    expect(s.collabPlanId).toBeNull();
    expect(loadPlanDataIntoStore).toHaveBeenCalledTimes(1);      // 切替先プランを再ロード
    expect(mk(loadPlanDataIntoStore).mock.calls[0][0]).toMatchObject({ id: 'B' });
  });

  it('未接続なら何もしない (ソロ利用者に一切の副作用なし)', () => {
    reconcileCollabForPlan('B');
    expect(loadPlanDataIntoStore).not.toHaveBeenCalled();
    expect(useCollabSessionStore.getState().active).toBe(false);
  });

  it('接続中でも同じプランのままなら切断しない (誤切断防止)', () => {
    const sess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', session: sess, collabPlanId: 'A', maxParticipants: 8 });

    reconcileCollabForPlan('A');

    expect(sess.disconnect).not.toHaveBeenCalled();
    expect(useCollabSessionStore.getState().active).toBe(true);
    expect(loadPlanDataIntoStore).not.toHaveBeenCalled();
  });

  it('接続中にプラン未選択(null)へ → 切断はするが再ロード対象が無いので loadPlan は呼ばない', () => {
    const sess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', session: sess, collabPlanId: 'A', maxParticipants: 8 });

    reconcileCollabForPlan(null);

    expect(sess.disconnect).toHaveBeenCalledTimes(1);
    expect(useCollabSessionStore.getState().active).toBe(false);
    expect(loadPlanDataIntoStore).not.toHaveBeenCalled();
  });

  // Task 6: collab-ON プランを開いたらオーナーは自動接続
  // connectExisting は collabProvider を動的 import するため非同期(vi.waitFor で確立を待つ)。
  it('未接続で collab-ON の自分のプランを開いた → connectExisting で自動接続(オーナー)', async () => {
    useAuthStore.setState({ user: { uid: 'owner1' } } as any);
    // reconcile('B') は currentPlanId が 'B' になった瞬間に発火する=束縛ガードと整合。
    usePlanStore.setState({ plans: [{ id: 'B', data: { marker: 'B' }, ownerId: 'owner1', activeCollabRoomToken: 'tokB' } as any], currentPlanId: 'B' as any });

    reconcileCollabForPlan('B');

    await vi.waitFor(() => {
      expect(useCollabSessionStore.getState().active).toBe(true);
    });
    const s = useCollabSessionStore.getState();
    expect(s.roomToken).toBe('tokB');
    expect(s.collabPlanId).toBe('B');
    expect(loadPlanDataIntoStore).not.toHaveBeenCalled(); // connect は再ロードしない (部屋が真実)
  });

  it('collab-ON でも自分がオーナーでなければ自動接続しない', () => {
    useAuthStore.setState({ user: { uid: 'someoneElse' } } as any);
    usePlanStore.setState({ plans: [{ id: 'B', data: {}, ownerId: 'owner1', activeCollabRoomToken: 'tokB' } as any], currentPlanId: 'A' as any });

    reconcileCollabForPlan('B');

    expect(useCollabSessionStore.getState().active).toBe(false);
  });

  // ON→ON 切替: 別の collab-ON 自分プランへ移ったら、旧部屋を切断後にその部屋へライブ接続し直す(業界標準)。
  it('接続中に別の collab-ON 自分プランへ移動 → 切断後にその部屋へ接続(ON→ONもライブ)', async () => {
    useAuthStore.setState({ user: { uid: 'owner1' } } as any);
    const oldSess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'tokA', session: oldSess, collabPlanId: 'A', maxParticipants: 8 });
    usePlanStore.setState({ plans: [{ id: 'B', data: { marker: 'B' }, ownerId: 'owner1', activeCollabRoomToken: 'tokB' } as any], currentPlanId: 'B' as any });

    reconcileCollabForPlan('B');

    expect(oldSess.disconnect).toHaveBeenCalledTimes(1);   // 旧部屋 A を切断
    expect(loadPlanDataIntoStore).toHaveBeenCalled();      // B をローカル再ロード(即時表示)
    await vi.waitFor(() => {                                // 切断後に B の部屋へライブ接続
      const s = useCollabSessionStore.getState();
      expect(s.active).toBe(true);
      expect(s.collabPlanId).toBe('B');
    });
    expect(useCollabSessionStore.getState().roomToken).toBe('tokB');
  });
});
