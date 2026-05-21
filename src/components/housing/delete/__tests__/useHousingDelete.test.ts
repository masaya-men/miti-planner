// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHousingDelete } from '../useHousingDelete';

vi.mock('../../../../lib/housingAuthHeaders', () => ({
  buildHousingHeaders: vi.fn(async () => ({
    'Content-Type': 'application/json',
    'X-Firebase-AppCheck': 'app-check-token',
    Authorization: 'Bearer mock-token',
  })),
}));

describe('useHousingDelete', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('成功時 ok=true', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingDelete());
    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.deleteListing('lid1');
    });
    expect(res).toEqual({ ok: true });
  });

  it('404 で not_found', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'not_found' }),
    });
    const { result } = renderHook(() => useHousingDelete());
    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.deleteListing('lid1');
    });
    expect(res).toEqual({ ok: false, error: 'not_found' });
  });

  it('POST /api/housing?action=delete-listing を App Check + Bearer 付きで呼ぶ', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingDelete());
    await act(async () => {
      await result.current.deleteListing('lid1');
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/housing?action=delete-listing',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Firebase-AppCheck': 'app-check-token',
          Authorization: 'Bearer mock-token',
        }),
        body: JSON.stringify({ listingId: 'lid1' }),
      }),
    );
  });
});
