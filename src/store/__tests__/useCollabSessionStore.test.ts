// src/store/__tests__/useCollabSessionStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/collab/collabRoomApi', () => ({
  createRoom: vi.fn(),
  setMaxParticipants: vi.fn(),
  revokeRoom: vi.fn(),
  reissueRoom: vi.fn(),
}));
vi.mock('../../lib/collab/collabProvider', () => ({
  startCollabSession: vi.fn(),
}));

import { createRoom, setMaxParticipants, revokeRoom, reissueRoom } from '../../lib/collab/collabRoomApi';
import { startCollabSession } from '../../lib/collab/collabProvider';
import { useCollabSessionStore } from '../useCollabSessionStore';
import { usePlanStore } from '../usePlanStore';

const mk = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

function fakeSession() {
  return { provider: {} as any, doc: {} as any, disconnect: vi.fn() };
}

beforeEach(() => {
  mk(createRoom).mockReset();
  mk(setMaxParticipants).mockReset();
  mk(revokeRoom).mockReset();
  mk(reissueRoom).mockReset();
  mk(startCollabSession).mockReset();
  useCollabSessionStore.setState({ active: false, roomToken: null, maxParticipants: 8, session: null, collabPlanId: null });
});

describe('useCollabSessionStore', () => {
  it('start: createRoom→startCollabSession→active=true', async () => {
    mk(createRoom).mockResolvedValue({ roomToken: 'tok', maxParticipants: 8, revoked: false });
    const sess = fakeSession();
    mk(startCollabSession).mockReturnValue(sess);
    usePlanStore.setState({ currentPlanId: 'plan1' } as any); // 束縛ガード: 現在表示プランと一致

    await useCollabSessionStore.getState().start('plan1');

    // ⑤-3c: start は label を任意で受け、createRoom(planId, max?, label?) に渡す(未指定は undefined)。
    expect(createRoom).toHaveBeenCalledWith('plan1', undefined, undefined);
    expect(startCollabSession).toHaveBeenCalledWith('tok');
    const s = useCollabSessionStore.getState();
    expect(s.active).toBe(true);
    expect(s.roomToken).toBe('tok');
    expect(s.maxParticipants).toBe(8);
    expect(s.session).toBe(sess);
  });

  it('setMax: setMaxParticipants→maxParticipants 更新', async () => {
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', maxParticipants: 8, session: fakeSession() });
    mk(setMaxParticipants).mockResolvedValue({ roomToken: 'tok', maxParticipants: 12, revoked: false });

    await useCollabSessionStore.getState().setMax('plan1', 12);

    expect(setMaxParticipants).toHaveBeenCalledWith('plan1', 12);
    expect(useCollabSessionStore.getState().maxParticipants).toBe(12);
  });

  it('revoke: revokeRoom→session.disconnect→active=false でクリア', async () => {
    const sess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', maxParticipants: 8, session: sess });
    mk(revokeRoom).mockResolvedValue({ revoked: true });

    await useCollabSessionStore.getState().revoke('plan1');

    expect(revokeRoom).toHaveBeenCalledWith('plan1');
    expect(sess.disconnect).toHaveBeenCalled();
    const s = useCollabSessionStore.getState();
    expect(s.active).toBe(false);
    expect(s.roomToken).toBeNull();
    expect(s.session).toBeNull();
  });

  it('start: collabPlanId に planId を記録する', async () => {
    mk(createRoom).mockResolvedValue({ roomToken: 'tok', maxParticipants: 8, revoked: false });
    mk(startCollabSession).mockReturnValue(fakeSession());
    usePlanStore.setState({ currentPlanId: 'planA' } as any);
    await useCollabSessionStore.getState().start('planA');
    expect(useCollabSessionStore.getState().collabPlanId).toBe('planA');
  });

  it('start: 既存セッションがあれば先に disconnect してから張り直す', async () => {
    const oldSess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'old', session: oldSess, collabPlanId: 'planA', maxParticipants: 8 });
    mk(createRoom).mockResolvedValue({ roomToken: 'new', maxParticipants: 8, revoked: false });
    mk(startCollabSession).mockReturnValue(fakeSession());
    usePlanStore.setState({ currentPlanId: 'planB' } as any);
    await useCollabSessionStore.getState().start('planB');
    expect(oldSess.disconnect).toHaveBeenCalled();
    expect(useCollabSessionStore.getState().collabPlanId).toBe('planB');
  });

  it('connectExisting: room 新規作成なしで既存 token に接続し collabPlanId を記録', async () => {
    const newSess = fakeSession();
    mk(startCollabSession).mockReturnValue(newSess);
    usePlanStore.setState({ currentPlanId: 'planB' } as any); // 束縛ガード: 現在表示プランと一致
    await useCollabSessionStore.getState().connectExisting('tokB', 'planB');
    expect(createRoom).not.toHaveBeenCalled();         // room は発行しない (既存リンクへ接続)
    expect(startCollabSession).toHaveBeenCalledWith('tokB');
    const s = useCollabSessionStore.getState();
    expect(s.active).toBe(true);
    expect(s.roomToken).toBe('tokB');
    expect(s.collabPlanId).toBe('planB');
    expect(s.session).toBe(newSess);
  });

  it('connectExisting: 既存セッションがあれば先に disconnect してから張り直す', async () => {
    const oldSess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'old', session: oldSess, collabPlanId: 'A', maxParticipants: 8 });
    mk(startCollabSession).mockReturnValue(fakeSession());
    usePlanStore.setState({ currentPlanId: 'planB' } as any);
    await useCollabSessionStore.getState().connectExisting('tokB', 'planB');
    expect(oldSess.disconnect).toHaveBeenCalled();
    expect(useCollabSessionStore.getState().collabPlanId).toBe('planB');
  });

  it('connectExisting: 非同期 import 中に別プランへ移っていたら接続しない(束縛ガード=増殖バグ再発防止)', async () => {
    mk(startCollabSession).mockReturnValue(fakeSession());
    usePlanStore.setState({ currentPlanId: 'planC' } as any); // 既に別プランを見ている
    await useCollabSessionStore.getState().connectExisting('tokB', 'planB');
    expect(startCollabSession).not.toHaveBeenCalled();         // 古い接続は張らない
    expect(useCollabSessionStore.getState().active).toBe(false);
  });

  it('revoke: collabPlanId も null に戻す', async () => {
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', session: fakeSession(), collabPlanId: 'planA', maxParticipants: 8 });
    mk(revokeRoom).mockResolvedValue({ revoked: true });
    await useCollabSessionStore.getState().revoke('planA');
    expect(useCollabSessionStore.getState().collabPlanId).toBeNull();
  });

  it('reissue: 旧 disconnect→reissueRoom→新 startCollabSession', async () => {
    const oldSess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'old', maxParticipants: 8, session: oldSess });
    mk(reissueRoom).mockResolvedValue({ roomToken: 'new', maxParticipants: 8, revoked: false });
    const newSess = fakeSession();
    mk(startCollabSession).mockReturnValue(newSess);
    usePlanStore.setState({ currentPlanId: 'plan1' } as any);

    await useCollabSessionStore.getState().reissue('plan1');

    expect(oldSess.disconnect).toHaveBeenCalled();
    // ⑤-3c: reissue は label を任意で受け、reissueRoom(planId, label?) に渡す(未指定は undefined)。
    expect(reissueRoom).toHaveBeenCalledWith('plan1', undefined);
    expect(startCollabSession).toHaveBeenCalledWith('new');
    const s = useCollabSessionStore.getState();
    expect(s.roomToken).toBe('new');
    expect(s.session).toBe(newSess);
    expect(s.active).toBe(true);
  });
});
