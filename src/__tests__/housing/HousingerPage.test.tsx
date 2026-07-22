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
vi.mock('../../lib/housing/housingerProfileService', () => ({
  getHousingerProfile: (...args: unknown[]) => mockGetHousingerProfile(...args),
  getHousingerListings: (...args: unknown[]) => mockGetHousingerListings(...args),
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

const publishedProfile: HousingerProfile = {
  displayName: 'たかし',
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
  showToastMock.mockClear();
  authUid = null;
  useHousingTourStore.getState().reset();
  useHousingListOrderStore.getState().reset();
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

describe('HousingerPage', () => {
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
});
