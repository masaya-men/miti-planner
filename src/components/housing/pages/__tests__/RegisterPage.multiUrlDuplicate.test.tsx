// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { useAuthStore } from '../../../../store/useAuthStore';

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
// create パス (performRegister) の API を spy するため実モジュールを名前空間 import する
// (module 全体 mock は他 export を壊すため spyOn で個別に差し替える)。
import * as housingApiClient from '../../../../lib/housingApiClient';
// 複数URL集約 (Batch2) の重複検出テスト用: showToast 呼び出しを spy する
// (housingApiClient と同じ「実モジュールを名前空間 import → vi.spyOn」方式)。
import * as ToastModule from '../../../toastBus';
import { AUTOSAVE_KEY } from '../../../../lib/housing/registerAutosave';
import { initTestI18n } from './registerPageTestSetup';

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

  // Task6 (Batch2): handleTweetFetched の重複URL検出回帰テスト。
  // mode=create の RegisterSectionMedia は現時点 (Task7未着手) では単一の
  // HousingRegisterSnsUrlField しか描画しないため、同じ URL 入力欄に同じ URL を
  // 2回「貼る」操作 (fireEvent.change → useTweetFetch モックを success に遷移) を繰り返すことで
  // handleTweetFetched が同じ postUrl で2回呼ばれる状況を再現する
  // (実際の複数欄UIはTask7で配線されるが、重複検出ロジック自体はどちらの経路でも同じ関数が
  // 判定するため、この駆動方法で isDuplicatePostUrl の統合を検証できる)。
  describe('RegisterPage: 複数URL集約 (Batch2)', () => {
    const TWEET_URL = 'https://x.com/user/status/1842217368673759510';

    function createTree() {
      return (
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage />
          </MemoryRouter>
        </I18nextProvider>
      );
    }

    it('同じURLを2回貼っても重複エラーになりsourcePostUrlsが増えない', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});

      const { rerender } = render(createTree());

      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: 正常に取得 (写真1枚)。
      fireEvent.change(input, { target: { value: TWEET_URL } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'D',
          author: { name: 'D', screen_name: 'd' },
          photos: ['https://pbs.twimg.com/d1.jpg'],
          video: null,
        },
      };
      rerender(createTree());

      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 1 }),
        ),
      );
      expect(showToastSpy).not.toHaveBeenCalled();

      // 2本目: 同じURLをもう一度貼る (重複) → 新しい data オブジェクトで dispatch ガードを
      // すり抜けさせつつ、postUrl は1本目と完全一致させる。
      fireEvent.change(input, { target: { value: TWEET_URL } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'D',
          author: { name: 'D', screen_name: 'd' },
          photos: ['https://pbs.twimg.com/d1.jpg'],
          video: null,
        },
      };
      rerender(createTree());

      await waitFor(() =>
        expect(showToastSpy).toHaveBeenCalledWith(
          i18n.t('housing.register.snsUrl.error.duplicate_url'),
          'error',
        ),
      );

      // sourcePostUrls / sourceImageUrls が二重追加されていない (画像枚数は1本目のまま)。
      expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
        i18n.t('housing.register.media.fetched_count', { count: 1 }),
      );

      showToastSpy.mockRestore();
    });

    /**
     * Bug1 回帰 (2026-07-21 レビュー指摘・Important): 写真だけのツイートが先に「代表」になった
     * 状態で、2本目のツイートに動画が付いていると、修正前は setSnsCapture の updater が
     * 常に prev (代表確定済み) をそのまま返すため、`capturedVideoRef.current` は true になり
     * (= video_limit トーストは出ず「受理」扱い) 見た目上は動画1本制限も守られたように見えるが、
     * 肝心の video データ自体は snsCapture に一切反映されず、buildDraft/registerListing の
     * ペイロードにも videoUrl 等が現れない「受理したのに消える」事故になる。
     */
    it('写真だけのツイート→動画付きツイートの順で貼ると、2本目の動画が代表のtweetDataに合流し登録データに残る (Bug1回帰)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({
          title: '新規物件',
          dc: 'Meteor',
          server: 'Ramuh',
          area: 'LavenderBeds',
          ward: 29,
          buildingType: 'house',
          plot: 3,
          size: 'L',
          visibility: 'public',
        }),
      );
      const canRegisterSpy = vi
        .spyOn(housingApiClient, 'canRegister')
        .mockResolvedValue({ remaining: 5 } as any);
      const checkDuplicateSpy = vi
        .spyOn(housingApiClient, 'checkDuplicate')
        .mockResolvedValue({ duplicates: [], privateMatchCount: 0 } as any);
      const registerSpy = vi
        .spyOn(housingApiClient, 'registerListing')
        .mockResolvedValue({ id: 'new1' } as any);
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});

      const TWEET_URL_PHOTO = 'https://x.com/user/status/1842217368673759511';
      const TWEET_URL_VIDEO = 'https://x.com/user/status/1842217368673759512';

      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: 写真だけ (動画なし) → 代表として確定する。
      fireEvent.change(input, { target: { value: TWEET_URL_PHOTO } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-only',
          author: { name: 'P', screen_name: 'p' },
          photos: ['https://pbs.twimg.com/p1.jpg'],
          video: null,
        },
      };
      rerender(createTree());
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 1 }),
        ),
      );

      // 2本目: 動画付き (写真なし)。代表は既に1本目 (tweetData) で確定済みなので、
      // 修正前はここで受理判定 (トーストなし) にはなるが動画データ自体が握りつぶされる。
      fireEvent.change(input, { target: { value: TWEET_URL_VIDEO } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'video-tweet',
          author: { name: 'V', screen_name: 'v' },
          photos: [],
          video: {
            url: 'https://video.twimg.com/ext_tw_video/V.mp4',
            posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/posterV.jpg',
            aspectRatio: 1.7,
          },
        },
      };
      rerender(createTree());

      // 「受理」判定であること (video_limit トーストは出ない)。
      await waitFor(() => {
        expect(screen.getByTestId('housing-register-media-video')).toBeInTheDocument();
      });
      expect(showToastSpy).not.toHaveBeenCalledWith(
        'housing.register.snsUrl.error.video_limit',
        'error',
      );

      // 実際に登録データ (registerListing 引数 = buildDraft の出力) に動画が載ることを確認する
      // (プレビュー表示だけでなく保存データそのものを検証するのが本バグの核心)。
      const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
      fireEvent.click(addressGateBtn);
      const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      fireEvent.click(submitBtn);

      await waitFor(() => expect(registerSpy).toHaveBeenCalled());
      expect(registerSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          videoUrl: 'https://video.twimg.com/ext_tw_video/V.mp4',
          videoPosterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/posterV.jpg',
          // 代表 (1本目) の静止画も維持されている (動画差し込みで代表自体が入れ替わっていない)。
          sourceImageUrls: ['https://pbs.twimg.com/p1.jpg'],
        }),
      );

      canRegisterSpy.mockRestore();
      checkDuplicateSpy.mockRestore();
      registerSpy.mockRestore();
      showToastSpy.mockRestore();
      window.localStorage.removeItem(AUTOSAVE_KEY);
    });

  });
});
