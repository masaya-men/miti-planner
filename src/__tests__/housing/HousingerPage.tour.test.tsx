// @vitest-environment happy-dom
/**
 * ハウジンガーページ: まとめてツアー・代表作選択。
 * (HousingerPage.test.tsx を分割したもの。共通の準備は housingerPageTestSetup.tsx)
 */
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

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

import { publishedProfile, rawListing, renderPage, setupHousingerPageEnv } from './housingerPageTestSetup';

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
  // 計画 Task4 Step6: 開始時セーフティネット (全開始経路の1つ)。
  it('別リージョン混在の一覧では「まとめてツアー」が start されず、トーストが出る', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([
      rawListing('l-jp', 'uid-1'),
      {
        ...rawListing('l-na', 'uid-1'),
        dc: 'Aether',
        server: 'Gilgamesh',
        addressKey: 'Aether-Gilgamesh-Mist-1-3',
      },
    ]);

    renderPage('uid-1');

    const tourBtn = await screen.findByRole('button', { name: 'この人の家をまとめてツアー' });
    fireEvent.click(tourBtn);
    // まとめてツアーは並び替え画面へ送るだけ (マナー確認は出さない)。跨ぎ混在はここで弾く。

    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(useHousingTourStore.getState().running).toBe(false);
    expect(useHousingTourStore.getState().listingIds).toEqual([]);
  });

  // バグ報告(2026-08-10): 既存のツアートレイ(探す/お気に入りで組んでいた候補)を無視して
  // このハウジンガーの家だけで上書きしていた。トレイの家 + この人の家が両方残るべき。
  it('既にツアートレイに家が積まれている状態で「まとめてツアー」を押すと、ツアーは開始されず、トレイに既存の家とこの人の家が両方入る(上書きされない)', async () => {
    useTourTrayStore.getState().setTrayIds(['tray-house-1']);
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);

    const { unmount } = renderPage('uid-1');

    const tourBtn = await screen.findByRole('button', { name: 'この人の家をまとめてツアー' });
    fireEvent.click(tourBtn);

    // ツアーは開始されない (開始は並び替え画面の開始ボタン)。
    expect(useHousingTourStore.getState().running).toBe(false);
    expect(useHousingTourStore.getState().listingIds).toEqual([]);
    // 既存トレイの家は消えず、この人の家が追加される。
    const tray = useTourTrayStore.getState().trayIds;
    expect(tray).toEqual(expect.arrayContaining(['tray-house-1', 'l-1']));
    expect(tray).toHaveLength(2);
    expect(navigateMock).toHaveBeenCalledWith('/housing/tour');
    // navigate('/housing/tour') 後の未解決な副作用が次のテストへ漏れないよう明示的に片付ける。
    unmount();
  });

  it('本人閲覧・代表作未選択なら新着順上位が自動選択され、選択トグルにチェックが入る', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const selectButtons = await screen.findAllByTestId('housing-card-select');
    expect(selectButtons).toHaveLength(1);
    // 自動選択は一覧の表示後の effect で付くため、ボタンが出た瞬間ではなく印が付くまで待つ
    // (負荷が高いと印が付く前に見てしまい時々落ちていた)。
    await waitFor(() => expect(selectButtons[0].className).toContain('is-selected'));
  });

  it('他人が見ると代表作選択トグルは出ない', async () => {
    authUid = 'uid-2';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    expect(screen.queryByTestId('housing-card-select')).not.toBeInTheDocument();
  });

  it('非公開物件を選ぼうとするとエラートーストが出て選択されず、APIも呼ばれない', async () => {
    authUid = 'uid-1';
    // HousingerPage の一覧は sortMode 既定値 'newest' (createdAt 降順) で並ぶため、
    // l-1 (createdAt: 100, rawListing 既定値) より古い値にして selectButtons[1] (2番目) に来るようにする。
    const privateListing = { ...rawListing('l-2', 'uid-1'), visibility: 'private' as const, createdAt: 50 };
    mockGetHousingerProfile.mockResolvedValueOnce({ ...publishedProfile, ogRepresentativeListingIds: ['l-1'] });
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1'), privateListing]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const selectButtons = await screen.findAllByTestId('housing-card-select');
    expect(selectButtons).toHaveLength(2);
    fireEvent.click(selectButtons[1]); // l-2 (private) を選ぼうとする

    // showToast はモック (vi.mock('../../components/toastBus', ...)) のため実 DOM には描画されない。
    // 他の既存テスト (別リージョン混在時のトースト検証) と同じく showToastMock の呼び出しで検証する。
    expect(showToastMock).toHaveBeenCalledWith('公開物件のみ選択できます', 'error');
    expect(selectButtons[1].className).not.toContain('is-selected');
    expect(mockUpsertHousingerProfile).not.toHaveBeenCalled();
  });

  it('公開物件のトグルを押すと選択され、upsertHousingerProfileがogRepresentativeListingIds込みで呼ばれる', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce({ ...publishedProfile, ogRepresentativeListingIds: ['l-1'] });
    // sortMode 既定値 'newest' (createdAt 降順) で l-2 が selectButtons[1] (2番目) に来るよう
    // l-1 (createdAt: 100, rawListing 既定値) より古い値にする。
    mockGetHousingerListings.mockResolvedValueOnce([
      rawListing('l-1', 'uid-1'),
      { ...rawListing('l-2', 'uid-1'), createdAt: 50 },
    ]);
    mockUpsertHousingerProfile.mockResolvedValueOnce({ ok: true, profile: publishedProfile });

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const selectButtons = await screen.findAllByTestId('housing-card-select');
    // 保存済み代表作 (profile 由来の選択状態) が画面に反映されるのを待ってから押す (反映前に押すと初期値 [] 基準で計算されて不安定になる)。
    await waitFor(() => expect(selectButtons[0].className).toContain('is-selected'));
    fireEvent.click(selectButtons[1]); // l-2 を追加選択

    await screen.findByText((_, el) => el?.className === 'housing-card-select is-selected' && selectButtons[1] === el);
    expect(mockUpsertHousingerProfile).toHaveBeenCalledWith({ ogRepresentativeListingIds: ['l-1', 'l-2'] });
  });

  it('代表作選択済みのカードだけ背景トグルが出て、押すと選ばれる', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce({ ...publishedProfile, ogRepresentativeListingIds: ['l-1', 'l-2'] });
    mockGetHousingerListings.mockResolvedValueOnce([
      rawListing('l-1', 'uid-1'),
      { ...rawListing('l-2', 'uid-1'), createdAt: 50 },
    ]);
    mockUpsertHousingerProfile.mockResolvedValueOnce({ ok: true, profile: publishedProfile });

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const bgButtons = await screen.findAllByTestId('housing-card-background-select');
    expect(bgButtons).toHaveLength(2);
    await waitFor(() => expect(screen.getAllByTestId('housing-card-select')[1].className).toContain('is-selected'));
    fireEvent.click(bgButtons[1]);

    await screen.findByText((_, el) => el?.className === 'housing-card-background-select is-selected' && bgButtons[1] === el);
    expect(mockUpsertHousingerProfile).toHaveBeenCalledWith({ ogRepresentativeListingIds: ['l-1', 'l-2'], ogBackgroundListingId: 'l-2' });
  });

  it('背景に選んだカードを代表作から外すと、背景指定も一緒に解除される', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce({
      ...publishedProfile,
      ogRepresentativeListingIds: ['l-1', 'l-2'],
      ogBackgroundListingId: 'l-1',
    });
    mockGetHousingerListings.mockResolvedValueOnce([
      rawListing('l-1', 'uid-1'),
      { ...rawListing('l-2', 'uid-1'), createdAt: 50 },
    ]);
    mockUpsertHousingerProfile.mockResolvedValueOnce({ ok: true, profile: publishedProfile });

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const selectButtons = await screen.findAllByTestId('housing-card-select');
    // 保存済み代表作 (profile 由来の選択状態) が画面に反映されるのを待ってから押す (反映前に押すと初期値 [] 基準で計算されて不安定になる)。
    await waitFor(() => expect(selectButtons[0].className).toContain('is-selected'));
    fireEvent.click(selectButtons[0]); // l-1(背景指定済み)を代表作から外す

    await screen.findByText((_, el) => el?.className === 'housing-card-select' && selectButtons[0] === el);
    expect(mockUpsertHousingerProfile).toHaveBeenCalledWith({
      ogRepresentativeListingIds: ['l-2'],
      ogBackgroundListingId: null,
    });
  });
});
