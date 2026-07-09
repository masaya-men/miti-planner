// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// getDoc の戻り値をテストごとに制御する (housing_listings/{id} 読み取り)
const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  // findListingsByAddressKey (peers 取得) / useNotifications が経由する他 export は
  // このテストでは実データを問わないため no-op スタブ
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ docs: [] })),
  onSnapshot: vi.fn(() => () => {}),
  getFirestore: vi.fn(() => ({})),
}));

// useNotifications は firebase/auth の getAuth() を直接使う (未ログイン=購読スキップ)
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
}));

// hook 本体が使う auth/db は lib/firebase 経由 (未ログイン)
vi.mock('../../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: null },
}));

// useHousingDelete/useResolveReport/useNotifications/purgeIfTweetGone が経由する
// App Check + Bearer ヘッダビルダー。 このテストでは削除/通報系アクションを実行しないため
// 呼ばれない想定だが、 import chain (firebase/app-check) を実 firebase に触れさせないため差し替える。
vi.mock('../../../../lib/housingAuthHeaders', () => ({
  buildHousingHeaders: vi.fn(async () => ({})),
}));

import { useHousingDetail } from '../useHousingDetail';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('useHousingDetail', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
  });

  it('doc が exists()=false のとき notFound=true / listing=null (loadListing 配線が移送後も生きている証明)', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const { result } = renderHook(() => useHousingDetail('lid-notfound'), { wrapper });

    await waitFor(() => {
      expect(result.current.notFound).toBe(true);
    });
    expect(result.current.listing).toBeNull();
  });

  it('notification クエリが無いとき reportNotice は undefined (gating の証明)', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'lid-ok',
      data: () => ({
        ownerUid: 'owner1',
        dc: 'Mana',
        server: 'Anima',
        area: 'Mist',
        ward: 5,
        buildingType: 'house',
        plot: 12,
        size: 'M',
        addressKey: 'addr-1',
        imageMode: 'none',
        tags: [],
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        isHidden: false,
        reportCount: 0,
        deletedAt: null,
      }),
    });

    const { result } = renderHook(() => useHousingDetail('lid-ok'), { wrapper });

    await waitFor(() => {
      expect(result.current.listing).not.toBeNull();
    });
    expect(result.current.notFound).toBe(false);
    expect(result.current.reportNotice).toBeUndefined();
  });
});
