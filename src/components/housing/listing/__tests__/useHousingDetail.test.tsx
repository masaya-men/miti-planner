// @vitest-environment happy-dom
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Task 2.3 (Finding 2): useAuthStore の loading をテストごとに制御するため module 変数化。
// デフォルトは false (= 既存 6 テストは auth 復元済み前提のまま)。
let mockAuthLoading = false;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// useHousingDelete (削除 API クライアント) はテストごとに resolve 値を制御する。
const mockDeleteListing = vi.fn();
vi.mock('../../delete/useHousingDelete', () => ({
  useHousingDelete: () => ({ deleteListing: mockDeleteListing, loading: false }),
}));

// purgeIfTweetGone (SNS ツイート生存確認) もテストごとに resolve 値を制御する。
const mockPurgeIfTweetGone = vi.fn();
vi.mock('../../../../lib/housingApiClient', () => ({
  purgeIfTweetGone: (...args: unknown[]) => mockPurgeIfTweetGone(...args),
}));

// getDoc の戻り値をテストごとに制御する (housing_listings/{id} 読み取り)
const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  // useNotifications が経由する他 export は このテストでは実データを問わないため no-op スタブ
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ docs: [] })),
  onSnapshot: vi.fn(() => () => {}),
  getFirestore: vi.fn(() => ({})),
}));

// peers 取得 (2026-07-14 P1: 公開キャッシュ窓口 fetch へ切替)。 このテストでは peers の
// 内容そのものを問わないため、 デフォルトで空配列を返す no-op スタブに固定する。
// fetchPublicListing (P3 §3.5: getDoc 不可視/例外時のフォールバック) はこのテストでは
// getDoc が成功する既存シナリオが大半のため、 デフォルトで null (= フォールバックも空振り) に固定する。
vi.mock('../../../../lib/housing/publicHousingWindow', () => ({
  fetchPublicListingPeers: vi.fn(async () => []),
  fetchPublicListing: vi.fn(async () => null),
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

// Task 2.3: hook が auth-ready gate に使う useAuthStore。実モジュールは
// onAuthStateChanged 等 firebase/auth の他 export に依存し、このテストの
// firebase/auth モック (getAuth のみ) では読み込み時に落ちるため、
// 「auth 復元済み (loading:false)」を返す最小スタブに差し替える。
// Finding 2: mockAuthLoading (module 変数) を読むことで、gate 自体のテストも
// 同じスタブで制御できるようにする (デフォルトは false = 既存 6 テストに影響なし)。
vi.mock('../../../../store/useAuthStore', () => ({
  useAuthStore: (selector: (s: { loading: boolean }) => unknown) =>
    selector({ loading: mockAuthLoading }),
}));

// useHousingDelete/useResolveReport/useNotifications/purgeIfTweetGone が経由する
// App Check + Bearer ヘッダビルダー。 このテストでは削除/通報系アクションを実行しないため
// 呼ばれない想定だが、 import chain (firebase/app-check) を実 firebase に触れさせないため差し替える。
vi.mock('../../../../lib/housingAuthHeaders', () => ({
  buildHousingHeaders: vi.fn(async () => ({})),
}));

import { useHousingDetail } from '../useHousingDetail';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { fetchPublicListing } from '../../../../lib/housing/publicHousingWindow';
import type { HousingListing } from '../../../../types/housing';

const mockFetchPublicListing = vi.mocked(fetchPublicListing);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// 既存 2 テストと同じ形の getDoc スナップショットを都度組み立てるヘルパー。
// canViewListing (未ログイン viewer) を通す最小限のフィールドをデフォルトに持つ。
function buildListingSnap(id: string, dataOverrides: Record<string, unknown> = {}) {
  return {
    exists: () => true,
    id,
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
      ...dataOverrides,
    }),
  };
}

describe('useHousingDetail', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockDeleteListing.mockReset();
    mockPurgeIfTweetGone.mockReset();
    mockFetchPublicListing.mockReset();
    mockFetchPublicListing.mockResolvedValue(null);
    mockAuthLoading = false;
  });

  it('doc が exists()=false のとき notFound=true / listing=null (loadListing 配線が移送後も生きている証明)', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const { result } = renderHook(() => useHousingDetail('lid-notfound'), { wrapper });

    await waitFor(() => {
      expect(result.current.notFound).toBe(true);
    });
    expect(result.current.listing).toBeNull();
  });

  it('P3 §3.5: getDoc が permission-denied (unlisted 非オーナー等) のとき、公開窓口 (fetchPublicListing) の住所抜きレスポンスへフォールバックして listing をセットする (notFound にはしない)', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('permission-denied'));
    const windowListing = {
      id: 'lid-unlisted',
      ownerUid: 'owner1',
      visibility: 'unlisted',
      imageMode: 'none',
      tags: [],
      createdAt: 1700000000000,
      lastConfirmedAt: 0,
      // 窓口は unlisted の住所フィールド (dc/server/area/ward/addressKey 等) を含めない
      // (projectPublicListing の許可リスト射影)。
    } as unknown as HousingListing;
    mockFetchPublicListing.mockResolvedValueOnce(windowListing);

    const { result } = renderHook(() => useHousingDetail('lid-unlisted'), { wrapper });

    await waitFor(() => {
      expect(result.current.listing).not.toBeNull();
    });
    expect(mockFetchPublicListing).toHaveBeenCalledWith('lid-unlisted');
    expect(result.current.listing?.id).toBe('lid-unlisted');
    expect((result.current.listing as unknown as Record<string, unknown>)?.addressKey).toBeUndefined();
    expect(result.current.notFound).toBe(false);
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

  it('onConfirmDelete 成功: deleteListing(id) が呼ばれ、 store.remove(id) が呼ばれ、 { ok:true } を返す', async () => {
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-del-ok'));
    mockDeleteListing.mockResolvedValueOnce({ ok: true });
    const removeSpy = vi.spyOn(useHousingListingsStore.getState(), 'remove');

    const { result } = renderHook(() => useHousingDetail('lid-del-ok'), { wrapper });

    await waitFor(() => {
      expect(result.current.listing).not.toBeNull();
    });

    let confirmResult: { ok: boolean } | undefined;
    await act(async () => {
      confirmResult = await result.current.onConfirmDelete();
    });

    expect(mockDeleteListing).toHaveBeenCalledWith('lid-del-ok');
    expect(removeSpy).toHaveBeenCalledWith('lid-del-ok');
    expect(confirmResult).toEqual({ ok: true });
    // deleteOpen は hook 内で success 時に必ず setDeleteOpen(false) される契約
    // (onDeleteClick は reportNotice.onDelete 経由でしか public に開けないため、
    //  ここでは「成功パスで false になっている」実挙動のみ確認する)
    expect(result.current.deleteOpen).toBe(false);

    removeSpy.mockRestore();
  });

  it('onConfirmDelete 失敗: { ok:false } を返し、 store.remove は呼ばれない (listing 存置)', async () => {
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-del-fail'));
    mockDeleteListing.mockResolvedValueOnce({ ok: false, error: 'http_500' });
    const removeSpy = vi.spyOn(useHousingListingsStore.getState(), 'remove');

    const { result } = renderHook(() => useHousingDetail('lid-del-fail'), { wrapper });

    await waitFor(() => {
      expect(result.current.listing).not.toBeNull();
    });

    let confirmResult: { ok: boolean } | undefined;
    await act(async () => {
      confirmResult = await result.current.onConfirmDelete();
    });

    expect(mockDeleteListing).toHaveBeenCalledWith('lid-del-fail');
    expect(confirmResult).toEqual({ ok: false });
    expect(removeSpy).not.toHaveBeenCalled();
    // エラー経路では listing はそのまま (store から消されない = UI 上も残る)
    expect(result.current.listing).not.toBeNull();

    removeSpy.mockRestore();
  });

  it('postRemoved: imageMode=sns の tweet 消滅検知で store.remove(id) が呼ばれ postRemoved=true になる', async () => {
    mockGetDoc.mockResolvedValueOnce(
      buildListingSnap('lid-sns-gone', { imageMode: 'sns', tweetId: 'tweet-1' }),
    );
    mockPurgeIfTweetGone.mockResolvedValueOnce({ deleted: true });
    const removeSpy = vi.spyOn(useHousingListingsStore.getState(), 'remove');

    const { result } = renderHook(() => useHousingDetail('lid-sns-gone'), { wrapper });

    await waitFor(() => {
      expect(result.current.postRemoved).toBe(true);
    });

    expect(mockPurgeIfTweetGone).toHaveBeenCalledWith('lid-sns-gone');
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith('lid-sns-gone');

    removeSpy.mockRestore();
  });

  it('postRemoved: purgeIfTweetGone が deleted:false のとき postRemoved は false のまま、 store.remove も呼ばれない', async () => {
    mockGetDoc.mockResolvedValueOnce(
      buildListingSnap('lid-sns-alive', { imageMode: 'sns', tweetId: 'tweet-2' }),
    );
    mockPurgeIfTweetGone.mockResolvedValueOnce({ deleted: false });
    const removeSpy = vi.spyOn(useHousingListingsStore.getState(), 'remove');

    const { result } = renderHook(() => useHousingDetail('lid-sns-alive'), { wrapper });

    await waitFor(() => {
      expect(result.current.listing).not.toBeNull();
    });
    await waitFor(() => {
      expect(mockPurgeIfTweetGone).toHaveBeenCalledWith('lid-sns-alive');
    });
    // purgeIfTweetGone の resolve 後続処理 (deleted:false の早期 return) が
    // 確実に流れきるまでマクロタスクを 1 つ挟んで待つ。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.postRemoved).toBe(false);
    expect(removeSpy).not.toHaveBeenCalled();

    removeSpy.mockRestore();
  });

  it('Task 3.3a: reportNotice.onEdit は options.onEdit をそのまま呼ぶ (hook 内で editOpen 等のモーダル状態は持たない)', async () => {
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-report'));
    const onEdit = vi.fn();

    const wrapperWithNotification = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/?notification=notif-1']}>{children}</MemoryRouter>
    );

    // 通知 doc 取得 (getDoc の 2 回目呼び出し) を housing_report で解決する。
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'notif-1',
      data: () => ({ type: 'housing_report', reason: 'wrong_info' }),
    });

    // firebase/auth モックは currentUser: null のままだが、notification 取得は
    // auth.currentUser?.uid を見る実装 (lib/firebase の auth モック) を使うため、
    // このテストでは lib/firebase モックの auth.currentUser を差し替える。
    const firebaseMock = await import('../../../../lib/firebase');
    // @ts-expect-error テスト用に currentUser を上書きする
    firebaseMock.auth.currentUser = { uid: 'owner1' };

    const { result } = renderHook(() => useHousingDetail('lid-report', { onEdit }), {
      wrapper: wrapperWithNotification,
    });

    await waitFor(() => {
      expect(result.current.reportNotice).toBeDefined();
    });

    result.current.reportNotice?.onEdit();
    expect(onEdit).toHaveBeenCalledTimes(1);

    // @ts-expect-error 後続テストへの汚染防止
    firebaseMock.auth.currentUser = null;
  });

  it('auth-ready gate: authLoading=true の間は getDoc を呼ばず notFound も立てず、loading=false に切り替わったら fetch が走る', async () => {
    mockAuthLoading = true;
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-gate'));

    const { result, rerender } = renderHook(() => useHousingDetail('lid-gate'), { wrapper });

    // gate が効いている間: fetch は走らず、notFound も立たない (次回に委ねるだけで失敗扱いしない)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(result.current.notFound).toBe(false);
    expect(result.current.listing).toBeNull();

    // auth 復元完了 → gate 解除 → 初めて fetch が走る
    mockAuthLoading = false;
    rerender();

    await waitFor(() => {
      expect(mockGetDoc).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current.listing).not.toBeNull();
    });
    expect(result.current.notFound).toBe(false);
  });
});
