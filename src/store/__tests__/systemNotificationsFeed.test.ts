// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import { useSystemNotifications } from '../useSystemNotifications';
import {
  __resetSystemNotificationsFeedForTest,
  refreshSystemNotifications,
  NOTIFICATIONS_MIN_REFETCH_MS,
  NOTIFICATIONS_BROWSER_CACHE_MS,
} from '../systemNotificationsFeed';
import { STORAGE_KEY } from '../../lib/systemNotifReadStorage';

const T0 = new Date('2026-11-05T00:00:00Z').getTime();

function item(id: string) {
  return { id, title: { ja: id, en: id }, body: { ja: id, en: id }, published: true, createdAt: 1, updatedAt: 1 };
}

function okResponse(ids: string[]) {
  return { ok: true, json: async () => ({ items: ids.map(item) }) };
}

function stubFetch(...ids: string[][]) {
  const fn = vi.fn();
  for (const set of ids) fn.mockResolvedValueOnce(okResponse(set));
  fn.mockResolvedValue(okResponse(ids[ids.length - 1] ?? []));
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function becomeVisible() {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
  });
}

describe('systemNotificationsFeed', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    __resetSystemNotificationsFeedForTest();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('3 部品が同時にマウントしても fetch は 1 回', async () => {
    const fetchFn = stubFetch(['a', 'b']);
    const hooks = [1, 2, 3].map(() => renderHook(() => useSystemNotifications()));
    for (const h of hooks) {
      await waitFor(() => expect(h.result.current.items).toHaveLength(2));
    }
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('前面復帰が前回成功から 5 分未満なら取りに行かない', async () => {
    const fetchFn = stubFetch(['a', 'b']);
    const h = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(h.result.current.items).toHaveLength(2));
    vi.setSystemTime(T0 + NOTIFICATIONS_MIN_REFETCH_MS - 1000);
    await becomeVisible();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('5 分以上たった前面復帰では取り直す', async () => {
    const fetchFn = stubFetch(['a', 'b'], ['a', 'b', 'c']);
    const h = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(h.result.current.items).toHaveLength(2));
    vi.setSystemTime(T0 + NOTIFICATIONS_MIN_REFETCH_MS);
    await becomeVisible();
    await waitFor(() => expect(h.result.current.items).toHaveLength(3));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('失敗した取得は時刻を進めない', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(okResponse(['a']));
    vi.stubGlobal('fetch', fetchFn);
    const h = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await becomeVisible();
    await waitFor(() => expect(h.result.current.items).toHaveLength(1));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('1 部品がアンマウントしても残りは更新を受け取る', async () => {
    stubFetch(['a'], ['a', 'b']);
    const h1 = renderHook(() => useSystemNotifications());
    const h2 = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(h2.result.current.items).toHaveLength(1));
    h1.unmount();
    vi.setSystemTime(T0 + NOTIFICATIONS_MIN_REFETCH_MS);
    await becomeVisible();
    await waitFor(() => expect(h2.result.current.items).toHaveLength(2));
  });

  it('購読者が 0 になったら visibilitychange を外す', async () => {
    const fetchFn = stubFetch(['a']);
    const h1 = renderHook(() => useSystemNotifications());
    const h2 = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(h1.result.current.items).toHaveLength(1));
    h1.unmount();
    h2.unmount();
    vi.setSystemTime(T0 + NOTIFICATIONS_MIN_REFETCH_MS * 2);
    await becomeVisible();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('force は 5 分未満でも URL に時刻の印を付けて取り直す (管理者の投稿直後)', async () => {
    const fetchFn = stubFetch(['a'], ['a', 'b']);
    const h = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(h.result.current.items).toHaveLength(1));
    await act(async () => { await refreshSystemNotifications({ force: true }); });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenLastCalledWith(`/api/template?action=public-notifications&t=${T0}`);
    expect(h.result.current.items).toHaveLength(2);
  });
  it("force の後 1 時間は、普通の取り直しも時刻の印を付ける(ブラウザが覚えた投稿前の応答に戻らない)", async () => {
    const fetchFn = stubFetch(["a"], ["a", "b"], ["a", "b"], ["a", "b"]);
    const h = renderHook(() => useSystemNotifications());
    await waitFor(() => expect(h.result.current.items).toHaveLength(1));
    await act(async () => { await refreshSystemNotifications({ force: true }); });
    const t1 = T0 + NOTIFICATIONS_MIN_REFETCH_MS;
    vi.setSystemTime(t1);
    await becomeVisible();
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(3));
    expect(fetchFn).toHaveBeenLastCalledWith(`/api/template?action=public-notifications&t=${t1}`);
    vi.setSystemTime(T0 + NOTIFICATIONS_BROWSER_CACHE_MS);
    await becomeVisible();
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(4));
    expect(fetchFn).toHaveBeenLastCalledWith("/api/template?action=public-notifications");
  });
});
