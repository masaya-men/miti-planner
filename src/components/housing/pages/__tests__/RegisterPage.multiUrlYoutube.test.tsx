// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

    it('YouTube URL貼付→概要欄取得成功で住所が自動入力される', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
      youtubeState = {
        ...youtubeState,
        status: 'success',
        // Adamantoise は Aether DC 所属 (Mana ではない) のため dcServerMismatch で棄却されてしまう。
        // Mana/Anima は既存の parseHousingFromText.test.ts と同じ組み合わせで dc/server 一致。
        data: { description: 'Mana / Anima / Mist 3-15' },
      };
      rerender(createTree());

      // dc/server/area/ward/plot は TYPING_STAGGER_MS ごとに setTimeout で順次適用されるため、
      // 2つ目以降のフィールド (server) も同じ waitFor 内で待つ (dc 到達直後の同期チェックだと
      // server 用 setTimeout がまだ発火していない)。
      await waitFor(() => {
        expect((screen.getByLabelText('データセンター') as HTMLSelectElement).value).toBe('Mana');
        expect((screen.getByLabelText('サーバー') as HTMLSelectElement).value).toBe('Anima');
      });
    });

    /**
     * 実機報告 (2026-08-18): 番地(plot)は自動入力できたのに、本文に S/M/L 等のサイズ表記が
     * 無いために建物タイプ (個人宅/アパルトメント) が未選択のまま残り、番地欄自体が
     * (isHouse ゲートで) 非表示になってしまう UX ギャップの回帰テスト。
     * parseHousingFromText は「アパート文脈でない」と判定できたときだけ plot を設定するため、
     * plot が取れた時点で house を自動選択しても新たな推測は増えない。
     */
    it('YouTube概要欄にサイズ表記が無くても、番地が取れたら建物タイプ(個人宅)が自動選択される', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { rerender, container } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
      youtubeState = {
        ...youtubeState,
        status: 'success',
        data: { description: 'Mana / Anima / Mist 3-15' },
      };
      rerender(createTree());

      await waitFor(() => {
        expect(container.querySelector('#housing-register-plot')).not.toBeNull();
      });
      expect((container.querySelector('#housing-register-plot') as HTMLInputElement).value).toBe('15');
      expect(
        within(container.querySelectorAll('[role="radiogroup"]')[0] as HTMLElement).getByRole('radio', {
          name: '個人宅・FCハウス',
        }),
      ).toHaveAttribute('aria-checked', 'true');
    });

    it('YouTube URL貼付→概要欄に住所が無いと失敗案内が表示される (Twitterでも同じ経路)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
      youtubeState = {
        ...youtubeState,
        status: 'success',
        data: { description: 'よろしくお願いします' },
      };
      rerender(createTree());

      expect(
        await screen.findByTestId('housing-register-address-extract-failed'),
      ).toBeInTheDocument();
    });

    /**
     * 最終レビュー指摘 Finding1 回帰 (2026-08-17): オートセーブ復元 (spec:120) で住所は
     * 既に正しく復元済みなのに、復元起因の SNS 再取得 (initialUrl 経由) が「今回は住所を
     * 抽出できなかった」(fills.length===0) だけで addressExtractFailed(true) にしてしまい、
     * 正しく入力済みの住所欄の上に誤った失敗バナーが出てしまうバグの回帰テスト。
     * restoreRefetchGuardRef.current===true の間は fills.length===0 でも失敗バナーを出さない。
     */
    it('復元起因の再取得で住所0件でも既に住所が復元済みなら失敗バナーを出さない (最終レビュー Finding1 回帰)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // Mana/Anima/Mist 3-15 は既存の YouTube 成功テストと同じ dc/server/area/ward/plot 組み合わせ
      // (dcServerMismatch を回避できることが確認済みの組み合わせ)。
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({
          title: '新規物件',
          dc: 'Mana',
          server: 'Anima',
          area: 'Mist',
          ward: 3,
          buildingType: 'house',
          plot: 15,
          size: 'L',
          visibility: 'public',
          postUrl: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o',
        }),
      );

      const { rerender } = render(createTree());

      // 復元で住所が既に正しく埋まっていることを確認 (バナーが出れば誤りだと分かる前提)。
      await waitFor(() => {
        expect((screen.getByLabelText('データセンター') as HTMLSelectElement).value).toBe('Mana');
        expect((screen.getByLabelText('サーバー') as HTMLSelectElement).value).toBe('Anima');
      });
      expect(screen.queryByTestId('housing-register-address-extract-failed')).toBeNull();

      // 復元起因の再取得 (initialUrl 経由で自動発火済み) が完了 → 概要欄に住所なし (fills.length===0)。
      youtubeState = {
        ...youtubeState,
        status: 'success',
        data: { description: 'よろしくお願いします' },
      };
      rerender(createTree());

      // fills.length===0 でも restoreRefetchGuardRef.current===true のため失敗バナーは出ない。
      await waitFor(() => {
        expect(screen.queryByTestId('housing-register-address-extract-failed')).toBeNull();
      });
      // 復元済みの住所も上書き/クリアされず維持されている。
      expect((screen.getByLabelText('データセンター') as HTMLSelectElement).value).toBe('Mana');

      window.localStorage.removeItem(AUTOSAVE_KEY);
    });

    /**
     * 最終レビュー指摘 Finding2 回帰 (2026-08-17): addressExtractFailed が SNS URL クリア時に
     * クリアされていなかったため、失敗バナー表示後に URL 欄を空にしても古いバナーが残り続けた。
     * handleYoutubeFetched の null-data 分岐 (URL クリア) で setAddressExtractFailed(false) する。
     */
    it('失敗バナー表示後にURL欄をクリアするとバナーが消える (最終レビュー Finding2 回帰)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
      youtubeState = {
        ...youtubeState,
        status: 'success',
        data: { description: 'よろしくお願いします' },
      };
      rerender(createTree());

      expect(
        await screen.findByTestId('housing-register-address-extract-failed'),
      ).toBeInTheDocument();

      // URL 欄をクリア → classifySnsUrl の 'empty' 分岐で onYoutubeFetched(null) が呼ばれる。
      fireEvent.change(input, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.queryByTestId('housing-register-address-extract-failed')).toBeNull();
      });
    });

    /**
     * Bug2 回帰 (2026-07-21 レビュー指摘・Important): handleDiscardRestore が Batch2 で追加した
     * ガード state/ref (sourcePostUrls/capturedVideoRef/addressAppliedRef/urlSlotCount) を
     * リセットしていなかったため、破棄後に「破棄前と同じ URL」を貼り直すと sourcePostUrls に
     * 残った URL のせいで誤って重複エラー扱いになる。
     */
    it('オートセーブ破棄後はsourcePostUrlsがリセットされ、破棄前と同じURLを貼っても重複扱いされない (Bug2回帰)', async () => {
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
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});

      const REUSED_URL = 'https://x.com/user/status/1842217368673759520';

      const { rerender } = render(createTree());

      // 復元通知 (discard ボタン) が出ていることを確認。
      await screen.findByTestId('housing-register-autosave-discard');

      // 破棄前: URL を1本貼って sourcePostUrls に載せる。
      const input1 = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);
      fireEvent.change(input1, { target: { value: REUSED_URL } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'before-discard',
          author: { name: 'B', screen_name: 'b' },
          photos: ['https://pbs.twimg.com/b1.jpg'],
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

      // useTweetFetch モックの status を idle に戻してから discard する。
      // (discard で mediaKey が変わり SnsUrlField が再マウントされるが、useTweetFetch はモックの
      //  グローバル状態を返すだけなので、success のまま remount すると再マウント直後に古い
      //  fetch 結果が再度 dispatch されてしまう。これは実 hook では起きないテスト側の作り物の
      //  副作用なので、実装をテストに合わせるのではなくモック状態を idle に戻して回避する)。
      tweetState = { ...tweetState, status: 'idle', data: null };
      fireEvent.click(screen.getByTestId('housing-register-autosave-discard'));

      // 破棄後: 通知が消え、取得済み表示もクリアされる。
      await waitFor(() =>
        expect(screen.queryByTestId('housing-register-autosave-notice')).toBeNull(),
      );
      expect(screen.queryByTestId('housing-register-media-success')).toBeNull();

      // 破棄前と全く同じ URL をもう一度貼る (別の data オブジェクトで dispatch ガードを回避)。
      const input2 = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);
      fireEvent.change(input2, { target: { value: REUSED_URL } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'after-discard',
          author: { name: 'A2', screen_name: 'a2' },
          photos: ['https://pbs.twimg.com/a1.jpg'],
          video: null,
        },
      };
      rerender(createTree());

      // Bug2 (修正前): sourcePostUrls が破棄でクリアされず REUSED_URL を含んだままのため、
      // 重複URLエラーになり画像が反映されない。修正後: guard がリセットされ正常に取得できる。
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 1 }),
        ),
      );
      expect(showToastSpy).not.toHaveBeenCalledWith(
        i18n.t('housing.register.snsUrl.error.duplicate_url'),
        'error',
      );

      showToastSpy.mockRestore();
      window.localStorage.removeItem(AUTOSAVE_KEY);
    });
  });
});
