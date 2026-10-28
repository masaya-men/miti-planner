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

  describe('RegisterPage: 複数URL集約 (Batch2)', () => {
    function createTree() {
      return (
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage />
          </MemoryRouter>
        </I18nextProvider>
      );
    }

    /**
     * Bug3 回帰 (2026-07-21 レビュー指摘・Critical): buildDraftImageFields の Twitter 分岐は
     * `sns.tweetData.photos` のみを読み、ページ全体の集約プール (`sourceImageUrls`) は見ない
     * (並び替え UI 経由の再順序化で photoAspectRatios と index がズレるのを避けるため意図的)。
     * 代表 (1本目) が確定した後、2本目のツイート URL が持つ写真は `sourceImageUrls` には
     * 追記される (画面上の「N枚取得しました」表示は増える) のに、修正前の setSnsCapture
     * updater は代表確定済みなら常に prev をそのまま返すため tweetData.photos には合流せず、
     * 保存データから静かに消える。複数投稿URL集約という Batch2 の目玉機能 (Twitterスレッド等
     * から画像を集約) そのものが壊れていた。
     */
    it('写真付きツイート→別の写真付きツイートの順で貼ると、2本目の写真も登録データに合流する (Bug3回帰)', async () => {
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

      const TWEET_URL_A = 'https://x.com/user/status/1842217368673759521';
      const TWEET_URL_B = 'https://x.com/user/status/1842217368673759522';

      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: 写真Aのみ → 代表として確定する。
      fireEvent.change(input, { target: { value: TWEET_URL_A } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-A',
          author: { name: 'A', screen_name: 'a' },
          photos: ['https://pbs.twimg.com/a1.jpg'],
          video: null,
        },
      };
      rerender(createTree());
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 1 }),
        ),
      );

      // 2本目: 別のツイートで写真Bのみ。代表 (1本目) は既に確定済みなので、
      // 修正前は tweetData.photos に合流せず保存データから消える。
      fireEvent.change(input, { target: { value: TWEET_URL_B } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-B',
          author: { name: 'B', screen_name: 'b' },
          photos: ['https://pbs.twimg.com/b1.jpg'],
          video: null,
        },
      };
      rerender(createTree());
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 2 }),
        ),
      );
      expect(showToastSpy).not.toHaveBeenCalled();

      // 実際に登録データ (registerListing 引数 = buildDraft の出力) に両方の写真が載ることを
      // 確認する (プレビュー上の枚数表示だけでなく保存データそのものを検証するのが本バグの核心)。
      const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
      fireEvent.click(addressGateBtn);
      const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      fireEvent.click(submitBtn);

      await waitFor(() => expect(registerSpy).toHaveBeenCalled());
      expect(registerSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          sourceImageUrls: ['https://pbs.twimg.com/a1.jpg', 'https://pbs.twimg.com/b1.jpg'],
        }),
      );

      canRegisterSpy.mockRestore();
      checkDuplicateSpy.mockRestore();
      registerSpy.mockRestore();
      showToastSpy.mockRestore();
      window.localStorage.removeItem(AUTOSAVE_KEY);
    });

    /**
     * Bug3 修正と同時に追加した安全側ガード: 代表がツイート (tweetData) で確定した後に
     * OGP URL の写真を貼っても、pbs.twimg.com 以外の任意ホストの画像を tweetData.photos に
     * 混ぜると validateImage の host 制約 (housingValidation.ts:413、tweetId 併用時は
     * sourceImageUrls の全 URL が pbs.twimg.com 限定) に違反し、登録全体が invalid_url で
     * 失敗する (「一部の写真が消える」より悪い「全部保存できない」regression)。そのため
     * この組み合わせはマージせず拒否トーストを出し、集約プール (sourceImageUrls) にも
     * 追加しない (見た目の「N枚」表示が実際に保存されない画像を含んで嘘をつくのを防ぐ)。
     */
    it('代表がツイートで確定した後にOGP画像を貼るとマージされず拒否トーストが出る (host混在防止・Bug3関連)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});

      const TWEET_URL = 'https://x.com/user/status/1842217368673759531';
      const OGP_URL = 'https://housingsnap.com/98765';

      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: ツイートの写真A → 代表として確定する。
      fireEvent.change(input, { target: { value: TWEET_URL } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-A',
          author: { name: 'A', screen_name: 'a' },
          photos: ['https://pbs.twimg.com/a1.jpg'],
          video: null,
        },
      };
      rerender(createTree());
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 1 }),
        ),
      );

      // 2本目: OGP URL の写真B。代表は既にツイートで確定済みなので拒否されるはず。
      fireEvent.change(input, { target: { value: OGP_URL } });
      ogpState = {
        ...ogpState,
        status: 'success',
        data: {
          image: 'https://housingsnap.com/img/b1.jpg',
          images: ['https://housingsnap.com/img/b1.jpg'],
          title: 't',
          description: 'd',
          siteName: 'housingsnap',
          text: 'text',
        },
      };
      rerender(createTree());

      await waitFor(() =>
        expect(showToastSpy).toHaveBeenCalledWith(
          i18n.t('housing.register.snsUrl.error.photo_source_conflict'),
          'error',
        ),
      );

      // 写真枚数表示は1本目のまま (OGP画像は集約プールにも追加されず、実際に保存されない
      // 画像が枚数に混ざらない)。
      expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
        i18n.t('housing.register.media.fetched_count', { count: 1 }),
      );

      showToastSpy.mockRestore();
    });

    /**
     * 2026-08-20 排他緩和: YouTube動画 + Xの静止画の同居を許可したことで、この「YouTube代表
     * 確立後にツイートの写真が遅れて届く」レースは拒否対象ではなくなった。buildDraftImageFields
     * の YouTube 分岐が sourceImageUrls も読むようになったため、遅れて届いた写真も
     * sourceImageUrls へ合流させて問題なく保存できる (旧テストが検証していた photo-loss
     * 事故=「受理したのに保存時に消える」の心配自体が構造的に解消されたため、video_limit で
     * 拒否する必要が無くなった)。
     *
     * 再現手順の注記: 単一URL欄 (Task7の複数枠UIはまだ無い) では、ツイートURLを貼った直後に
     * 別URLへ書き換えると `HousingRegisterSnsUrlField` の classifySnsUrl 分岐が
     * `onYoutubeFetched(null)` を同期的に呼び、代表を即座にクリアしてしまう。そのため
     * 「YouTube貼付→ただちにツイートURLへ書き換えて即時解決」という単純な順序では
     * ガード対象の状態 (代表=YouTube 確定済みのままツイートの写真が届く) に到達できない
     * (実験して確認済み)。実際に到達可能なのは、ツイート fetch が pending のまま
     * ユーザーが YouTube URL に書き換えて代表を確立した後、**取り残された最初のツイート fetch が
     * 遅れて成功する**というレース (低速回線・気が変わって貼り直す、という現実的な操作順)。
     * `useTweetFetch` の dispatch は effect 実行時点の**現在の url** から tweetId を再計算するため
     * (`HousingRegisterSnsUrlField.tsx` の `parseTweetUrl(url)`)、url が既に YouTube に変わっていると
     * `source=null` の「孤立ディスパッチ」になり、`isDuplicatePostUrl` の入口チェックも通過してしまう。
     * テスト環境では `tweetState` (外部変数) の更新を意図的に遅らせることでこの pending 状態を再現する。
     */
    it('ツイートURL貼付(fetch pending)の直後にYouTube URLへ書き換えて代表が確定し、後から遅れてツイートの写真fetchが届いても拒否されずsourceImageUrlsへ合流する (2026-08-20 排他緩和)', async () => {
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

      const YOUTUBE_URL = 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o';
      const TWEET_URL_PHOTO = 'https://x.com/user/status/1842217368673759541';

      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: 写真付きツイート URL を貼るが、まだ fetch が成功していない (tweetState は idle のまま =
      // pending を模す)。fetchTweet 自体はモックの no-op なので実際に何かが起きるわけではない。
      fireEvent.change(input, { target: { value: TWEET_URL_PHOTO } });

      // ユーザーが (低速回線で) 待たずに YouTube URL に書き換える → YouTube が代表として確定する。
      fireEvent.change(input, { target: { value: YOUTUBE_URL } });

      // YouTube の概要欄取得が (この URL については) 先に解決し、代表が確定する。
      youtubeState = {
        ...youtubeState,
        status: 'success',
        data: { description: null },
      };
      rerender(createTree());

      // 取り残された1本目のツイート fetch が遅れて成功する。dispatch 時点の url は既に YouTube URL
      // に変わっているため tweetId が取れず source=null の「孤立ディスパッチ」になるが、
      // data (写真) 自体は届く。
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-after-youtube',
          author: { name: 'P', screen_name: 'p' },
          photos: ['https://pbs.twimg.com/py1.jpg'],
          video: null,
        },
      };
      rerender(createTree());

      // video_limit トーストは出ない (YouTube+静止画は同居許可のため拒否理由が無い)。
      expect(showToastSpy).not.toHaveBeenCalledWith(
        i18n.t('housing.register.snsUrl.error.video_limit'),
        'error',
      );

      // 写真は集約プール (sourceImageUrls) に合流する。
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 1 }),
        ),
      );

      // 実際に登録データ (registerListing 引数 = buildDraft の出力) に YouTube と写真の両方が
      // 含まれることを確認する (プレビュー表示だけでなく保存データそのものを検証)。
      const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
      fireEvent.click(addressGateBtn);
      const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      fireEvent.click(submitBtn);

      await waitFor(() => expect(registerSpy).toHaveBeenCalled());
      expect(registerSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          imageMode: 'sns',
          youtubeVideoId: 'Ypg8w7Dmq9o',
          sourceImageUrls: ['https://pbs.twimg.com/py1.jpg'],
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
