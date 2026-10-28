// @vitest-environment happy-dom
/**
 * ハウジンガーページ: 共有・プロフィール・本人判定・報告・取得失敗。
 * (HousingerPage.test.tsx を分割したもの。共通の準備は housingerPageTestSetup.tsx)
 */
import { screen, fireEvent } from '@testing-library/react';
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

import { publishedProfile, renderPage, setupHousingerPageEnv } from './housingerPageTestSetup';

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

  it('e: 共有メニューのリンクコピーで短縮URL (/h/<識別コード>、2026-08-19 / 2026-09-01) がコピーされる', async () => {
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

    // 2026-09-01: 非ラテン文字名 (たかし) は slug から除去され、識別コードだけの URL になる
    // (生の日本語が URL パスに入ると X 等でリンク判定されないため)。uid-1 は8文字未満なのでそのまま。
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/\/h\/uid-1$/),
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
});
