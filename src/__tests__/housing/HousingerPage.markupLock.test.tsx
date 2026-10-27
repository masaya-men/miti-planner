// @vitest-environment happy-dom
/**
 * 整頓④(HousingerPage 分割)専用の一時検査: 分割前の画面の中身(HTML)を状態ごとに丸ごと記録し、
 * 分割後も 1 文字も変わらないことを確かめる。CSS は触らないので HTML が同じ=見た目も同じ。
 * 分割完了後に削除する(準備部分は HousingerPage.test.tsx の写し)。
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import type { HousingerProfile, HousingListing } from '../../types/housing';

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
import { __resetHousingerListingsCacheForTest } from '../../lib/housing/housingerListingsCache';

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
const otherProfile: HousingerProfile = { ...publishedProfile, snsUrl: 'https://x.com/takashi' };

function hiddenRaw(id: string): unknown {
  return { ...rawListing(id, 'uid-1'), createdAt: 50 };
}

function snap(): string {
  return document.body.innerHTML;
}

describe('HousingerPage 分割前後の HTML 固定', () => {
  it('未ログインのマイページ', () => {
    renderMyPage();
    expect(snap()).toMatchSnapshot();
  });

  it('プロフィール読み込み中', () => {
    mockGetHousingerProfile.mockReturnValueOnce(new Promise(() => {}));
    mockGetHousingerListings.mockReturnValueOnce(new Promise(() => {}));
    renderPage('uid-1');
    expect(snap()).toMatchSnapshot();
  });

  it('プロフィールだけ届いて一覧は読み込み中(他人視点)', async () => {
    authUid = 'uid-2';
    mockGetHousingerProfile.mockResolvedValueOnce(otherProfile);
    mockGetHousingerListings.mockReturnValueOnce(new Promise(() => {}));
    renderPage('uid-1');
    await screen.findByRole('heading', { name: 'たかし' });
    expect(snap()).toMatchSnapshot();
  });

  it('非公開・存在しない', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(null);
    mockGetHousingerListings.mockResolvedValueOnce([]);
    renderPage('uid-1');
    await screen.findByText(jaTranslations.housing.housinger.unavailable);
    expect(snap()).toMatchSnapshot();
  });

  it('他人視点: 一覧+運営非表示+…メニュー+報告の窓', async () => {
    authUid = 'uid-2';
    mockHiddenListings = [hiddenRaw('h-1')];
    mockGetHousingerProfile.mockResolvedValueOnce(otherProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1'), { ...rawListing('l-2', 'uid-1'), createdAt: 200 }]);
    renderPage('uid-1');
    await screen.findAllByTestId('housing-listing-card');
    expect(snap()).toMatchSnapshot('一覧');
    fireEvent.click(screen.getByRole('button', { name: jaTranslations.housing.detail.kebab.aria_label }));
    expect(snap()).toMatchSnapshot('…メニュー');
    fireEvent.click(screen.getByRole('menuitem', { name: jaTranslations.housing.housinger.report.menuItem }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(snap()).toMatchSnapshot('報告の窓');
  });

  it('他人視点: 一覧 0 件', async () => {
    authUid = 'uid-2';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([]);
    renderPage('uid-1');
    await screen.findByText(jaTranslations.housing.housinger.noListings);
    expect(snap()).toMatchSnapshot();
  });

  it('本人視点: 一覧+代表作+名前編集+アイコン窓+公開切替の窓', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValue([rawListing('l-1', 'uid-1'), { ...rawListing('l-2', 'uid-1'), createdAt: 200 }]);
    renderPage('uid-1');
    await screen.findAllByTestId('housing-card-select');
    await waitFor(() => expect(screen.getAllByTestId('housing-card-background-select').length).toBeGreaterThan(0));
    expect(snap()).toMatchSnapshot('一覧');
    fireEvent.click(screen.getByRole('button', { name: jaTranslations.housing.housinger.editProfile }));
    expect(snap()).toMatchSnapshot('名前編集');
    fireEvent.click(screen.getByRole('button', { name: jaTranslations.housing.account.avatarChange }));
    expect(snap()).toMatchSnapshot('アイコン窓');
  });

  it('本人視点: 公開切替の確認窓', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValue([rawListing('l-1', 'uid-1')]);
    renderPage('uid-1');
    await screen.findAllByTestId('housing-card-select');
    fireEvent.click(screen.getByRole('button', { name: jaTranslations.housing.register.visibility.public }));
    const item = screen.getAllByRole('menuitem').find((b) => !(b as HTMLButtonElement).disabled)!;
    fireEvent.click(item);
    await screen.findByRole('dialog');
    expect(snap()).toMatchSnapshot();
  });
});
