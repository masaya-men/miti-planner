// @vitest-environment happy-dom
/**
 * ハウジンガーページ: 一覧表示・キャッシュ・運営非表示の家。
 *
 * Task 7: ハウジンガーページ (/housing/housinger/:uid)。
 * - profile あり → 名前 + 公開ハウジング一覧が出る
 * - profile が null (非公開/存在しない uid) → unavailable + 探すへ戻るリンク
 * - 本人 (useAuthStore の uid 一致) → プロフィールを編集ボタンが出る
 * (HousingerPage.test.tsx を分割したもの。共通の準備は housingerPageTestSetup.tsx)
 */
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { HousingListing } from '../../types/housing';

const mockGetHousingerProfile = vi.fn();
const mockGetHousingerListings = vi.fn();
const mockUpsertHousingerProfile = vi.fn();
// 運営非表示の家 (hiddenListings)。 テストごとに beforeEach で空へ戻す。
let mockHiddenListings: unknown[] = [];
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../lib/housing/housingerProfileService', () => ({
  getHousingerProfile: (...args: unknown[]) => mockGetHousingerProfile(...args),
  getHousingerListings: (...args: unknown[]) => mockGetHousingerListings(...args),
  getHousingerListingsWithHidden: async (...args: unknown[]) => ({
    listings: await mockGetHousingerListings(...args),
    hiddenListings: mockHiddenListings,
  }),
  upsertHousingerProfile: (...args: unknown[]) => mockUpsertHousingerProfile(...args),
}));

// isSelf=true (本人閲覧) の一覧取得は HousingerPage.tsx 内で getHousingerListings ではなく
// useHousingListingsStore.loadMine → housingListingsService.getMyListings 経由になる
// (Task 7 既存実装、visibility 問わず全件取得のため)。同じ HousingListing[] を返す想定なので
// mockGetHousingerListings にルーティングし、本人/他人どちらの視点でも同じテストデータが使えるようにする。
vi.mock('../../lib/housingListingsService', () => ({
  getMyListings: (...args: unknown[]) => mockGetHousingerListings(...args),
}));

// showToast をスパイして、 リージョン跨ぎ開始ブロック時に呼ばれることを検証する (計画 Task4 Step6)。
const showToastMock = vi.fn();
vi.mock('../../components/toastBus', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

// useAuthStore: uid をテストごとに差し替える (本人判定用)。
let authUid: string | null = null;
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: { uid: string } | null }) => unknown) =>
    selector({ user: authUid ? { uid: authUid } : null }),
}));

import { useHousingTourStore } from '../../store/useHousingTourStore';
import { useHousingListOrderStore } from '../../store/useHousingListOrderStore';
import { useTourTrayStore } from '../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { __resetHousingerListingsCacheForTest } from '../../lib/housing/housingerListingsCache';

import { publishedProfile, rawListing, renderPage, renderMyPage, setupHousingerPageEnv } from './housingerPageTestSetup';

beforeAll(() => {
  setupHousingerPageEnv();
});

beforeEach(() => {
  mockGetHousingerProfile.mockReset();
  mockGetHousingerListings.mockReset();
  mockHiddenListings = [];
  // 再訪キャッシュ (モジュール内 Map) がテスト間で漏れないようにする。
  __resetHousingerListingsCacheForTest();
  mockUpsertHousingerProfile.mockReset();
  showToastMock.mockClear();
  navigateMock.mockClear();
  authUid = null;
  useHousingTourStore.getState().reset();
  useHousingListOrderStore.getState().reset();
  useTourTrayStore.getState().clear();
  // isSelf 分岐 (loadMine 経由) が myListings を書き込むストア。他ストアと同様リセットしないと
  // 前のテストの非同期 loadMine がアンマウント後に解決し myListings を汚染しうる (テスト間干渉)。
  useHousingListingsStore.getState().reset();
});


describe('HousingerPage', () => {
  it('未ログインで /housing/mypage を見ると HousingLoginPrompt (他画面と共通の主CTAボタン) が出る', () => {
    renderMyPage();
    expect(screen.getByText('マイページを見るにはログインが必要です')).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: 'ログイン画面を開く' });
    expect(cta.className).toContain('housing-btn-primary');
  });

  it('profile あり → 名前 + 公開ハウジング一覧が表示される', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);

    renderPage('uid-1');

    expect(await screen.findByRole('heading', { name: 'たかし' })).toBeInTheDocument();
    expect(screen.getByText('S字改築が好きです')).toBeInTheDocument();
    expect(await screen.findAllByTestId('housing-listing-card')).toHaveLength(1);
    // まとめてツアーボタンは listings が1件以上のときだけ出る
    expect(
      screen.getByRole('button', { name: 'この人の家をまとめてツアー' }),
    ).toBeInTheDocument();
  });

  it('他人視点ではカードに「ツアーに追加」(overlay) が出て、本人視点では出ない', async () => {
    authUid = 'uid-2';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);
    const other = renderPage('uid-1');
    await screen.findAllByTestId('housing-listing-card');
    expect(screen.getAllByTestId('housing-card-add-overlay')).toHaveLength(1);
    other.unmount();

    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);
    renderPage('uid-1');
    await screen.findAllByTestId('housing-listing-card');
    expect(screen.queryByTestId('housing-card-add-overlay')).not.toBeInTheDocument();
  });

  it('プロフィールが先に届くとプロフィールが出て、一覧部分だけダミー表示 (届いたら一覧に差し替わる)', async () => {
    let resolveListings: (v: HousingListing[]) => void = () => {};
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockReturnValueOnce(
      new Promise<HousingListing[]>((resolve) => {
        resolveListings = resolve;
      }),
    );

    renderPage('uid-1');

    // 一覧が未着でも、プロフィールは先に表示される
    expect(await screen.findByRole('heading', { name: 'たかし' })).toBeInTheDocument();
    expect(screen.getByText('S字改築が好きです')).toBeInTheDocument();
    // 一覧部分は読み上げ用 status のダミー枠で、カードはまだ無い
    expect(screen.getByTestId('housing-grid-skeleton')).toHaveAttribute('role', 'status');
    expect(screen.queryAllByTestId('housing-listing-card')).toHaveLength(0);
    // 取得中に「見つからない」を誤って出さない
    expect(screen.queryByText('このハウジンガーは公開されていません')).not.toBeInTheDocument();

    resolveListings([rawListing('l-1', 'uid-1')]);
    expect(await screen.findAllByTestId('housing-listing-card')).toHaveLength(1);
    expect(screen.queryByTestId('housing-grid-skeleton')).not.toBeInTheDocument();
  });

  it('同じ uid を2回目に表示するとダミー無しで前の一覧が即出て、取得後に新しい一覧へ差し替わる', async () => {
    mockGetHousingerProfile.mockResolvedValue(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);
    const first = renderPage('uid-1');
    expect(await screen.findAllByTestId('housing-listing-card')).toHaveLength(1);
    first.unmount();

    let resolveListings: (v: HousingListing[]) => void = () => {};
    mockGetHousingerListings.mockReturnValueOnce(
      new Promise<HousingListing[]>((resolve) => {
        resolveListings = resolve;
      }),
    );
    renderPage('uid-1');
    // 取得が未完でも、前回の一覧が即表示され、一覧のダミーは出ない
    expect(await screen.findAllByTestId('housing-listing-card')).toHaveLength(1);
    expect(screen.queryByTestId('housing-grid-skeleton')).not.toBeInTheDocument();

    resolveListings([rawListing('l-1', 'uid-1'), { ...rawListing('l-2', 'uid-1'), createdAt: 300 } as HousingListing]);
    await waitFor(() => expect(screen.getAllByTestId('housing-listing-card')).toHaveLength(2));
  });

  it('再訪時の裏の取得が失敗しても、前回の一覧の表示を維持する', async () => {
    mockGetHousingerProfile.mockResolvedValue(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);
    const first = renderPage('uid-1');
    expect(await screen.findAllByTestId('housing-listing-card')).toHaveLength(1);
    first.unmount();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetHousingerListings.mockRejectedValueOnce(new Error('boom'));
    renderPage('uid-1');
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getAllByTestId('housing-listing-card')).toHaveLength(1);
    warn.mockRestore();
  });

  it('別の uid には前の人の一覧を使わない (キャッシュは uid ごと)', async () => {
    mockGetHousingerProfile.mockResolvedValue(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);
    const first = renderPage('uid-1');
    expect(await screen.findAllByTestId('housing-listing-card')).toHaveLength(1);
    first.unmount();

    mockGetHousingerListings.mockReturnValueOnce(new Promise<HousingListing[]>(() => {}));
    renderPage('uid-2');
    expect(await screen.findByRole('heading', { name: 'たかし' })).toBeInTheDocument();
    expect(screen.queryAllByTestId('housing-listing-card')).toHaveLength(0);
  });

  it('運営非表示の家: 帯つきの非リンクカードが出て件数に含まれ、ツアー対象には含まれない', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);
    mockHiddenListings = [
      { ...rawListing('h-1', 'uid-1'), title: '隠された家', createdAt: 200, isHidden: true },
    ];

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    // 通常カード 1 + 非表示カード 1 = 件数 2
    expect(await screen.findAllByTestId('housing-listing-card')).toHaveLength(1);
    const hidden = await screen.findAllByTestId('housing-hidden-listing-card');
    expect(hidden).toHaveLength(1);
    expect(screen.getByTestId('housing-hidden-band')).toHaveTextContent('規約違反のため非表示になりました');
    expect(screen.getByText('2件')).toBeInTheDocument();
    // 非リンク・写真なし
    expect(hidden[0].getAttribute('role')).toBeNull();
    expect(hidden[0].querySelector('img')).toBeNull();
    // ツアー対象 (listings) は通常分のみ: クリックしても隠れた家は ID に含まれない
    fireEvent.click(screen.getByRole('button', { name: 'この人の家をまとめてツアー' }));
    const tourIds = useTourTrayStore.getState().trayIds;
    expect(tourIds).toContain('l-1');
    expect(tourIds).not.toContain('h-1');
  });

  it('通常の家が0件でも運営非表示の家だけなら一覧(帯カード)が出て、ツアーボタンは出ない', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);
    mockHiddenListings = [{ ...rawListing('h-1', 'uid-1'), createdAt: 200, isHidden: true }];

    renderPage('uid-1');

    expect(await screen.findAllByTestId('housing-hidden-listing-card')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'この人の家をまとめてツアー' })).toBeNull();
  });
});
