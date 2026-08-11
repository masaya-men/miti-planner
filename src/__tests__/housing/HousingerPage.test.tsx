// @vitest-environment happy-dom
/**
 * Task 7: ハウジンガーページ (/housing/housinger/:uid)。
 * - profile あり → 名前 + 公開ハウジング一覧が出る
 * - profile が null (非公開/存在しない uid) → unavailable + 探すへ戻るリンク
 * - 本人 (useAuthStore の uid 一致) → プロフィールを編集ボタンが出る
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import type { HousingerProfile, HousingListing } from '../../types/housing';

const mockGetHousingerProfile = vi.fn();
const mockGetHousingerListings = vi.fn();
const mockUpsertHousingerProfile = vi.fn();
vi.mock('../../lib/housing/housingerProfileService', () => ({
  getHousingerProfile: (...args: unknown[]) => mockGetHousingerProfile(...args),
  getHousingerListings: (...args: unknown[]) => mockGetHousingerListings(...args),
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
vi.mock('../../components/Toast', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

// useAuthStore: uid をテストごとに差し替える (本人判定用)。
let authUid: string | null = null;
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: { uid: string } | null }) => unknown) =>
    selector({ user: authUid ? { uid: authUid } : null }),
}));

import { HousingerPage } from '../../components/housing/pages/HousingerPage';
import { useHousingTourStore } from '../../store/useHousingTourStore';
import { useHousingListOrderStore } from '../../store/useHousingListOrderStore';
import { useTourTrayStore } from '../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';

const publishedProfile: HousingerProfile = {
  displayName: 'たかし',
  displayNameLower: 'たかし',
  avatarUrl: null,
  bio: 'S字改築が好きです',
  snsUrl: null,
  isPublished: true,
  isModerationHidden: false,
  reportCount: 0,
  createdAt: 1,
  updatedAt: 1,
};

function rawListing(id: string, ownerUid: string): HousingListing {
  return {
    id,
    ownerUid,
    dc: 'Elemental',
    server: 'Carbuncle',
    area: 'Mist',
    ward: 1,
    buildingType: 'house',
    plot: 3,
    size: 'M',
    addressKey: `Elemental-Carbuncle-Mist-1-3`,
    imageMode: 'none',
    tags: [],
    visibility: 'public',
    createdAt: 100,
    lastConfirmedAt: 100,
  } as unknown as HousingListing;
}

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja',
      fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
  }
});

beforeEach(() => {
  mockGetHousingerProfile.mockReset();
  mockGetHousingerListings.mockReset();
  mockUpsertHousingerProfile.mockReset();
  showToastMock.mockClear();
  authUid = null;
  useHousingTourStore.getState().reset();
  useHousingListOrderStore.getState().reset();
  useTourTrayStore.getState().clear();
  // isSelf 分岐 (loadMine 経由) が myListings を書き込むストア。他ストアと同様リセットしないと
  // 前のテストの非同期 loadMine がアンマウント後に解決し myListings を汚染しうる (テスト間干渉)。
  useHousingListingsStore.getState().reset();
});

function renderPage(uid: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[`/housing/housinger/${uid}`]}>
        <Routes>
          <Route path="/housing/housinger/:uid" element={<HousingerPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function renderMyPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/housing/mypage']}>
        <Routes>
          <Route path="/housing/mypage" element={<HousingerPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

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

  // e: X共有 (A案)。 既存 HousingShareButton (housing.detail.share = 「シェア」・既存キー) を流用。
  it('e: 本人以外が見てもハウジンガーページの共有ボタンが表示される', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    expect(screen.getByRole('button', { name: 'シェア' })).toBeInTheDocument();
  });

  it('e: 本人が見てもハウジンガーページの共有ボタンが表示される', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    expect(screen.getByRole('button', { name: 'シェア' })).toBeInTheDocument();
  });

  it('e: 共有メニューのリンクコピーで自分のまとめページ URL (/housing/housinger/:uid) がコピーされる', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    fireEvent.click(screen.getByRole('button', { name: 'シェア' }));
    fireEvent.click(screen.getByText('リンクをコピー'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/\/housing\/housinger\/uid-1$/),
    );
  });

  it('公開ハウジングが0件なら noListings 文言が出る', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-empty');

    expect(await screen.findByRole('heading', { name: 'たかし' })).toBeInTheDocument();
    expect(screen.getByText('公開中のハウジングはまだありません')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'この人の家をまとめてツアー' }),
    ).not.toBeInTheDocument();
  });

  it('profile が null (非公開/存在しない uid) → unavailable + 探すへ戻るリンク', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(null);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-notfound');

    expect(
      await screen.findByText('このハウジンガーは公開されていません'),
    ).toBeInTheDocument();
    const back = screen.getByRole('link', { name: /戻る/ });
    expect(back).toHaveAttribute('href', '/housing');
  });

  it('本人 (uid 一致) が見ると「プロフィールを編集」ボタンが出る', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-1');

    expect(
      await screen.findByRole('button', { name: 'プロフィールを編集' }),
    ).toBeInTheDocument();
  });

  // #3: 旧 'hashed:' 付き URL でも解決し、本人判定 (viewerUid は 'hashed:<hex>' 形式) が効く。
  it('旧 hashed: prefix 付き URL でも解決し本人判定される (後方互換)', async () => {
    authUid = 'hashed:uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('hashed:uid-1');

    expect(
      await screen.findByRole('button', { name: 'プロフィールを編集' }),
    ).toBeInTheDocument();
  });

  // #3: prefix を外した新 URL でも、viewerUid が 'hashed:<hex>' 形式なら本人判定される。
  it('prefix なし新 URL + hashed: 付き viewerUid でも本人判定される', async () => {
    authUid = 'hashed:uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-1');

    expect(
      await screen.findByRole('button', { name: 'プロフィールを編集' }),
    ).toBeInTheDocument();
  });

  it('他人が見ると「プロフィールを編集」ボタンは出ない', async () => {
    authUid = 'uid-2';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    expect(
      screen.queryByRole('button', { name: 'プロフィールを編集' }),
    ).not.toBeInTheDocument();
  });

  // Task9: ページヘッダーの「…」メニュー (通報導線)
  it('本人が見ると「…」メニューは出ない', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    expect(
      screen.queryByRole('button', { name: 'メニュー' }),
    ).not.toBeInTheDocument();
  });

  it('他人が見ると「…」メニューが出て、報告するとモーダルが開く', async () => {
    authUid = 'uid-2';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    fireEvent.click(screen.getByRole('button', { name: 'メニュー' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'このハウジンガーを報告' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('このハウジンガーについて報告')).toBeInTheDocument();
  });

  it('未ログインで報告を押すとログイン案内が出て、モーダルは開かない', async () => {
    authUid = null;
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    fireEvent.click(screen.getByRole('button', { name: 'メニュー' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'このハウジンガーを報告' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('getHousingerListings が reject しても無限ローディングにならず unavailable 表示に縮退する', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockRejectedValueOnce(new Error('composite index missing'));

    renderPage('uid-1');

    expect(
      await screen.findByText('このハウジンガーは公開されていません'),
    ).toBeInTheDocument();
    expect(screen.queryByText('公開中のハウジングはまだありません')).not.toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

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
    // #C: まとめてツアーもマナー確認を挟む。「はじめる」で commitTourAll → 開始時ネットが弾く。
    fireEvent.click(screen.getByRole('button', { name: /はじめる/ }));

    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(useHousingTourStore.getState().running).toBe(false);
    expect(useHousingTourStore.getState().listingIds).toEqual([]);
  });

  // バグ報告(2026-08-10): 既存のツアートレイ(探す/お気に入りで組んでいた候補)を無視して
  // このハウジンガーの家だけで上書きしていた。トレイの家 + この人の家が両方残るべき。
  it('既にツアートレイに家が積まれている状態で「まとめてツアー」を実行すると、トレイの家とこの人の家が両方ツアーに含まれる(上書きされない)', async () => {
    useTourTrayStore.getState().setTrayIds(['tray-house-1']);
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);

    const { unmount } = renderPage('uid-1');

    const tourBtn = await screen.findByRole('button', { name: 'この人の家をまとめてツアー' });
    fireEvent.click(tourBtn);
    fireEvent.click(screen.getByRole('button', { name: /はじめる/ }));

    expect(useHousingTourStore.getState().running).toBe(true);
    expect(useHousingTourStore.getState().listingIds).toEqual(
      expect.arrayContaining(['tray-house-1', 'l-1']),
    );
    expect(useHousingTourStore.getState().listingIds).toHaveLength(2);
    // 開始時にトレイは空になる (他ページの commitStart と同じ後始末)。
    expect(useTourTrayStore.getState().trayIds).toEqual([]);
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
    expect(selectButtons[0].className).toContain('is-selected');
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

    // showToast はモック (vi.mock('../../components/Toast', ...)) のため実 DOM には描画されない。
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
    fireEvent.click(selectButtons[0]); // l-1(背景指定済み)を代表作から外す

    await screen.findByText((_, el) => el?.className === 'housing-card-select' && selectButtons[0] === el);
    expect(mockUpsertHousingerProfile).toHaveBeenCalledWith({
      ogRepresentativeListingIds: ['l-2'],
      ogBackgroundListingId: null,
    });
  });
});
