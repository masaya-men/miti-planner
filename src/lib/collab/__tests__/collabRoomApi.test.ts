// src/lib/collab/__tests__/collabRoomApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../apiClient', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../../apiClient';
import { createRoom, setMaxParticipants, revokeRoom, reissueRoom } from '../collabRoomApi';

const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>;
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => mockApi.mockReset());

describe('collabRoomApi', () => {
  it('createRoom は action=create を POST し roomToken を返す', async () => {
    mockApi.mockResolvedValue(ok({ roomToken: 'tok1', maxParticipants: 8, revoked: false }));
    const r = await createRoom('plan1');
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', planId: 'plan1' }),
    });
    expect(r).toEqual({ roomToken: 'tok1', maxParticipants: 8, revoked: false });
  });

  it('createRoom は maxParticipants 指定を body に含める', async () => {
    mockApi.mockResolvedValue(ok({ roomToken: 't', maxParticipants: 4, revoked: false }));
    await createRoom('plan1', 4);
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', expect.objectContaining({
      body: JSON.stringify({ action: 'create', planId: 'plan1', maxParticipants: 4 }),
    }));
  });

  it('setMaxParticipants は action=set-max を POST', async () => {
    mockApi.mockResolvedValue(ok({ roomToken: 't', maxParticipants: 12, revoked: false }));
    const r = await setMaxParticipants('plan1', 12);
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', expect.objectContaining({
      body: JSON.stringify({ action: 'set-max', planId: 'plan1', maxParticipants: 12 }),
    }));
    expect(r.maxParticipants).toBe(12);
  });

  it('revokeRoom は action=revoke を POST', async () => {
    mockApi.mockResolvedValue(ok({ revoked: true }));
    const r = await revokeRoom('plan1');
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', expect.objectContaining({
      body: JSON.stringify({ action: 'revoke', planId: 'plan1' }),
    }));
    expect(r).toEqual({ revoked: true });
  });

  it('reissueRoom は action=reissue を POST', async () => {
    mockApi.mockResolvedValue(ok({ roomToken: 'new', maxParticipants: 8, revoked: false }));
    const r = await reissueRoom('plan1');
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', expect.objectContaining({
      body: JSON.stringify({ action: 'reissue', planId: 'plan1' }),
    }));
    expect(r.roomToken).toBe('new');
  });

  it('非2xx は CollabRoomError を投げる(エラーコード付き)', async () => {
    mockApi.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'forbidden' }) });
    await expect(createRoom('plan1')).rejects.toMatchObject({ code: 'forbidden', status: 403 });
  });
});
