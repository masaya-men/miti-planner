// @vitest-environment happy-dom
/**
 * EphemeralAddPanel: URL 欄の取得まわり (OGP 取得の自動入力・取得中表示・取得失敗・不正 URL・入力クリア)。
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { EphemeralAddPanel } from '../EphemeralAddPanel';
import { useEphemeralListingsStore } from '../../../../store/useEphemeralListingsStore';

const mockFetchOgp = vi.fn();
let ogpState: any = { status: 'idle', data: null, fetchOgp: mockFetchOgp, reset: vi.fn() };
vi.mock('../../../../lib/housing/useOgpFetch', () => ({ useOgpFetch: () => ogpState }));

let tweetState: any = { status: 'idle', data: null, fetchTweet: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useTweetFetch', () => ({ useTweetFetch: () => tweetState }));

let youtubeState: any = { status: 'idle', data: null, fetchYoutubeMeta: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useYoutubeFetch', () => ({ useYoutubeFetch: () => youtubeState }));

const IDLE = { status: 'idle' as const, total: 0, processed: 0, added: 0, failed: 0, limitReached: false, shareNotFound: false };
vi.mock('../../../../lib/housing/useAllmarksImport', () => ({
  useAllmarksImport: () => ({ progress: IDLE, start: vi.fn(), cancel: vi.fn() }),
}));

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

beforeEach(() => {
  useEphemeralListingsStore.getState().clear();
  mockFetchOgp.mockClear();
  ogpState = { status: 'idle', data: null, fetchOgp: mockFetchOgp, reset: vi.fn() };
  tweetState = { status: 'idle', data: null, fetchTweet: vi.fn(), reset: vi.fn() };
  youtubeState = { status: 'idle', data: null, fetchYoutubeMeta: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
});

const ui = () => (
  <I18nextProvider i18n={i18n}>
    <EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />
  </I18nextProvider>
);
const urlInput = () => screen.getByLabelText('SNSのURLから') as HTMLInputElement;

describe('EphemeralAddPanel — URL 欄の取得', () => {
  it('不正な URL を入れると取得失敗の文言が出て、直すと消える', () => {
    render(ui());
    fireEvent.change(urlInput(), { target: { value: 'https://example.invalid/foo' } });
    expect(screen.getByText('URLから情報を取得できませんでした')).toBeInTheDocument();
    fireEvent.change(urlInput(), { target: { value: '' } });
    expect(screen.queryByText('URLから情報を取得できませんでした')).toBeNull();
  });

  it('ツイート取得中は取得中表示が出る', () => {
    const { rerender } = render(ui());
    fireEvent.change(urlInput(), { target: { value: 'https://x.com/a/status/1' } });
    tweetState = { ...tweetState, status: 'loading' };
    rerender(ui());
    expect(screen.getByText('ツイートを読み取り中…')).toBeInTheDocument();
  });

  it('ツイート取得エラーなら取得失敗の文言が出る', () => {
    const { rerender } = render(ui());
    fireEvent.change(urlInput(), { target: { value: 'https://x.com/a/status/1' } });
    tweetState = { ...tweetState, status: 'error' };
    rerender(ui());
    expect(screen.getByText('URLから情報を取得できませんでした')).toBeInTheDocument();
  });

  it('ツイート本文の住所が下のフォームに自動入力される', () => {
    const { rerender } = render(ui());
    fireEvent.change(urlInput(), { target: { value: 'https://x.com/a/status/1' } });
    tweetState = { ...tweetState, status: 'success', data: { text: 'Mist 3-15', photos: [] } };
    rerender(ui());
    expect((screen.getByLabelText('区') as HTMLInputElement).value).toBe('3');
    expect((screen.getByLabelText('番地') as HTMLInputElement).value).toBe('15');
  });

  it('読み取れない本文だと parse_error が出る', () => {
    const { rerender } = render(ui());
    fireEvent.change(urlInput(), { target: { value: 'https://x.com/a/status/1' } });
    tweetState = { ...tweetState, status: 'success', data: { text: 'こんにちは', photos: [] } };
    rerender(ui());
    expect(screen.getByText('住所を読み取れませんでした。下の欄で選択してください')).toBeInTheDocument();
  });

  it('許可サイトの URL は OGP 取得に回り、取得成功で住所が自動入力される', () => {
    const { rerender } = render(ui());
    fireEvent.change(urlInput(), { target: { value: 'https://housingsnap.com/p/1' } });
    expect(mockFetchOgp).toHaveBeenCalledWith('https://housingsnap.com/p/1');
    ogpState = { ...ogpState, status: 'success', data: { title: 'Mist 3-15', description: '', text: '', image: null, images: [] } };
    rerender(ui());
    expect((screen.getByLabelText('区') as HTMLInputElement).value).toBe('3');
  });
});
