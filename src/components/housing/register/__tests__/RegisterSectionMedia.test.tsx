// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

// useTweetFetch / useOgpFetch をモックして fetch 状態だけ差し替える
// (HousingRegisterSnsUrlField.test.tsx のモック方式に合わせる)
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

  it('取得中 (tweet loading) はスケルトンを表示する', () => {
    tweetState = { ...tweetState, status: 'loading' };
    renderMedia();
    expect(screen.getByTestId('housing-register-media-loading')).toBeInTheDocument();
  });

  it('取得中 (ogp loading) もスケルトンを表示する', () => {
    ogpState = { ...ogpState, status: 'loading' };
    renderMedia();
    expect(screen.getByTestId('housing-register-media-loading')).toBeInTheDocument();
  });

  it('OGP 取得成功で取得枚数を表示する', () => {
    renderMedia({
      sourceImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });
    expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent('2');
  });

  it('取得失敗時は理由 + 対処を静かな注記として表示する (色付き箱にしない)', () => {
    tweetState = { ...tweetState, status: 'error', errorCode: 'notFound' };
    renderMedia();
    const notice = screen.getByTestId('housing-register-media-error');
    expect(notice).toBeInTheDocument();
    expect(notice.className).not.toMatch(/alert|danger|warning/i);
    expect(
      within(notice).getByText(jaTranslations.housing.register.snsUrl.error.notFound),
    ).toBeInTheDocument();
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
