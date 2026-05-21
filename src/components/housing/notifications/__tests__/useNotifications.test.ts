// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// onSnapshot を制御するため manual mock
const onSnapshotMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ __type: 'collection' })),
  query: vi.fn((...args: any[]) => ({ __type: 'query', args })),
  orderBy: vi.fn((field: string, dir: string) => ({ __type: 'orderBy', field, dir })),
  limit: vi.fn((n: number) => ({ __type: 'limit', n })),
  onSnapshot: (...args: any[]) => onSnapshotMock(...args),
  getFirestore: vi.fn(() => ({ __type: 'firestore' })),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'uid-1', getIdToken: async () => 'tok' } }),
}));

// markRead/markAllRead が経由する共有ヘルパー (実 firebase.ts のロード回避)
vi.mock('../../../../lib/housingAuthHeaders', () => ({
  buildHousingHeaders: vi.fn(async () => ({
    'Content-Type': 'application/json',
    'X-Firebase-AppCheck': 'app-check-token',
    Authorization: 'Bearer tok',
  })),
}));

import { useNotifications } from '../useNotifications';

describe('useNotifications', () => {
  beforeEach(() => {
    onSnapshotMock.mockReset();
    // デフォルトは何も呼ばない unsub stub
    onSnapshotMock.mockImplementation(() => () => {});
  });

  it('初期状態は空 (購読開始まで items は []、 unreadCount 0)', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('onSnapshot から流れてきた items を反映し unreadCount を計算', async () => {
    onSnapshotMock.mockImplementation((_q: any, cb: any) => {
      cb({
        docs: [
          {
            id: 'n1',
            data: () => ({
              type: 'housing_report',
              listingId: 'l1',
              reason: 'wrong_info',
              severity: 'normal',
              listingTitleSnapshot: 'A',
              createdAt: 1000,
              read: false,
            }),
          },
          {
            id: 'n2',
            data: () => ({
              type: 'housing_report',
              listingId: 'l2',
              reason: 'sold',
              severity: 'normal',
              listingTitleSnapshot: 'B',
              createdAt: 999,
              read: true,
            }),
          },
        ],
      });
      return () => {};
    });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => {
      expect(result.current.items.length).toBe(2);
    });
    expect(result.current.unreadCount).toBe(1);
  });
});
