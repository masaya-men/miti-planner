// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHousingUpdate } from '../useHousingUpdate';

vi.mock('../../../../lib/housingAuthHeaders', () => ({
  buildHousingHeaders: vi.fn(async () => ({
    'Content-Type': 'application/json',
    'X-Firebase-AppCheck': 'app-check-token',
    Authorization: 'Bearer mock-token',
  })),
}));

describe('useHousingUpdate', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('成功時に ok=true を返す', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingUpdate());
    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.update('lid1', { description: 'updated' });
    });
    expect(res).toEqual({ ok: true });
  });

  it('403 で ok=false + error=forbidden を返す', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden' }),
    });
    const { result } = renderHook(() => useHousingUpdate());
    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.update('lid1', {});
    });
    expect(res).toEqual({ ok: false, error: 'forbidden' });
  });

  it('App Check + Bearer ヘッダと JSON body を載せる', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingUpdate());
    await act(async () => {
      await result.current.update('lid1', { description: 'foo' });
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/housing?action=update-listing',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Firebase-AppCheck': 'app-check-token',
          Authorization: 'Bearer mock-token',
        }),
        body: JSON.stringify({ listingId: 'lid1', description: 'foo' }),
      }),
    );
  });
});
