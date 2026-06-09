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
  useCollabSessionStore.setState({ active: false, roomToken: null, maxParticipants: 8, session: null });
});

describe('useCollabSessionStore', () => {
  it('start: createRoom→startCollabSession→active=true', async () => {
    mk(createRoom).mockResolvedValue({ roomToken: 'tok', maxParticipants: 8, revoked: false });
    const sess = fakeSession();
    mk(startCollabSession).mockReturnValue(sess);

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

  it('reissue: 旧 disconnect→reissueRoom→新 startCollabSession', async () => {
    const oldSess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'old', maxParticipants: 8, session: oldSess });
    mk(reissueRoom).mockResolvedValue({ roomToken: 'new', maxParticipants: 8, revoked: false });
    const newSess = fakeSession();
    mk(startCollabSession).mockReturnValue(newSess);

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
