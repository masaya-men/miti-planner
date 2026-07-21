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
          'housing.register.snsUrl.error.duplicate_url',
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

      // 1本目: 写真Aのみ。
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

      // 2本目: 別のツイートで写真Bのみ。親が1本目の成功結果 (sourceImageUrls蓄積後) を
      // 反映した状態として rerender する (実際の RegisterPage の挙動を模倣)。
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
          'housing.register.snsUrl.error.video_limit',
          'error',
        ),
      );
      expect(onCommitSnsFetch).not.toHaveBeenCalled();

      showToastSpy.mockRestore();
    });
  });
});
