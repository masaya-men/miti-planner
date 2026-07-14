// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useSystemNotifications } from '../useSystemNotifications';
import { STORAGE_KEY } from '../../lib/systemNotifReadStorage';

describe('useSystemNotifications', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    vi.restoreAllMocks();
  });

  function mockFetchOnce(docs: Array<{ id: string; data: Record<string, unknown> }>) {
    const items = docs.map((d) => ({ id: d.id, ...d.data }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items }),
      }),
    );
  }

  it('公開窓口 fetch の items を返す (新着順は API 側が保証)', async () => {
    mockFetchOnce([
      { id: 'n1', data: { title: { ja: 'a', en: 'A' }, body: { ja: 'aa', en: 'AA' }, published: true, createdAt: 200, updatedAt: 200 } },
      { id: 'n2', data: { title: { ja: 'b', en: 'B' }, body: { ja: 'bb', en: 'BB' }, published: true, createdAt: 100, updatedAt: 100 } },
    ]);
    const { result } = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(fetch).toHaveBeenCalledWith('/api/template?action=public-notifications');
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.latestUnread?.id).toBe('n1');
  });

  it('未読 0 なら latestUnread は null', async () => {
    mockFetchOnce([
      { id: 'n1', data: { title: { ja: 'a', en: 'A' }, body: { ja: 'aa', en: 'AA' }, published: true, createdAt: 200, updatedAt: 200 } },
    ]);
    const { result } = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.markRead('n1'));
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.latestUnread).toBeNull();
  });

  it('markRead 後、 既読 id は localStorage に保存される', async () => {
    mockFetchOnce([
      { id: 'n1', data: { title: { ja: 'a', en: 'A' }, body: { ja: 'aa', en: 'AA' }, published: true, createdAt: 100, updatedAt: 100 } },
    ]);
    const { result } = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.markRead('n1'));
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain('n1');
  });

  it('fetch 失敗時は items を維持する (握りつぶし)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { result } = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current.items).toEqual([]);
  });
});
