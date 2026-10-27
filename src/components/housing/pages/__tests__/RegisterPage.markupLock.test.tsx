// @vitest-environment happy-dom
// 一時検査 (整頓④ RegisterPage 分割用): 分割前の「画面の中身(HTML)」と「外への呼び出し」を
// スナップショットに記録し、分割後も 1 文字も変わらないことを確認する。分割完了後に削除する。
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import type { HousingListing } from '../../../../types/housing';

// 外への呼び出しを 1 本の記録配列に積む。
const { calls, ctl } = vi.hoisted(() => ({
  calls: [] as unknown[][],
  ctl: {
    updateResult: { ok: true } as { ok: boolean; error?: string },
    dup: { duplicates: [], privateMatchCount: 0 } as any,
    canRegister: 'ok' as 'ok' | 'fail' | 'ticket',
  },
}));

const updateMock = vi.fn();
vi.mock('../../edit/useHousingUpdate', () => ({
  useHousingUpdate: () => ({ update: updateMock, loading: false }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../../lib/housingListingsService', () => ({
  getListingById: vi.fn(async (...a: unknown[]) => {
    calls.push(['getListingById', ...a]);
    return null;
  }),
  getMyListings: vi.fn(async (...a: unknown[]) => {
    calls.push(['getMyListings', ...a]);
    return [];
  }),
}));

vi.mock('../../register/RegisterHousingerCta', () => ({
  RegisterHousingerCta: () => null,
}));

vi.mock('../../../../lib/housing/imageCompression', () => ({
  compressHousingImage: vi.fn(async (file: File) => ({
    base64: 'ZmFrZQ==',
    mimeType: 'image/webp',
    file,
    originalBytes: 1000,
    compressedBytes: 800,
  })),
}));

const mockFetchTweet = vi.fn();
const mockCancelTweet = vi.fn();
const mockResetTweet = vi.fn();
let tweetState: any = {};
vi.mock('../../../../lib/housing/useTweetFetch', () => ({
  useTweetFetch: () => tweetState,
}));

const mockFetchOgp = vi.fn();
const mockCancelOgp = vi.fn();
const mockResetOgp = vi.fn();
let ogpState: any = {};
vi.mock('../../../../lib/housing/useOgpFetch', () => ({
  useOgpFetch: () => ogpState,
}));

const mockFetchYoutubeMeta = vi.fn();
const mockCancelYoutube = vi.fn();
const mockResetYoutube = vi.fn();
let youtubeState: any = {};
vi.mock('../../../../lib/housing/useYoutubeFetch', () => ({
  useYoutubeFetch: () => youtubeState,
}));

import { RegisterPage } from '../RegisterPage';
import * as housingApiClient from '../../../../lib/housingApiClient';
import * as ToastModule from '../../../Toast';
import { AUTOSAVE_KEY } from '../../../../lib/housing/registerAutosave';
import { saveRegisterPrefill } from '../../../../lib/housing/registerPrefill';

vi.setConfig({ testTimeout: 90000 });

const EDITABLE_LISTING = {
  id: 'l1',
  dc: 'Meteor',
  server: 'Ramuh',
  area: 'LavenderBeds',
  ward: 29,
  plot: 3,
  buildingType: 'house',
  size: 'L',
  title: 'テスト物件',
  description: 'テスト紹介文',
  tags: ['official_cafe'],
  visibility: 'public',
  sourceImageUrls: ['https://x/a.jpg'],
} as unknown as HousingListing;

const VALID_DRAFT = {
  title: '新規物件',
  dc: 'Meteor',
  server: 'Ramuh',
  area: 'LavenderBeds',
  ward: 29,
  buildingType: 'house',
  plot: 3,
  size: 'L',
  visibility: 'public',
};

const DUP_ENTRY = { id: 'd1', ownerUid: 'u2', createdAt: 1700000000000, tags: ['official_cafe'] };

const tree = (props?: {
  mode?: 'create' | 'edit';
  initialValues?: HousingListing;
  onSaved?: (id: string) => void | Promise<unknown>;
}) => (
  <I18nextProvider i18n={i18n}>
    <MemoryRouter>
      <RegisterPage mode={props?.mode} initialValues={props?.initialValues} onSaved={props?.onSaved} />
    </MemoryRouter>
  </I18nextProvider>
);

const sleep = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

/** 全タイマー(500ms 重複照会 / 700ms オートセーブ / 150ms スタッガー)が落ち着いてから記録する。 */
async function snap(label: string, ms = 1000) {
  await sleep(ms);
  expect({
    label,
    html: document.body.innerHTML,
    calls: JSON.parse(JSON.stringify(calls)),
  }).toMatchSnapshot();
}

const login = (extra?: Record<string, unknown>) =>
  useAuthStore.setState({ user: { uid: 'me' } as any, loading: false, ...(extra ?? {}) } as any);

const el = (sel: string) => document.querySelector(sel) as HTMLElement;
const setField = (sel: string, value: string) =>
  fireEvent.change(el(sel), { target: { value } });

function clickBuildingType(name: string) {
  const groups = document.querySelectorAll('[role="radiogroup"]');
  fireEvent.click(within(groups[0] as HTMLElement).getByRole('radio', { name }));
}

function fillHouseAddress() {
  clickBuildingType('個人宅・FCハウス');
  setField('#housing-register-dc', 'Meteor');
  setField('#housing-register-server', 'Ramuh');
  setField('#housing-register-area', 'LavenderBeds');
  setField('#housing-register-ward', '29');
  setField('#housing-register-plot', '3');
}

async function attachImage() {
  const toggle = el('[data-testid="housing-register-toggle-upload"]');
  if (toggle) fireEvent.click(toggle);
  const input = el('.housing-register-image-input');
  fireEvent.change(input, { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } });
  await waitFor(() => expect(el('.housing-register-image-tile')).not.toBeNull());
}

const snsInput = () => screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

const tweetData = (text: string, photos: string[], video: any = null) => ({
  text,
  author: { name: 'A', screen_name: 'a' },
  photos,
  video,
});

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

let blobSeq = 0;
// spy で包む前の本物を 1 回だけ控える(包み直しで記録が二重にならないように)。
const origSet = window.localStorage.setItem.bind(window.localStorage);
const origRemove = window.localStorage.removeItem.bind(window.localStorage);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-27T00:00:00Z'));
  calls.length = 0;
  blobSeq = 0;
  ctl.updateResult = { ok: true };
  ctl.dup = { duplicates: [], privateMatchCount: 0 };
  ctl.canRegister = 'ok';
  useAuthStore.setState({ user: null, loading: false, isAdmin: false } as any);

  updateMock.mockReset();
  updateMock.mockImplementation(async (...a: unknown[]) => {
    calls.push(['update', ...a]);
    return ctl.updateResult;
  });
  navigateMock.mockReset();
  navigateMock.mockImplementation((...a: unknown[]) => {
    calls.push(['navigate', ...a]);
  });

  tweetState = { status: 'idle', data: null, errorCode: null, fetchTweet: mockFetchTweet, cancel: mockCancelTweet, reset: mockResetTweet };
  ogpState = { status: 'idle', data: null, errorCode: null, fetchOgp: mockFetchOgp, cancel: mockCancelOgp, reset: mockResetOgp };
  youtubeState = { status: 'idle', data: null, fetchYoutubeMeta: mockFetchYoutubeMeta, cancel: mockCancelYoutube, reset: mockResetYoutube };

  vi.spyOn(housingApiClient, 'canRegister').mockImplementation(async () => {
    calls.push(['canRegister']);
    if (ctl.canRegister === 'fail') throw new Error('boom');
    if (ctl.canRegister === 'ticket') return { remaining: 3, registrationCount: 0 } as any;
    return { remaining: 3, registrationCount: 30 } as any;
  });
  vi.spyOn(housingApiClient, 'checkDuplicate').mockImplementation(async (a: any) => {
    calls.push(['checkDuplicate', a]);
    return ctl.dup;
  });
  vi.spyOn(housingApiClient, 'registerListing').mockImplementation(async (d: any) => {
    calls.push(['registerListing', d]);
    return { id: 'new1' } as any;
  });
  vi.spyOn(housingApiClient, 'uploadListingThumbnail').mockImplementation(async (a: any) => {
    calls.push(['uploadListingThumbnail', a]);
    return undefined as any;
  });
  vi.spyOn(ToastModule, 'showToast').mockImplementation((...a: any[]) => {
    calls.push(['showToast', ...a]);
  });
  (Element.prototype as any).scrollIntoView = function (this: HTMLElement, arg: unknown) {
    calls.push(['scrollIntoView', this.dataset.stepId, arg]);
  };
  (URL as any).createObjectURL = () => `blob:mock/${blobSeq++}`;
  (URL as any).revokeObjectURL = () => {};

  window.localStorage.removeItem(AUTOSAVE_KEY);
  window.sessionStorage.clear();
  const ls = window.localStorage;
  vi.spyOn(ls, 'setItem').mockImplementation((k: string, v: string) => {
    calls.push(['localStorage.setItem', k, v]);
    origSet(k, v);
  });
  vi.spyOn(ls, 'removeItem').mockImplementation((k: string) => {
    calls.push(['localStorage.removeItem', k]);
    origRemove(k);
  });
  useHousingListingsStore.setState({ listings: [] } as any);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.removeItem(AUTOSAVE_KEY);
});

describe('RegisterPage markupLock (分割前の記録)', () => {
  it('未ログイン', async () => {
    render(tree());
    await snap('logged-out');
  });

  it('create 初期: 一般 / 管理者 / 残数取得失敗 / 最初の登録券あり', async () => {
    login();
    const r = render(tree());
    await snap('create-general');
    r.unmount();

    calls.length = 0;
    login();
    useAuthStore.setState({ isAdmin: true } as any);
    const r2 = render(tree());
    await snap('create-admin');
    r2.unmount();

    calls.length = 0;
    useAuthStore.setState({ isAdmin: false } as any);
    ctl.canRegister = 'fail';
    const r3 = render(tree());
    await snap('create-quota-fail');
    r3.unmount();

    calls.length = 0;
    ctl.canRegister = 'ticket';
    render(tree());
    await snap('create-tickets');
  });

  it('住所を手入力(家→アパート)・重複なし', async () => {
    login();
    render(tree());
    fillHouseAddress();
    await snap('house-typed-dup-clear', 1200);
    clickBuildingType('アパルトメント');
    await snap('apartment-selected', 1200);
    setField('#housing-register-apartment-room-number', '12');
    await snap('apartment-room', 1200);
  });

  it('住所を手入力・重複あり(公開) / (非公開)', async () => {
    login();
    ctl.dup = { duplicates: [DUP_ENTRY], privateMatchCount: 0 };
    const r = render(tree());
    fillHouseAddress();
    await snap('dup-public-found', 1200);
    r.unmount();

    calls.length = 0;
    ctl.dup = { duplicates: [], privateMatchCount: 2 };
    render(tree());
    fillHouseAddress();
    await snap('dup-private-found', 1200);
  });

  it('住所確認 → 画像1枚 → 送信(重複なし→登録→遷移)', async () => {
    login();
    render(tree());
    fillHouseAddress();
    await attachImage();
    await snap('create-image-attached', 1200);
    fireEvent.click(screen.getByTestId('housing-register-confirm-address-btn'));
    await snap('create-address-confirmed');
    setField('[data-testid="housing-register-title-input"]', '新しい家');
    await snap('create-title-typed');
    fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    await snap('create-submitted');
  });

  it('送信で重複→ダイアログ→「それでも登録」', async () => {
    login();
    ctl.dup = { duplicates: [DUP_ENTRY], privateMatchCount: 0 };
    render(tree());
    fillHouseAddress();
    await attachImage();
    fireEvent.click(screen.getByTestId('housing-register-confirm-address-btn'));
    await sleep(1200);
    fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));
    await screen.findByText(i18n.t('housing.duplicate.proceed'));
    await snap('submit-dup-dialog');
    fireEvent.click(screen.getByText(i18n.t('housing.duplicate.proceed')));
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    await snap('submit-dup-proceed');
  });

  it('送信で重複→ダイアログ→「戻って修正」', async () => {
    login();
    ctl.dup = { duplicates: [DUP_ENTRY], privateMatchCount: 0 };
    render(tree());
    fillHouseAddress();
    await attachImage();
    fireEvent.click(screen.getByTestId('housing-register-confirm-address-btn'));
    await sleep(1200);
    fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));
    await screen.findByText(i18n.t('housing.duplicate.correct'));
    fireEvent.click(screen.getByText(i18n.t('housing.duplicate.correct')));
    await snap('submit-dup-correct');
  });

  it('ツイート取得(住所自動入力・動画あり・2本目の重複URL)', async () => {
    login();
    const { rerender } = render(tree());
    const URL_A = 'https://x.com/user/status/1842217368673759510';
    fireEvent.change(snsInput(), { target: { value: URL_A } });
    tweetState = {
      ...tweetState,
      status: 'success',
      data: tweetData('Mana / Anima / Mist 3-15', ['https://pbs.twimg.com/a1.jpg'], {
        url: 'https://video.twimg.com/v.mp4',
        posterUrl: 'https://pbs.twimg.com/p.jpg',
        aspectRatio: 1.5,
      }),
    };
    rerender(tree());
    await snap('tweet-fetched', 2200);

    // 同じ URL をもう一度(重複)
    fireEvent.change(snsInput(), { target: { value: URL_A } });
    tweetState = {
      ...tweetState,
      status: 'success',
      data: tweetData('Mana / Anima / Mist 3-15', ['https://pbs.twimg.com/a1.jpg']),
    };
    rerender(tree());
    await snap('tweet-duplicate-url', 1200);
  });

  it('YouTube取得 / OGP取得 / 住所が取れない失敗', async () => {
    login();
    const { rerender, unmount } = render(tree());
    fireEvent.change(snsInput(), { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
    youtubeState = { ...youtubeState, status: 'success', data: { description: 'Mana / Anima / Mist 3-15' } };
    rerender(tree());
    await snap('youtube-fetched', 2200);
    unmount();

    calls.length = 0;
    youtubeState = { ...youtubeState, status: 'idle', data: null };
    const r2 = render(tree());
    fireEvent.change(snsInput(), { target: { value: 'https://housingsnap.com/98765' } });
    ogpState = {
      ...ogpState,
      status: 'success',
      data: {
        image: 'https://housingsnap.com/img/b1.jpg',
        images: ['https://housingsnap.com/img/b1.jpg'],
        title: 't',
        description: 'Mana / Anima / Mist 3-15',
        siteName: 'housingsnap',
        text: 'text',
      },
    };
    r2.rerender(tree());
    await snap('ogp-fetched', 2200);
    r2.unmount();

    calls.length = 0;
    ogpState = { ...ogpState, status: 'idle', data: null };
    const r3 = render(tree());
    fireEvent.change(snsInput(), { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
    youtubeState = { ...youtubeState, status: 'success', data: { description: '住所なし' } };
    r3.rerender(tree());
    await snap('youtube-no-address', 1200);
  });

  it('URL欄を増やす・減らす', async () => {
    login();
    render(tree());
    fireEvent.click(screen.getByTestId('housing-multi-url-add'));
    await snap('url-slot-2', 300);
    fireEvent.click(screen.getByTestId('housing-multi-url-add'));
    await snap('url-slot-3', 300);
    fireEvent.click(screen.getByTestId('housing-multi-url-remove-1'));
    await snap('url-slot-removed', 300);
  });

  it('下書きを置いてマウント → 復元通知 → 破棄', async () => {
    login();
    window.localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ...VALID_DRAFT, postUrl: 'https://x.com/user/status/1842217368673759510' }),
    );
    render(tree());
    await snap('restored-notice');
    fireEvent.click(screen.getByTestId('housing-register-autosave-discard'));
    await snap('restored-discarded');
  });

  it('一時ツアーのプリフィル', async () => {
    login();
    saveRegisterPrefill({ area: 'LavenderBeds', ward: 29, buildingType: 'house', plot: 3, size: 'L' });
    render(tree());
    await snap('prefill');
  });

  it('edit 初期 → タイトル変更 → 保存(成功) / (失敗)', async () => {
    login();
    const onSaved = vi.fn(async (id: string) => {
      calls.push(['onSaved', id]);
    });
    const r = render(tree({ mode: 'edit', initialValues: EDITABLE_LISTING, onSaved }));
    await snap('edit-initial');
    setField('[data-testid="housing-register-title-input"]', '変更後タイトル');
    await snap('edit-title-changed');
    fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    await snap('edit-saved');
    r.unmount();

    calls.length = 0;
    ctl.updateResult = { ok: false, error: 'generic' };
    render(tree({ mode: 'edit', initialValues: EDITABLE_LISTING, onSaved }));
    fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    await snap('edit-save-failed');
  });

  it('ステッパーのジャンプ(create / edit)', async () => {
    login();
    const r = render(tree());
    fireEvent.click(screen.getByTestId('housing-register-step-3'));
    await snap('jump-create-3', 300);
    r.unmount();

    calls.length = 0;
    render(tree({ mode: 'edit', initialValues: EDITABLE_LISTING }));
    fireEvent.click(screen.getByTestId('housing-register-step-2'));
    await snap('jump-edit-2', 300);
  });
});
