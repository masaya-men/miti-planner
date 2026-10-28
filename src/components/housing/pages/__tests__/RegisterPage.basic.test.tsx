// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useAuthStore } from '../../../../store/useAuthStore';
import type { HousingListing } from '../../../../types/housing';

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

import { AUTOSAVE_KEY } from '../../../../lib/housing/registerAutosave';
import { saveRegisterPrefill, consumeRegisterPrefill } from '../../../../lib/housing/registerPrefill';
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

  it('未ログインならログイン案内を出す', () => {
    renderPage();
    expect(screen.getByTestId('housing-register-login-prompt')).toBeInTheDocument();
  });

  it('ログイン済ならフォーム枠 (3カラム) を出す', () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    renderPage();
    expect(screen.getByTestId('housing-register-form-root')).toBeInTheDocument();
  });

  it('mode=edit で initialValues が住所/紹介文/公開範囲/タグへプリフィルされる', () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    const listing = {
      id: 'l1',
      dc: 'Meteor',
      server: 'Ramuh',
      area: 'LavenderBeds',
      ward: 29,
      plot: 3,
      buildingType: 'house',
      size: 'L',
      description: 'テスト紹介文',
      tags: ['official_cafe'],
      visibility: 'public',
      sourceImageUrls: ['https://x/a.jpg'],
    } as unknown as HousingListing;

    const { container } = renderPage({ mode: 'edit', initialValues: listing });

    // 紹介文 (RegisterSectionIntro の textarea)
    expect(screen.getByDisplayValue('テスト紹介文')).toBeInTheDocument();

    // 住所 (RegisterSectionAddress の各フィールド)
    expect((container.querySelector('#housing-register-dc') as HTMLSelectElement).value).toBe('Meteor');
    expect((container.querySelector('#housing-register-server') as HTMLSelectElement).value).toBe('Ramuh');
    expect((container.querySelector('#housing-register-area') as HTMLSelectElement).value).toBe('LavenderBeds');
    expect((container.querySelector('#housing-register-ward') as HTMLInputElement).value).toBe('29');
    expect((container.querySelector('#housing-register-plot') as HTMLInputElement).value).toBe('3');

    // 公開範囲 (RegisterSectionVisibility の選択チップ)
    expect(screen.getByTestId('housing-register-visibility-public')).toHaveAttribute('data-selected', 'true');

    // タグ (選択済みチップとして表示される。official_cafe の JA 表記はゲーム内公式名「喫茶店」)。
    // official kind タブが既定でアクティブなため、 タグ一覧側にも同名ボタンが出るので選択チップ側に絞る)
    const selectedChips = container.querySelector('.housing-tag-picker-selected') as HTMLElement;
    expect(within(selectedChips).getByText('喫茶店')).toBeInTheDocument();
  });

  it('mode=edit では画像なしでも保存できる（canSubmit が画像要件で阻害されない）', () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    // 方式A: mode=edit は画像系 state をプリフィルしない (sourceImageUrls は listing 側にあっても
    // フォーム state には反映されない)。 それでも住所/タイトルが揃っていれば送信ボタンは
    // disabled にならないことを検証する (registerChecklist の image は required=false)。
    renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

    const submitBtn = screen.getByTestId('housing-register-confirm-submit');
    expect(submitBtn).not.toBeDisabled();
    expect(submitBtn).toHaveTextContent('保存');
  });

  it('mode=edit の主アクションで update が呼ばれ、保存後に詳細へ戻る', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    updateMock.mockResolvedValueOnce({ ok: true });

    renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

    const submitBtn = screen.getByTestId('housing-register-confirm-submit');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ title: 'テスト物件', dc: 'Meteor' }),
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(`/housing/listing/${EDITABLE_LISTING.id}`),
    );
  });

  // Task3.3a 回帰修復: 編集保存成功時のみ onSaved が initialValues.id で呼ばれる。
  it('mode=edit の保存成功時に onSaved(initialValues.id) が呼ばれる', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    updateMock.mockResolvedValueOnce({ ok: true });
    const onSaved = vi.fn();

    renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING, onSaved });

    fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('l1'));
    // navigate は onSaved の後 (詳細へ戻る) に呼ばれる
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(`/housing/listing/${EDITABLE_LISTING.id}`),
    );
  });

  it('mode=edit の保存が失敗 (ok=false) なら onSaved は呼ばれない', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    updateMock.mockResolvedValueOnce({ ok: false, error: 'generic' });
    const onSaved = vi.fn();

    renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING, onSaved });

    fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    // 失敗パスでは navigate も onSaved も呼ばれない
    expect(onSaved).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalledWith(`/housing/listing/${EDITABLE_LISTING.id}`);
  });

  // 「入力途中を復元しました」が空ドラフトで誤発火するバグの回帰テスト (2026-07-13)。
  // 空文字タイトル/コメント + 既定 public + publishUntil null だけの下書きは「何も入力していない」
  // ので、保存も復元通知もしてはいけない (hasMeaningfulDraft で判定)。
  describe('オートセーブ復元通知 (空ドラフト誤発火の回帰)', () => {
    it('空・初期値だけの下書きでは復元通知を出さない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({ title: '', description: '', tags: [], visibility: 'public', publishUntil: null }),
      );
      renderPage();
      expect(screen.getByTestId('housing-register-form-root')).toBeInTheDocument();
      expect(screen.queryByTestId('housing-register-autosave-notice')).not.toBeInTheDocument();
    });

    it('意味のある下書き (タイトル入力) では復元通知を出す', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ title: 'カフェ' }));
      renderPage();
      expect(screen.getByTestId('housing-register-autosave-notice')).toBeInTheDocument();
    });
  });

  // Task5 (計画: 住所登録なし一時ツアー・spec §4.3): 「この家を登録する」からの一回限りプリフィル。
  describe('registerPrefill: 一時ツアーからの一回限りプリフィル (Task5)', () => {
    beforeEach(() => {
      window.sessionStorage.clear();
    });

    it('mode=create で prefill があると住所が入っている', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // postUrl は含めない (RegisterSectionMedia の実 SNS 再取得が走ってしまうため、
      // ここでは住所プリフィルの検証に絞る — postUrl の配線は registerPrefill.test.ts / 目視で確認済み)。
      saveRegisterPrefill({
        area: 'LavenderBeds',
        ward: 29,
        buildingType: 'house',
        plot: 3,
        size: 'L',
      });

      const { container } = renderPage();

      expect((container.querySelector('#housing-register-area') as HTMLSelectElement).value).toBe(
        'LavenderBeds',
      );
      expect((container.querySelector('#housing-register-ward') as HTMLInputElement).value).toBe('29');
      expect((container.querySelector('#housing-register-plot') as HTMLInputElement).value).toBe('3');
      // 一回限り: マウント時に消費済みで、もう一度読んでも null。
      expect(consumeRegisterPrefill()).toBeNull();
    });

    it('mode=edit では prefill を消費しない (create モード限定)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      saveRegisterPrefill({ area: 'Mist', ward: 1, buildingType: 'house', plot: 1 });

      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      // edit では消費されないので、まだ sessionStorage に残っている (= 未消費)。
      expect(consumeRegisterPrefill()).not.toBeNull();
    });
  });

});
