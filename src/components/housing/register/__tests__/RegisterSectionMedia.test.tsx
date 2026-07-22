// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

// useTweetFetch / useOgpFetch をモックする。
// RegisterSectionMedia は Batch2 (Task7) で HousingRegisterMultiUrlField を挟むようになり、
// 実 fetch (useTweetFetch/useOgpFetch) を呼ぶのはその内部の HousingRegisterSnsUrlField インスタンス。
// ここでモックするのは「子が実際に使う」hook であり、その status を差し替えると
// 子→callback (onTweetFetched 等) の実配線が検証できる。
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

import { RegisterSectionMedia } from '../RegisterSectionMedia';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderMedia(props: Partial<React.ComponentProps<typeof RegisterSectionMedia>> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <RegisterSectionMedia
        onTweetFetched={props.onTweetFetched ?? vi.fn()}
        onOgpFetched={props.onOgpFetched ?? vi.fn()}
        localImages={props.localImages ?? []}
        onLocalImagesChange={props.onLocalImagesChange ?? vi.fn()}
        sourceImageUrls={props.sourceImageUrls ?? []}
        onSourceImageUrlsChange={props.onSourceImageUrlsChange ?? vi.fn()}
        tweetVideo={props.tweetVideo}
        urlSlotCount={props.urlSlotCount ?? 1}
        onAddUrlSlot={props.onAddUrlSlot ?? vi.fn()}
        onRemoveUrlSlot={props.onRemoveUrlSlot ?? vi.fn()}
      />
    </I18nextProvider>,
  );
}

describe('RegisterSectionMedia', () => {
  beforeEach(() => {
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
  });

  it('OGP 取得成功で取得枚数を表示する', () => {
    renderMedia({
      sourceImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });
    expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent('2');
  });

  it('SNS URL 欄が表示される (HousingRegisterMultiUrlField 経由で HousingRegisterSnsUrlField を流用)', () => {
    renderMedia();
    expect(
      screen.getByLabelText(jaTranslations.housing.register.snsUrl.label),
    ).toBeInTheDocument();
  });

  it('URL 入力で X の URL なら fetchTweet が呼ばれる', () => {
    renderMedia();
    const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);
    fireEvent.change(input, { target: { value: 'https://x.com/user/status/1842217368673759498' } });
    expect(mockFetchTweet).toHaveBeenCalledWith('1842217368673759498');
  });

  // B (メディアプレビュー): 動画ツイートの poster + 「動画あり」バッジ最小プレビュー。
  describe('動画プレビュー (tweetVideo)', () => {
    const video = {
      url: 'https://video.twimg.com/ext_tw_video/x.mp4',
      posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/poster.jpg',
      aspectRatio: 1.7777,
    };

    it('動画ツイートで poster プレビューと「動画あり」バッジを出す', () => {
      renderMedia({ tweetVideo: video });
      const preview = screen.getByTestId('housing-register-media-video');
      expect(preview).toBeInTheDocument();
      // poster は pbs.twimg.com (CSP img-src 許可) を <img> で直参照する
      const img = preview.querySelector('img') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe(video.posterUrl);
      // 「動画あり」バッジ (i18n キー配線)。locale 値に依存せずクラスで存在検証する
      expect(preview.querySelector('.housing-register-media-video-badge')).toBeInTheDocument();
    });

    it('画像ツイート (tweetVideo なし) では動画プレビューを出さず、静止画枚数注記は回帰しない', () => {
      renderMedia({
        sourceImageUrls: ['https://pbs.twimg.com/a.jpg', 'https://pbs.twimg.com/b.jpg'],
      });
      expect(screen.queryByTestId('housing-register-media-video')).toBeNull();
      expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent('2');
    });

    it('動画なし (YouTube/OGP は tweetVideo=null) では動画プレビューを誤発火しない', () => {
      renderMedia({ tweetVideo: null });
      expect(screen.queryByTestId('housing-register-media-video')).toBeNull();
    });
  });

  // Batch2 (Task7): URL優先UI + 上限明記。直接アップロードは折りたたみの奥に隠す。
  describe('RegisterSectionMedia: アップロード折りたたみ (Batch2)', () => {
    it('初期表示ではアップロード欄が隠れており、リンクを押すと表示される', () => {
      renderMedia();
      expect(screen.queryByTestId('housing-register-image-field')).toBeNull();
      fireEvent.click(screen.getByTestId('housing-register-toggle-upload'));
      expect(screen.getByTestId('housing-register-image-field')).toBeInTheDocument();
    });

    it('上限の説明文 (画像10枚・動画1本) が常に表示される', () => {
      renderMedia();
      expect(screen.getByText(/10枚/)).toBeInTheDocument();
      expect(screen.getByText(/1本/)).toBeInTheDocument();
    });
  });
});
