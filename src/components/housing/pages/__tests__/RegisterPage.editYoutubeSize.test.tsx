// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { useAuthStore } from '../../../../store/useAuthStore';
import type { HousingListing } from '../../../../types/housing';

// mode=edit の保存 API (Task3.2)。 現物のシグネチャ (update: (id, updates) => Promise<{ok,error?}>)
// に合わせる。 呼び出し検証のため vi.fn() を差し込む。
const updateMock = vi.fn();
vi.mock('../../edit/useHousingUpdate', () => ({
  useHousingUpdate: () => ({ update: updateMock, loading: false }),
}));

// 保存後 navigate('/housing/listing/:id') を検証するため useNavigate だけ差し替える
// (MemoryRouter 等の他 export は実物のまま・TourNavPage.test.tsx と同じパターン)。
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// fetchAndUpsert/loadMine (useHousingListingsStore) が内部で叩く実サービス層。
// 未モックだと実 Firestore へ到達しようとするため、 store テストと同じ方針でモックする
// (fetchAndUpsert/loadMine 自体は失敗を握りつぶす実装だが、 決定的・高速なテストにするため)。
vi.mock('../../../../lib/housingListingsService', () => ({
  getListingById: vi.fn().mockResolvedValue(null),
  getMyListings: vi.fn().mockResolvedValue([]),
}));

// RegisterHousingerCta (Task9) は自分のプロフィールを getDoc で直読みする。 このテストファイルは
// firebase/firestore を実物のまま (useAuthStore が real lib/firebase を経由するため) 使っており、
// モックしないと本番 Firestore への実ネットワーク呼び出しが発生してしまう。
// CTA 自体のロジックは RegisterHousingerCta.test.tsx で個別に検証済みのため、ここではスタブする。
vi.mock('../../register/RegisterHousingerCta', () => ({
  RegisterHousingerCta: () => null,
}));

// 画像アップロード経路 (localImages) をテストから使うため、圧縮を同期スタブ化する。
// 画像必須 (mode=create) の submit 可否を検証するテストが、実 canvas 圧縮なしで
// File を 1 枚追加できるようにする。
vi.mock('../../../../lib/housing/imageCompression', () => ({
  compressHousingImage: vi.fn(async (file: File) => ({
    base64: 'ZmFrZQ==',
    mimeType: 'image/webp',
    file,
    originalBytes: 1000,
    compressedBytes: 800,
  })),
}));

// 編集ページ commitEditSnsFetch の回帰テスト用に useTweetFetch/useOgpFetch をモックする
// (RegisterSectionMedia.test.tsx / HousingEditSourcePanel.test.tsx と同じ方針)。
// このモックはファイル全体に適用されるが、他テストは URL 入力欄を一切操作しないため無影響。
const mockFetchTweet = vi.fn();
const mockCancelTweet = vi.fn();
const mockResetTweet = vi.fn();
let tweetState: any = {
  status: 'idle',
  data: null,
  errorCode: null,
  fetchTweet: mockFetchTweet,
  cancel: mockCancelTweet,
  reset: mockResetTweet,
};
vi.mock('../../../../lib/housing/useTweetFetch', () => ({
  useTweetFetch: () => tweetState,
}));

const mockFetchOgp = vi.fn();
const mockCancelOgp = vi.fn();
const mockResetOgp = vi.fn();
let ogpState: any = {
  status: 'idle',
  data: null,
  errorCode: null,
  fetchOgp: mockFetchOgp,
  cancel: mockCancelOgp,
  reset: mockResetOgp,
};
vi.mock('../../../../lib/housing/useOgpFetch', () => ({
  useOgpFetch: () => ogpState,
}));

const mockFetchYoutubeMeta = vi.fn();
const mockCancelYoutube = vi.fn();
const mockResetYoutube = vi.fn();
let youtubeState: any = {
  status: 'idle',
  data: null,
  fetchYoutubeMeta: mockFetchYoutubeMeta,
  cancel: mockCancelYoutube,
  reset: mockResetYoutube,
};
vi.mock('../../../../lib/housing/useYoutubeFetch', () => ({
  useYoutubeFetch: () => youtubeState,
}));

import { RegisterPage } from '../RegisterPage';
import { AUTOSAVE_KEY } from '../../../../lib/housing/registerAutosave';
import { EDITABLE_LISTING, renderPage, initTestI18n } from './registerPageTestSetup';

beforeAll(initTestI18n);

describe('RegisterPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, loading: false });
    updateMock.mockReset();
    navigateMock.mockReset();
    // commitEditSnsFetch 回帰テスト用の tweet/ogp fetch モックを idle に戻す (テスト間独立性)。
    mockFetchTweet.mockClear();
    mockCancelTweet.mockClear();
    mockResetTweet.mockClear();
    mockFetchOgp.mockClear();
    mockCancelOgp.mockClear();
    mockResetOgp.mockClear();
    tweetState = {
      status: 'idle',
      data: null,
      errorCode: null,
      fetchTweet: mockFetchTweet,
      cancel: mockCancelTweet,
      reset: mockResetTweet,
    };
    ogpState = {
      status: 'idle',
      data: null,
      errorCode: null,
      fetchOgp: mockFetchOgp,
      cancel: mockCancelOgp,
      reset: mockResetOgp,
    };
    mockFetchYoutubeMeta.mockClear();
    mockCancelYoutube.mockClear();
    mockResetYoutube.mockClear();
    youtubeState = {
      status: 'idle',
      data: null,
      fetchYoutubeMeta: mockFetchYoutubeMeta,
      cancel: mockCancelYoutube,
      reset: mockResetYoutube,
    };
    // オートセーブ復元テストが assertion 失敗で早期リターンすると、末尾の
    // removeItem に届かず後続テストへ localStorage が漏れる (実際に踏んだ事故)。
    // beforeEach で毎回クリアし、テスト間の独立性を保証する。
    window.localStorage.removeItem(AUTOSAVE_KEY);
  });

  /**
   * 2026-08-24 実機報告 (対象listingをFirestoreで直接確認済み): サーバーに youtubeVideoId が
   * 保存済みの物件を編集ページで開くと、①YouTube動画の存在を示すプレビューが一切表示され
   * ない (editVideoPreview の初期化がTwitter動画の形 (videoUrl+videoPosterUrl) しか見て
   * おらずyoutubeVideoIdを見ていない)、②その状態で写真だけのツイートURLを追加すると
   * HousingEditSourcePanel内のcaptureRef (マウントごとに空へ戻るセッションローカルstate) が
   * サーバー保存済みの代表を知らないため、代表を写真だけの新規ツイートに奪われてYouTube側
   * 情報がbuildDraftImageFieldsから丸ごと落ち (最悪の場合サーバー側のクリーンアップで
   * youtubeVideoId自体が削除される)、という2つの不具合が見つかった。
   */
  describe('編集ページ: 保存済みYouTube動画がある物件を開く (2026-08-24 実機報告)', () => {
    const YOUTUBE_LISTING = {
      ...EDITABLE_LISTING,
      postUrl: 'https://youtu.be/9Lg45cM9mpA',
      ogImageUrl: 'https://img.youtube.com/vi/9Lg45cM9mpA/hqdefault.jpg',
      youtubeVideoId: '9Lg45cM9mpA',
      sourceImageUrls: [],
    } as unknown as HousingListing;

    const TWEET_URL_PHOTOS = 'https://x.com/user/status/1842217368673759501';
    const tweetDataPhotosOnly = {
      text: 'photos',
      author: { name: 'P', screen_name: 'p' },
      photos: ['https://pbs.twimg.com/p1.jpg', 'https://pbs.twimg.com/p2.jpg'],
      video: null,
    };

    function youtubeEditTree() {
      return (
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage mode="edit" initialValues={YOUTUBE_LISTING} />
          </MemoryRouter>
        </I18nextProvider>
      );
    }

    it('編集ページを開いた直後にYouTube動画のプレビュー(サムネ+バッジ)が表示される', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: YOUTUBE_LISTING });
      const preview = screen.getByTestId('housing-register-media-video');
      expect(preview.querySelector('img')?.getAttribute('src')).toBe(YOUTUBE_LISTING.ogImageUrl);
    });

    it('写真だけのツイートを追加してもYouTube動画の代表を奪わず、動画を保ったまま写真が保存される', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      updateMock.mockResolvedValue({ ok: true });
      const { rerender } = renderPage({ mode: 'edit', initialValues: YOUTUBE_LISTING });

      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);
      fireEvent.change(input, { target: { value: TWEET_URL_PHOTOS } });
      tweetState = { ...tweetState, status: 'success', data: tweetDataPhotosOnly };
      rerender(youtubeEditTree());

      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
      const payload = updateMock.mock.calls[0][1];
      expect(payload.youtubeVideoId).toBe('9Lg45cM9mpA');
      expect(payload.sourceImageUrls).toEqual(tweetDataPhotosOnly.photos);

      // 動画プレビューも消えずそのまま残る。
      const preview = screen.getByTestId('housing-register-media-video');
      expect(preview.querySelector('img')?.getAttribute('src')).toBe(YOUTUBE_LISTING.ogImageUrl);
    });

    it('写真のみの物件にYouTube動画を新規追加すると、保存直後にプレビューへ反映される(再読み込み不要)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      updateMock.mockResolvedValue({ ok: true });
      const PHOTO_ONLY_LISTING = {
        ...EDITABLE_LISTING,
        sourceImageUrls: ['https://pbs.twimg.com/existing.jpg'],
      } as unknown as HousingListing;
      const { rerender } = renderPage({ mode: 'edit', initialValues: PHOTO_ONLY_LISTING });

      expect(screen.queryByTestId('housing-register-media-video')).not.toBeInTheDocument();

      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);
      fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=9Lg45cM9mpA' } });
      youtubeState = { ...youtubeState, status: 'success', data: { description: null } };
      rerender(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage mode="edit" initialValues={PHOTO_ONLY_LISTING} />
          </MemoryRouter>
        </I18nextProvider>,
      );

      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
      const payload = updateMock.mock.calls[0][1];
      expect(payload.youtubeVideoId).toBe('9Lg45cM9mpA');
      expect(payload.sourceImageUrls).toEqual(['https://pbs.twimg.com/existing.jpg']);

      await waitFor(() => {
        const preview = screen.getByTestId('housing-register-media-video');
        expect(preview.querySelector('img')?.getAttribute('src')).toBe(
          'https://img.youtube.com/vi/9Lg45cM9mpA/hqdefault.jpg',
        );
      });
    });
  });

  /**
   * size は (エリア × 区画) から一意に決まるので手入力させない (2026-07-10)。
   * RegisterPage の導出 effect が唯一の書き込み口で、UI 側は読み取り専用表示 (Task3-1: 旧
   * disabled <select> はドロップダウン矢印が見えてしまうため disabled <input> に置換済み)。
   * 表示は housingSizeMasterData のラベル (例 'L' → 'Lハウス')。
   * 参照表 = src/data/housing/wardPlotSizes.ts (LavenderBeds: plot1=M / plot3=L / plot29=S)。
   */
  describe('size は区画から自動導出され手入力できない', () => {
    const sizeField = (container: HTMLElement) =>
      container.querySelector('#housing-register-size') as HTMLInputElement;

    it('size 欄は disabled (手入力を受け付けない読み取り専用表示)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeField(container).disabled).toBe(true);
    });

    it('mode=edit のプリフィルで区画由来の size が入り、auto-filled バッジが出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // LavenderBeds plot 3 = L (listing の size も L で一致)
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeField(container).value).toBe('Lハウス');
      // fieldState が 'auto-filled' でないと requiredFields('size') が empty のまま送信できない
      expect(screen.getByTestId('housing-auto-badge-size')).toBeInTheDocument();
    });

    it('保存済みデータの size が区画と食い違っていても、開いた時点で区画側に訂正される', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // LavenderBeds plot 29 の実サイズは S。listing には誤った 'L' が入っている。
      const wrong = { ...EDITABLE_LISTING, plot: 29, size: 'L' } as unknown as HousingListing;
      const { container } = renderPage({ mode: 'edit', initialValues: wrong });
      expect(sizeField(container).value).toBe('Sハウス');
    });

    it('mode=create で エリアと区画を入れると size が自動で入る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();

      // 建物タイプ (個人宅) を選ぶまで番地/サイズ欄は出ない → 先に選ぶ。
      fireEvent.click(
        within(container.querySelectorAll('[role="radiogroup"]')[0] as HTMLElement).getByRole(
          'radio',
          { name: '個人宅・FCハウス' },
        ),
      );

      // 区画だけではエリアが決まらないので size は空のまま
      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '1' } });
      expect(sizeField(container).value).toBe('');

      // エリアが入った瞬間に導出される (LavenderBeds plot 1 = M)
      fireEvent.change(container.querySelector('#housing-register-area')!, {
        target: { value: 'LavenderBeds' },
      });
      expect(sizeField(container).value).toBe('Mハウス');

      // 区画を変えれば追従する (plot 3 = L)
      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '3' } });
      expect(sizeField(container).value).toBe('Lハウス');
    });

    it('区画が範囲外なら size は空に戻る (古い値が残らない)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeField(container).value).toBe('Lハウス');

      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '61' } });
      expect(sizeField(container).value).toBe('');
    });

    it('アパートに切り替えると size 欄ごと消える (apartment は size を持てない)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeField(container)).not.toBeNull();

      fireEvent.click(screen.getByRole('radio', { name: 'アパルトメント' }));
      expect(sizeField(container)).toBeNull();
    });
  });

});
