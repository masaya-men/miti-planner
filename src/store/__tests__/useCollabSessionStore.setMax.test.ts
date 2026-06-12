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

  it('stale なAPI応答は新しい楽観値を上書きしない(12→9 のちらつき防止)', async () => {
    // 1回目(=12)は手動で後から resolve、2回目(=9)は即時 resolve。
    let resolve12!: () => void;
    vi.mocked(setMaxParticipants)
      .mockImplementationOnce(
        () => new Promise((r) => { resolve12 = () => r({ roomToken: 't', maxParticipants: 12, revoked: false }); }),
      )
      .mockResolvedValueOnce({ roomToken: 't', maxParticipants: 9, revoked: false });

    const s = useCollabSessionStore.getState();
    s.setMax('p1', 12);
    await vi.advanceTimersByTimeAsync(400); // API(12) 発火(pending)
    s.setMax('p1', 9);                       // 楽観値=9
    expect(useCollabSessionStore.getState().maxParticipants).toBe(9);

    resolve12();                             // 古い 12 応答が遅れて到着
    await Promise.resolve();
    await Promise.resolve();
    expect(useCollabSessionStore.getState().maxParticipants).toBe(9); // 12 に戻らない

    await vi.advanceTimersByTimeAsync(400);  // API(9) 発火→確定 9
    expect(useCollabSessionStore.getState().maxParticipants).toBe(9);
  });
});
