import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../lib/collab/collabRoomApi', () => ({
  createRoom: vi.fn(),
  setMaxParticipants: vi.fn(),
  revokeRoom: vi.fn(),
  reissueRoom: vi.fn(),
}));

import { useCollabSessionStore } from '../useCollabSessionStore';
import { setMaxParticipants } from '../../lib/collab/collabRoomApi';

describe('useCollabSessionStore.setMax (楽観的更新 + デバウンス)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(setMaxParticipants).mockReset();
    useCollabSessionStore.setState({ maxParticipants: 8 });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('楽観的更新: maxParticipants が即時に変わり、API はまだ呼ばれない', () => {
    useCollabSessionStore.getState().setMax('p1', 12);
    expect(useCollabSessionStore.getState().maxParticipants).toBe(12);
    expect(setMaxParticipants).not.toHaveBeenCalled();
  });

  it('デバウンス: 連打しても API は最終値で1回だけ呼ばれる', async () => {
    vi.mocked(setMaxParticipants).mockResolvedValue({ roomToken: 't', maxParticipants: 15, revoked: false });
    const s = useCollabSessionStore.getState();
    s.setMax('p1', 9);
    s.setMax('p1', 10);
    s.setMax('p1', 15);
    expect(useCollabSessionStore.getState().maxParticipants).toBe(15);
    expect(setMaxParticipants).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(setMaxParticipants).toHaveBeenCalledTimes(1);
    expect(setMaxParticipants).toHaveBeenCalledWith('p1', 15);
  });

  it('reconcile: API の確定値で上書きする', async () => {
    vi.mocked(setMaxParticipants).mockResolvedValue({ roomToken: 't', maxParticipants: 20, revoked: false });
    useCollabSessionStore.getState().setMax('p1', 99);
    await vi.advanceTimersByTimeAsync(400);
    expect(useCollabSessionStore.getState().maxParticipants).toBe(20);
  });
});
