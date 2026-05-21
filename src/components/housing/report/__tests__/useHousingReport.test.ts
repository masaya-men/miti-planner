// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHousingReport } from '../useHousingReport';

vi.mock('firebase/auth', () => ({
  getAuth: () => ({
    currentUser: { getIdToken: async () => 'mock-token' },
  }),
}));

describe('useHousingReport', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('成功時 ok=true を返す', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingReport());
    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.report('lid1', 'wrong_info');
    });
    expect(res).toEqual({ ok: true });
  });

  it('409 のとき duplicate_report を返す', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'duplicate_report' }),
    });
    const { result } = renderHook(() => useHousingReport());
    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.report('lid1', 'wrong_info');
    });
    expect(res).toEqual({ ok: false, error: 'duplicate_report' });
  });

  it('comment を含むときは body に乗せる', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingReport());
    await act(async () => {
      await result.current.report('lid1', 'other', '窓位置が違う');
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/housing?action=report-listing',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        }),
        body: JSON.stringify({
          listingId: 'lid1',
          reason: 'other',
          comment: '窓位置が違う',
        }),
      }),
    );
  });
});
