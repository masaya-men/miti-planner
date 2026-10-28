// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';

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

  // Plan B (2026-07-21): Task1 で imageCount 算出に editThumbnailPaths を含めたため、
  // edit でも正しい枚数を要約できるようになった (方式A時代の「常に0枚」誤表示は解消)。
  describe('確認セクション: mode=edit も画像枚数の要約行を出す (Plan B)', () => {
    it('mode=edit でも確認セクションに画像枚数の行が出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).getByText('SNS投稿・サイトから自動入力')).toBeInTheDocument();
      // EDITABLE_LISTING は sourceImageUrls を1件持つ (Task1で stillCount に反映済み)。
      // ラベルの存在だけでなく実際の枚数値も検証し、imageCount 計算の退行を検知できるようにする。
      expect(within(section).getByText('1 枚')).toBeInTheDocument();
    });

    it('mode=create では確認セクションに画像枚数の行が出る (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).getByText('SNS投稿・サイトから自動入力')).toBeInTheDocument();
    });
  });

  // Task3.4-4: onSaved (resolveReport) を fetchAndUpsert より前に呼ぶ (unhide 後の store 再取得を保証)。
  it('mode=edit の保存成功時、 onSaved が fetchAndUpsert より先に呼ばれる (Task3.4-4)', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    updateMock.mockResolvedValueOnce({ ok: true });

    const callOrder: string[] = [];
    const fetchAndUpsertSpy = vi
      .spyOn(useHousingListingsStore.getState(), 'fetchAndUpsert')
      .mockImplementation(async () => {
        callOrder.push('fetchAndUpsert');
      });
    const onSaved = vi.fn(async () => {
      callOrder.push('onSaved');
    });

    renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING, onSaved });
    fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));

    await waitFor(() => expect(fetchAndUpsertSpy).toHaveBeenCalled());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(callOrder).toEqual(['onSaved', 'fetchAndUpsert']);

    fetchAndUpsertSpy.mockRestore();
  });

  /**
   * commitEditSnsFetch (編集ページ「投稿URLを追加する」commit) の回帰テスト
   * (最終レビュー Critical/Important fix・2026-07-21 → Batch2・2026-07-22 で
   * 「貼り替え=全差し替え」から「追加 (既存+新規の累積)」へ仕様変更したことに伴い
   * シナリオ/期待値を書き換え)。
   *
   * バグ1 (Critical・維持): `payload = { ...buildDraft(), ...freshImageFields }` は
   * 「buildDraft() 側の画像フィールドは常に空 = {}」という前提だったが、この関数は
   * 成功時に setSnsCapture(capture) を呼ぶため、2回目以降の呼び出し時点では
   * snsCapture (延いては buildDraft() の画像フィールド) が前回貼り付けた古いSNSデータ
   * を保持している。freshImageFields に無いキーは buildDraft() 側の古い値がスプレッドで
   * 生き残ってサーバーに送信されてしまう。修正 (buildDraft() の画像フィールドを明示的に
   * 除去してからマージする) はBatch2でも変更していないため、引き続き機能する。
   *
   * バグ2 (Important・仕様変更で意味が反転): 旧仕様 (貼り替え) では「動画付き→動画なし」
   * で動画プレビューが消えるのが正しい挙動だった。Batch2 (追加方式) では逆に、動画を
   * 一度確立したら動画を含まない後続URLを貼ってもプレビューが消えてはいけない
   * (貼り替えではなく追加なので、動画を明示的に取り除く操作をしていない限り維持する)。
   *
   * HousingEditSourcePanel (実物・モックしない) 経由で URL 欄を操作し、
   * useTweetFetch をモックして「取得成功」を模擬することで、commitEditSnsFetch を
   * RegisterPage の外部から間接的に駆動する。
   */
  describe('編集ページ URL追加: commitEditSnsFetch の回帰 (Batch2・2026-07-22)', () => {
    const TWEET_URL_A = 'https://x.com/user/status/1842217368673759498';
    const TWEET_URL_C = 'https://x.com/user/status/1842217368673759499';

    // ツイートA: 動画付き (写真なし)
    const tweetDataVideoA = {
      text: 'A',
      author: { name: 'A', screen_name: 'a' },
      photos: [],
      video: {
        url: 'https://video.twimg.com/ext_tw_video/A.mp4',
        posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/posterA.jpg',
        aspectRatio: 1.5,
      },
    };

    // ツイートC: 写真だけ (動画なし)
    const tweetDataPhotosC = {
      text: 'C',
      author: { name: 'C', screen_name: 'c' },
      photos: ['https://pbs.twimg.com/c1.jpg', 'https://pbs.twimg.com/c2.jpg'],
      video: null,
    };

    function editTree() {
      return (
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage mode="edit" initialValues={EDITABLE_LISTING} />
          </MemoryRouter>
        </I18nextProvider>
      );
    }

    it('動画付きツイートA→写真だけのツイートCの順で貼ると、Aの動画を保持したままCの写真が既存画像に追記される', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      updateMock.mockResolvedValue({ ok: true });
      const { rerender } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1回目: 動画付きツイートAを貼る
      fireEvent.change(input, { target: { value: TWEET_URL_A } });
      tweetState = { ...tweetState, status: 'success', data: tweetDataVideoA };
      rerender(editTree());

      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
      expect(updateMock.mock.calls[0][1]).toEqual(
        expect.objectContaining({ videoUrl: tweetDataVideoA.video.url }),
      );

      // バグ2 回帰確認: 動画プレビューが反映される
      await waitFor(() => {
        const preview = screen.getByTestId('housing-register-media-video');
        expect(preview.querySelector('img')?.getAttribute('src')).toBe(
          tweetDataVideoA.video.posterUrl,
        );
      });

      // 2回目: 写真だけのツイートCを追加で貼る (Batch2: 貼り替えではなく追加)。
      fireEvent.change(input, { target: { value: TWEET_URL_C } });
      tweetState = { ...tweetState, status: 'success', data: tweetDataPhotosC };
      rerender(editTree());

      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(2));
      const secondPayload = updateMock.mock.calls[1][1];

      // Batch2 の核心: 追加方式なので、Cの写真は「貼り替え」ではなくEDITABLE_LISTINGの既存
      // sourceImageUrls (['https://x/a.jpg']) に追記される。かつ、Aで確立した動画は
      // (Cが動画を持たないからといって) 消えず維持される (バグ1の除去ロジックとは別に、
      // capture 自体が意図的に前の動画を引き継ぐ設計)。
      expect(secondPayload.videoUrl).toBe(tweetDataVideoA.video.url);
      expect(secondPayload.videoPosterUrl).toBe(tweetDataVideoA.video.posterUrl);
      expect(secondPayload.videoAspectRatio).toBe(tweetDataVideoA.video.aspectRatio);
      expect(secondPayload.sourceImageUrls).toEqual([
        'https://x/a.jpg',
        ...tweetDataPhotosC.photos,
      ]);
      // 代表 (tweetId) は最初に確立したURL (A) のまま維持される (RegisterPage.tsx
      // handleTweetFetched と同じ「代表は最初の1件が正」設計)。
      expect(secondPayload.tweetId).toBe('1842217368673759498');
      // sourcePostUrls には両方のURLが記録され、重複扱いにならない。
      expect(secondPayload.sourcePostUrls).toEqual([TWEET_URL_A, TWEET_URL_C]);

      // バグ2 回帰確認 (仕様反転): 追加方式なので動画なしツイートを追加しても
      // 動画プレビューは消えずそのまま残る。
      await waitFor(() => {
        const preview = screen.getByTestId('housing-register-media-video');
        expect(preview.querySelector('img')?.getAttribute('src')).toBe(
          tweetDataVideoA.video.posterUrl,
        );
      });
    });
  });

});
