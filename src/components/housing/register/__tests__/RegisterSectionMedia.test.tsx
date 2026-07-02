// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

// useTweetFetch / useOgpFetch をモックする。
// 重要: RegisterSectionMedia は自前で hook を呼ばず、子 HousingRegisterSnsUrlField が握る
// 実 fetch 状態を onFetchStatusChange 経由で受け取る。ここでモックするのは「子が実際に使う」
// hook であり、その status を差し替えると子→callback→セクション表示 の実配線が検証される
// (かつては別インスタンスの hook をセクションが直接購読して常に idle だった dead 表示を廃止)。
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

  it('子の実 fetch (tweet loading) がセクション level のスケルトンに反映される', () => {
    // 子が握る tweet hook を loading にすると、子の onFetchStatusChange が loading を通知し
    // セクションのスケルトンが出る (別インスタンス購読の dead 表示ではなく実配線)。
    tweetState = { ...tweetState, status: 'loading' };
    renderMedia();
    expect(screen.getByTestId('housing-register-media-loading')).toBeInTheDocument();
  });

  it('子の実 fetch (ogp loading) もセクション level のスケルトンに反映される', () => {
    ogpState = { ...ogpState, status: 'loading' };
    renderMedia();
    expect(screen.getByTestId('housing-register-media-loading')).toBeInTheDocument();
  });

  it('取得中はセクション level だけが loading を出し、子のインライン fetch 表示は二重に出ない', () => {
    // 二重表示回避 (suppressInlineFetchStatus) の検証。子のインライン loading 行
    // (housing-fetch-indicator = キャンセルボタン付き) はセクションに表示させないこと。
    tweetState = { ...tweetState, status: 'loading' };
    const { container } = renderMedia();
    expect(screen.getByTestId('housing-register-media-loading')).toBeInTheDocument();
    // 子のインライン loading indicator (キャンセル文言) は出ない
    expect(
      screen.queryByText(jaTranslations.housing.register.snsUrl.cancel),
    ).not.toBeInTheDocument();
    expect(container.querySelector('.housing-fetch-indicator')).toBeNull();
  });

  it('OGP 取得成功で取得枚数を表示する', () => {
    renderMedia({
      sourceImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });
    expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent('2');
  });

  it('子の実 fetch 失敗 (tweet error) がセクション level の静かな注記に反映される (色付き箱にしない)', () => {
    tweetState = { ...tweetState, status: 'error', errorCode: 'notFound' };
    renderMedia();
    const notice = screen.getByTestId('housing-register-media-error');
    expect(notice).toBeInTheDocument();
    expect(notice.className).not.toMatch(/alert|danger|warning/i);
    expect(
      within(notice).getByText(jaTranslations.housing.register.snsUrl.error.notFound),
    ).toBeInTheDocument();
    // 子のインライン error block (再試行ボタン) は二重に出ない
    expect(
      screen.queryByText(jaTranslations.housing.register.snsUrl.retry),
    ).not.toBeInTheDocument();
  });

  it('子の実 fetch 失敗 (ogp error) もセクション level の静かな注記に反映される', () => {
    ogpState = { ...ogpState, status: 'error', errorCode: 'upstream' };
    renderMedia();
    const notice = screen.getByTestId('housing-register-media-error');
    expect(
      within(notice).getByText(jaTranslations.housing.register.snsUrl.ogp_error.upstream),
    ).toBeInTheDocument();
  });

  it('idle (fetch していない) 時はスケルトンもエラー注記も出ない', () => {
    renderMedia();
    expect(screen.queryByTestId('housing-register-media-loading')).toBeNull();
    expect(screen.queryByTestId('housing-register-media-error')).toBeNull();
  });

  it('SNS URL 欄が表示される (既存 HousingRegisterSnsUrlField 流用)', () => {
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
});
