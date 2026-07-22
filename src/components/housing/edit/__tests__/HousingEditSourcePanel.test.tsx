// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { ToastContainer } from '../../../Toast';
import * as ToastModule from '../../../Toast';

const mockDelete = vi.fn();
const mockReorder = vi.fn();
vi.mock('../../../../lib/housingApiClient', () => ({
  deleteListingSourceImage: (...args: unknown[]) => mockDelete(...args),
  reorderListingSourceImages: (...args: unknown[]) => mockReorder(...args),
}));

// 子 HousingRegisterSnsUrlField が握る実 fetch hook をモック (RegisterSectionMedia.test.tsx と同じ方針)。
let tweetState: any = { status: 'idle', data: null, errorCode: null, fetchTweet: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useTweetFetch', () => ({ useTweetFetch: () => tweetState }));
let ogpState: any = { status: 'idle', data: null, errorCode: null, fetchOgp: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useOgpFetch', () => ({ useOgpFetch: () => ogpState }));

import { HousingEditSourcePanel } from '../HousingEditSourcePanel';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  tweetState = { status: 'idle', data: null, errorCode: null, fetchTweet: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
  ogpState = { status: 'idle', data: null, errorCode: null, fetchOgp: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
});

// vi.fn() の戻り値 (Mock<Procedure | Constructable>) はコンポーネントの厳密な関数型と構造的に
// 一致しないため、テスト内では any 経由で HousingEditSourcePanel の props 型に合わせる
// (.mock.calls での検証は呼び出し元の変数の型のまま行う)。
function buildTree(props: {
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  videoPreview: { url: string; posterUrl: string; aspectRatio?: number } | null;
  sourcePostUrls: string[];
  onCommitSnsFetch: any;
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <HousingEditSourcePanel
        listingId="listing1"
        sourceImageUrls={props.sourceImageUrls}
        onSourceImageUrlsChange={props.onSourceImageUrlsChange}
        videoPreview={props.videoPreview}
        sourcePostUrls={props.sourcePostUrls}
        onCommitSnsFetch={props.onCommitSnsFetch}
      />
      <ToastContainer />
    </I18nextProvider>
  );
}

function renderPanel(
  overrides: Partial<Omit<Parameters<typeof buildTree>[0], 'onCommitSnsFetch'>> & {
    onCommitSnsFetch?: any;
  } = {},
) {
  const onSourceImageUrlsChange = overrides.onSourceImageUrlsChange ?? vi.fn();
  const onCommitSnsFetch = overrides.onCommitSnsFetch ?? vi.fn().mockResolvedValue({ ok: true });
  const utils = render(
    buildTree({
      sourceImageUrls: overrides.sourceImageUrls ?? ['a', 'b'],
      onSourceImageUrlsChange,
      videoPreview: overrides.videoPreview ?? null,
      sourcePostUrls: overrides.sourcePostUrls ?? [],
      onCommitSnsFetch,
    }),
  );
  return { ...utils, onSourceImageUrlsChange, onCommitSnsFetch };
}

describe('HousingEditSourcePanel', () => {
  it('既存URL画像をグリッドに表示する', () => {
    // HousingEditImageGrid のタイルは alt="" (装飾画像扱い) のため getByRole('img') では
    // アクセシビリティツリー上ヒットしない (HousingEditImageGrid.test.tsx でも同様に role 参照
    // せず button/label で検証している)。ここでは DOM 上の img 要素数を直接数える。
    renderPanel({ sourceImageUrls: ['a', 'b', 'c'] });
    expect(screen.getAllByAltText('').length).toBeGreaterThanOrEqual(3);
  });

  it('動画プレビューがあればバッジ付きで表示する', () => {
    renderPanel({ videoPreview: { url: 'https://x/video.mp4', posterUrl: 'https://x/poster.jpg' } });
    expect(screen.getByTestId('housing-register-media-video')).toBeInTheDocument();
  });

  it('削除ボタン押下で deleteListingSourceImage を呼び、結果を onSourceImageUrlsChange へ渡す', async () => {
    mockDelete.mockResolvedValue({ success: true, sourceImageUrls: ['b'] });
    const { onSourceImageUrlsChange } = renderPanel({ sourceImageUrls: ['a', 'b'] });
    const removeButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(removeButtons[0]);
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ listingId: 'listing1', index: 0 }));
    await waitFor(() => expect(onSourceImageUrlsChange).toHaveBeenCalledWith(['b']));
  });

  it('URL欄が描画され、onOgpFetched 経由の値が commit に渡る動線を持つ', () => {
    // HousingRegisterSnsUrlField 自体の fetch ロジックは HousingRegisterSnsUrlField.help.test.tsx で
    // 別途担保されている。ここでは HousingEditSourcePanel が onTweetFetched/onYoutubeFetched/
    // onOgpFetched の3つを渡してマウントしていることのみ確認する (プロップ配線の smoke test)。
    renderPanel({});
    expect(screen.getByPlaceholderText(/URL|url/i) ?? screen.getByRole('textbox')).toBeTruthy();
  });

  describe('HousingEditSourcePanel: 追加方式への統一 (Batch2)', () => {
    const TWEET_URL_A = 'https://x.com/user/status/1842219000000000001';
    const TWEET_URL_B = 'https://x.com/user/status/1842219000000000002';

    it('新しいURLを貼ると既存のsourceImageUrlsは消えず、新しい画像が追加される', async () => {
      const { onCommitSnsFetch, rerender } = renderPanel({ sourceImageUrls: ['a', 'b'] });
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: TWEET_URL_A } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'new-tweet',
          author: { name: 'N', screen_name: 'n' },
          photos: ['https://pbs.twimg.com/c1.jpg'],
          video: null,
        },
      };
      rerender(
        buildTree({
          sourceImageUrls: ['a', 'b'],
          onSourceImageUrlsChange: vi.fn(),
          videoPreview: null,
          sourcePostUrls: [],
          onCommitSnsFetch,
        }),
      );

      await waitFor(() => expect(onCommitSnsFetch).toHaveBeenCalledTimes(1));
      // freshSourceImageUrls (第2引数) = 既存の sourceImageUrls (a, b) + 今回の新規分。
      expect(onCommitSnsFetch.mock.calls[0][1]).toEqual(['a', 'b', 'https://pbs.twimg.com/c1.jpg']);
      expect(onCommitSnsFetch.mock.calls[0][2]).toBe(TWEET_URL_A);
    });

    it('同じURLを再度貼ると重複エラーになり onCommitSnsFetch は呼ばれない', async () => {
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});
      // 既にこのURLが使われている状態 (= 親 RegisterPage が sourcePostUrls に載せた後の再マウント
      // に相当) を再現する。
      const { onCommitSnsFetch, rerender } = renderPanel({
        sourceImageUrls: ['a'],
        sourcePostUrls: [TWEET_URL_A],
      });
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: TWEET_URL_A } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'dup',
          author: { name: 'D', screen_name: 'd' },
          photos: ['https://pbs.twimg.com/dup.jpg'],
          video: null,
        },
      };
      rerender(
        buildTree({
          sourceImageUrls: ['a'],
          onSourceImageUrlsChange: vi.fn(),
          videoPreview: null,
          sourcePostUrls: [TWEET_URL_A],
          onCommitSnsFetch,
        }),
      );

      await waitFor(() =>
        expect(showToastSpy).toHaveBeenCalledWith(
          i18n.t('housing.register.snsUrl.error.duplicate_url'),
          'error',
        ),
      );
      expect(onCommitSnsFetch).not.toHaveBeenCalled();

      showToastSpy.mockRestore();
    });

    it('写真付きツイート→別の写真付きツイートの順で貼ると、2本目の写真も合流し代表(tweetId)は1本目のまま維持される', async () => {
      const onCommitSnsFetch = vi.fn().mockResolvedValue({ ok: true });
      const { rerender } = renderPanel({ sourceImageUrls: [], onCommitSnsFetch });
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: 写真Aのみ (aspect ratio 1.5 付き)。
      fireEvent.change(input, { target: { value: TWEET_URL_A } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-A',
          author: { name: 'A', screen_name: 'a' },
          photos: ['https://pbs.twimg.com/a1.jpg'],
          photoAspectRatios: [1.5],
          video: null,
        },
      };
      const tree = (sourceImageUrls: string[], sourcePostUrls: string[]) =>
        buildTree({
          sourceImageUrls,
          onSourceImageUrlsChange: vi.fn(),
          videoPreview: null,
          sourcePostUrls,
          onCommitSnsFetch,
        });
      rerender(tree([], []));
      await waitFor(() => expect(onCommitSnsFetch).toHaveBeenCalledTimes(1));
      expect(onCommitSnsFetch.mock.calls[0][1]).toEqual(['https://pbs.twimg.com/a1.jpg']);
      const captureAfterA = onCommitSnsFetch.mock.calls[0][0];
      expect(captureAfterA.tweetSource.tweetId).toBe('1842219000000000001');
      expect(captureAfterA.tweetData.photoAspectRatios).toEqual([1.5]);

      // 2本目: 別のツイートで写真Bのみ (aspect ratio 0.75 付き)。親が1本目の成功結果
      // (sourceImageUrls蓄積後) を反映した状態として rerender する (実際の RegisterPage の
      // 挙動を模倣)。
      fireEvent.change(input, { target: { value: TWEET_URL_B } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-B',
          author: { name: 'B', screen_name: 'b' },
          photos: ['https://pbs.twimg.com/b1.jpg'],
          photoAspectRatios: [0.75],
          video: null,
        },
      };
      rerender(tree(['https://pbs.twimg.com/a1.jpg'], [TWEET_URL_A]));

      await waitFor(() => expect(onCommitSnsFetch).toHaveBeenCalledTimes(2));
      // 2本目の写真も合流している (2本目の写真だけに絞られていない = Bug2/Bug3 と同型の消失防止)。
      expect(onCommitSnsFetch.mock.calls[1][1]).toEqual([
        'https://pbs.twimg.com/a1.jpg',
        'https://pbs.twimg.com/b1.jpg',
      ]);
      // 代表 (tweetId) は1本目 (A) のまま維持される (RegisterPage.tsx handleTweetFetched と同じ
      // 「最初に確立したURLの識別情報を維持する」設計)。
      const captureAfterB = onCommitSnsFetch.mock.calls[1][0];
      expect(captureAfterB.tweetSource.tweetId).toBe('1842219000000000001');
      expect(captureAfterB.tweetData.photos).toEqual([
        'https://pbs.twimg.com/a1.jpg',
        'https://pbs.twimg.com/b1.jpg',
      ]);
      // Bug2 fix: 2本目の photoAspectRatios マージが 1本目 (1.5) を undefined 起点でリセットせず、
      // 1本目+2本目の両方 ([1.5, 0.75]) を保持する (index 整合)。
      expect(captureAfterB.tweetData.photoAspectRatios).toEqual([1.5, 0.75]);
    });

    it('既に動画がある状態 (videoPreview) で動画付きツイートを貼ると拒否トーストが出て onCommitSnsFetch は呼ばれない', async () => {
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});
      const { onCommitSnsFetch, rerender } = renderPanel({
        sourceImageUrls: [],
        videoPreview: { url: 'https://x/existing.mp4', posterUrl: 'https://x/existing-poster.jpg' },
      });
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: TWEET_URL_A } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'video-tweet',
          author: { name: 'V', screen_name: 'v' },
          photos: [],
          video: {
            url: 'https://video.twimg.com/ext_tw_video/new.mp4',
            posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/new.jpg',
            aspectRatio: 1.5,
          },
        },
      };
      rerender(
        buildTree({
          sourceImageUrls: [],
          onSourceImageUrlsChange: vi.fn(),
          videoPreview: { url: 'https://x/existing.mp4', posterUrl: 'https://x/existing-poster.jpg' },
          sourcePostUrls: [],
          onCommitSnsFetch,
        }),
      );

      await waitFor(() =>
        expect(showToastSpy).toHaveBeenCalledWith(
          i18n.t('housing.register.snsUrl.error.video_limit'),
          'error',
        ),
      );
      expect(onCommitSnsFetch).not.toHaveBeenCalled();

      showToastSpy.mockRestore();
    });

    /**
     * Bug1 fix (2026-07-22 レビュー指摘): サーバーに保存済みの代表が Twitter+動画のとき、
     * HousingEditMediaSection のタブ切替でこのパネルが remount されると captureRef が
     * EMPTY_SNS_CAPTURE に戻る (= capture.tweetData/capture.youtube はどちらも falsy)。
     * この状態で OGP URL (画像あり) を貼ると、修正前は capture.tweetData/capture.youtube
     * しか見ていなかったため拒否されずマージされ、動画フィールド (tweetId/videoUrl/
     * videoPosterUrl/videoAspectRatio) を持たない OGP 形の payload が commit されて
     * サーバー側 SNS_SUBFIELDS クリーンアップが保存済み動画を FieldValue.delete() で
     * サイレントに消してしまっていた。videoPreview prop (cross-session-aware) を見る
     * ガードを追加したことで、この組み合わせは commit 前にクライアント側で拒否される。
     */
    it('サーバー保存済みTwitter代表(動画あり=videoPreview)の状態でOGP画像URLを貼ると拒否トーストが出てcommitされず動画は消えない (Bug1 fix)', async () => {
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});
      const savedVideoPreview = {
        url: 'https://x/saved-video.mp4',
        posterUrl: 'https://x/saved-video-poster.jpg',
        aspectRatio: 1.78,
      };
      // captureRef はこのコンポーネントの初回マウント時点で常に EMPTY_SNS_CAPTURE
      // (= remount 直後を模している)。videoPreview だけがサーバー保存済みの動画を示す。
      const { onCommitSnsFetch, rerender } = renderPanel({
        sourceImageUrls: [],
        videoPreview: savedVideoPreview,
      });
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      const OGP_URL = 'https://housingsnap.com/55501';
      fireEvent.change(input, { target: { value: OGP_URL } });
      ogpState = {
        ...ogpState,
        status: 'success',
        data: {
          image: 'https://housingsnap.com/img/x1.jpg',
          images: ['https://housingsnap.com/img/x1.jpg'],
          title: 't',
          description: 'd',
          siteName: 'housingsnap',
          text: 'text',
        },
      };
      rerender(
        buildTree({
          sourceImageUrls: [],
          onSourceImageUrlsChange: vi.fn(),
          videoPreview: savedVideoPreview,
          sourcePostUrls: [],
          onCommitSnsFetch,
        }),
      );

      await waitFor(() =>
        expect(showToastSpy).toHaveBeenCalledWith(
          i18n.t('housing.register.snsUrl.error.video_limit'),
          'error',
        ),
      );
      // commit されない = サーバーへ「動画フィールド無しの payload」が送られない
      // = 保存済みの videoPreview (tweetId/videoUrl 等) が消される事故が起きない。
      expect(onCommitSnsFetch).not.toHaveBeenCalled();

      showToastSpy.mockRestore();
    });

    /**
     * (c) OGP 代表 (写真のみ・動画なし) が既に確定している状態で Twitter URL (写真あり) が
     * 届いた場合、写真は共有プール (sourceImageUrls) へ合流する — という「既存の正しい
     * cross-type マージ挙動」をコードトレースだけでなく実テストで確認する (レビュー指摘の
     * カバレッジギャップ埋め)。
     */
    /**
     * Bug5 fix (最終レビュー指摘・2026-07-22): サーバーに保存済みの代表が Twitter+動画のとき、
     * HousingEditMediaSection のタブ切替でこのパネルが remount されると captureRef が
     * EMPTY_SNS_CAPTURE に戻り、capture.tweetData は null になる (= capture.tweetData?.video も
     * undefined)。この状態で「写真のみ (動画なし) の別ツイート」を貼ると、修正前は
     * becomesTwitterRepresentative が true になり (hasRepresentative=false かつ photos.length>0)
     * nextCapture.tweetData.video が `capture.tweetData?.video ?? (adoptsVideo ? data.video : null)`
     * = `undefined ?? (false ? data.video : null)` = null に組まれてしまい、videoPreview prop
     * (サーバー保存済みの真の状態) が動画ありを示しているにもかかわらず、commit された
     * capture 上では動画が消えていた (トーストも無くサイレントに消失・data-loss)。
     * videoPreviewToTweetVideo 経由で復元することで、commit される capture にも動画が
     * 残ることを確認する (UI の videoPreview 表示だけでなく、実際に送信される payload を検証)。
     */
    it('サーバー保存済みTwitter代表(動画あり=videoPreview)の状態で写真のみの別ツイートを追記しても、commitされるcaptureの動画は消えない (Bug5 fix)', async () => {
      const savedVideoPreview = {
        url: 'https://x/saved-video.mp4',
        posterUrl: 'https://x/saved-video-poster.jpg',
        aspectRatio: 1.78,
      };
      // captureRef はこのコンポーネントの初回マウント時点で常に EMPTY_SNS_CAPTURE
      // (= remount 直後を模している)。videoPreview だけがサーバー保存済みの動画を示す。
      const { onCommitSnsFetch, rerender } = renderPanel({
        sourceImageUrls: [],
        videoPreview: savedVideoPreview,
      });
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: TWEET_URL_A } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-only',
          author: { name: 'P', screen_name: 'p' },
          photos: ['https://pbs.twimg.com/photo-only.jpg'],
          video: null,
        },
      };
      rerender(
        buildTree({
          sourceImageUrls: [],
          onSourceImageUrlsChange: vi.fn(),
          videoPreview: savedVideoPreview,
          sourcePostUrls: [],
          onCommitSnsFetch,
        }),
      );

      await waitFor(() => expect(onCommitSnsFetch).toHaveBeenCalledTimes(1));
      const committedCapture = onCommitSnsFetch.mock.calls[0][0];
      // 写真は追記されている (通常のマージ動作)。
      expect(committedCapture.tweetData.photos).toEqual(['https://pbs.twimg.com/photo-only.jpg']);
      // 保存済み動画が videoPreview から復元され、null に潰されていない。
      expect(committedCapture.tweetData.video).toEqual({
        url: savedVideoPreview.url,
        posterUrl: savedVideoPreview.posterUrl,
        aspectRatio: savedVideoPreview.aspectRatio,
      });
    });

    it('OGP代表(写真のみ・動画なし)の状態でTwitter URL(写真あり)を貼ると、写真は共有プールに合流する (cross-type merge)', async () => {
      const OGP_URL = 'https://housingsnap.com/77701';
      const { onCommitSnsFetch, rerender } = renderPanel({
        sourceImageUrls: ['https://housingsnap.com/img/existing1.jpg'],
        sourcePostUrls: [OGP_URL],
        videoPreview: null,
      });
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: TWEET_URL_A } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'cross-type',
          author: { name: 'C', screen_name: 'c' },
          photos: ['https://pbs.twimg.com/cross1.jpg'],
          video: null,
        },
      };
      rerender(
        buildTree({
          sourceImageUrls: ['https://housingsnap.com/img/existing1.jpg'],
          onSourceImageUrlsChange: vi.fn(),
          videoPreview: null,
          sourcePostUrls: [OGP_URL],
          onCommitSnsFetch,
        }),
      );

      await waitFor(() => expect(onCommitSnsFetch).toHaveBeenCalledTimes(1));
      expect(onCommitSnsFetch.mock.calls[0][1]).toEqual([
        'https://housingsnap.com/img/existing1.jpg',
        'https://pbs.twimg.com/cross1.jpg',
      ]);
    });
  });
});
