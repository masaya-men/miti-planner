// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHousingerReport } from '../useHousingerReport';

vi.mock('../../../../lib/housingAuthHeaders', () => ({
  buildHousingHeaders: vi.fn(async () => ({
    'Content-Type': 'application/json',
    'X-Firebase-AppCheck': 'app-check-token',
    Authorization: 'Bearer mock-token',
  })),
}));

describe('useHousingerReport', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('成功時 ok=true を返す', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingerReport());
    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.report('uid-1', 'inappropriate_name');
    });
    expect(res).toEqual({ ok: true });
  });

  it('409 のとき duplicate_report を返す', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'duplicate_report' }),
    });
    const { result } = renderHook(() => useHousingerReport());
    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.report('uid-1', 'inappropriate_name');
    });
    expect(res).toEqual({ ok: false, error: 'duplicate_report' });
  });

  it('403 のとき cannot_report_own を返す', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'cannot_report_own' }),
    });
    const { result } = renderHook(() => useHousingerReport());
    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.report('uid-1', 'other', 'x');
    });
    expect(res).toEqual({ ok: false, error: 'cannot_report_own' });
  });

  it('App Check ヘッダと housingerUid/reason/comment を付けて送る', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingerReport());
    await act(async () => {
      await result.current.report('uid-1', 'other', 'なりすましっぽい');
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/housing?action=report-housinger',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Firebase-AppCheck': 'app-check-token',
          Authorization: 'Bearer mock-token',
        }),
        body: JSON.stringify({
          housingerUid: 'uid-1',
          reason: 'other',
          comment: 'なりすましっぽい',
        }),
      }),
    );
  });
});
