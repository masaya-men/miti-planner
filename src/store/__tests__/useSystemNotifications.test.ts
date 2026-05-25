// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// firebase/firestore を mock。 既存テスト (useShareImportFlow.test.ts 等) のパターン参考。
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    getFirestore: () => ({}),
    collection: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(),
  };
});

import { onSnapshot } from 'firebase/firestore';
import { useSystemNotifications } from '../useSystemNotifications';
import { STORAGE_KEY } from '../../lib/systemNotifReadStorage';

describe('useSystemNotifications', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    vi.clearAllMocks();
  });

  function setupSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
    (onSnapshot as unknown as ReturnType<typeof vi.fn>).mockImplementation((_q: unknown, cb: (s: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) => {
      cb({
        docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
      });
      return () => {}; // unsub
    });
  }

  it('購読 doc を items として返す (新着順 = orderBy createdAt desc は mock 任せ)', () => {
    setupSnapshot([
      { id: 'n1', data: { title: { ja: 'a', en: 'A' }, body: { ja: 'aa', en: 'AA' }, published: true, createdAt: 200, updatedAt: 200 } },
      { id: 'n2', data: { title: { ja: 'b', en: 'B' }, body: { ja: 'bb', en: 'BB' }, published: true, createdAt: 100, updatedAt: 100 } },
    ]);
    const { result } = renderHook(() => useSystemNotifications());
    expect(result.current.items).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.latestUnread?.id).toBe('n1');
  });

  it('未読 0 なら latestUnread は null', () => {
    setupSnapshot([
      { id: 'n1', data: { title: { ja: 'a', en: 'A' }, body: { ja: 'aa', en: 'AA' }, published: true, createdAt: 200, updatedAt: 200 } },
    ]);
    const { result } = renderHook(() => useSystemNotifications());
    act(() => result.current.markRead('n1'));
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.latestUnread).toBeNull();
  });

  it('markRead 後、 既読 id は localStorage に保存される', () => {
    setupSnapshot([
      { id: 'n1', data: { title: { ja: 'a', en: 'A' }, body: { ja: 'aa', en: 'AA' }, published: true, createdAt: 100, updatedAt: 100 } },
    ]);
    const { result } = renderHook(() => useSystemNotifications());
    act(() => result.current.markRead('n1'));
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain('n1');
  });
});
