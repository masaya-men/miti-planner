import { describe, it, expect, vi, beforeEach } from 'vitest';

// loadPlanDataIntoStore は本物の loadSnapshot を走らせると重い PlanData が要るため、
// ここでは「再ロードが正しいプランで呼ばれるか」だけを観測する(loadSnapshot 自体の
// 正しさは planLoad.test.ts が担保)。
vi.mock('../../planLoad', () => ({
  loadPlanDataIntoStore: vi.fn(async () => undefined),
}));

import { reconcileCollabForPlan } from '../collabLifecycle';
import { loadPlanDataIntoStore } from '../../planLoad';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';
import { usePlanStore } from '../../../store/usePlanStore';

const mk = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

function fakeSession() {
  return { provider: {} as any, doc: {} as any, disconnect: vi.fn() };
}

beforeEach(() => {
  mk(loadPlanDataIntoStore).mockClear();
  useCollabSessionStore.setState({ active: false, roomToken: null, maxParticipants: 8, session: null, collabPlanId: null });
  usePlanStore.setState({ plans: [{ id: 'B', data: { marker: 'B' } } as any], currentPlanId: 'A' as any });
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
});
