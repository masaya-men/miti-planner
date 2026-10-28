// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
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

// create パス (performRegister) の API を spy するため実モジュールを名前空間 import する
// (module 全体 mock は他 export を壊すため spyOn で個別に差し替える)。
import * as housingApiClient from '../../../../lib/housingApiClient';
import { AUTOSAVE_KEY } from '../../../../lib/housing/registerAutosave';
import { SAVED_IMAGES_LIMIT } from '../../register/HousingRegisterImageField';
import { EDITABLE_LISTING, renderPage, ensureUploadExpanded, attachImage, attachImages, initTestI18n } from './registerPageTestSetup';

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

  describe('LoPo 公式 X 紹介トグル (allowPromoTweet・2026-09-01)', () => {
    const seedPublicDraft = () => {
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({
          title: '新規物件', dc: 'Meteor', server: 'Ramuh', area: 'LavenderBeds',
          ward: 29, buildingType: 'house', plot: 3, size: 'L', visibility: 'public',
        }),
      );
    };

    const submitAndGetDraft = async (registerSpy: any, container: HTMLElement) => {
      await attachImage(container);
      fireEvent.click(await screen.findByTestId('housing-register-confirm-address-btn'));
      const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      fireEvent.click(submitBtn);
      await waitFor(() => expect(registerSpy).toHaveBeenCalled());
      return registerSpy.mock.calls[0][0];
    };

    it('既定 ON: registerListing に allowPromoTweet:true が渡る', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      seedPublicDraft();
      vi.spyOn(housingApiClient, 'canRegister').mockResolvedValue({ remaining: 5 } as any);
      vi.spyOn(housingApiClient, 'checkDuplicate').mockResolvedValue({ duplicates: [], privateMatchCount: 0 } as any);
      const registerSpy = vi.spyOn(housingApiClient, 'registerListing').mockResolvedValue({ id: 'n1' } as any);

      const { container } = renderPage();
      expect(screen.getByTestId('housing-register-promo-toggle')).toBeChecked();
      const draft = await submitAndGetDraft(registerSpy, container);
      expect(draft.allowPromoTweet).toBe(true);

      vi.restoreAllMocks();
      window.localStorage.removeItem(AUTOSAVE_KEY);
    });

    it('トグルを OFF にすると registerListing に allowPromoTweet:false が渡る', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      seedPublicDraft();
      vi.spyOn(housingApiClient, 'canRegister').mockResolvedValue({ remaining: 5 } as any);
      vi.spyOn(housingApiClient, 'checkDuplicate').mockResolvedValue({ duplicates: [], privateMatchCount: 0 } as any);
      const registerSpy = vi.spyOn(housingApiClient, 'registerListing').mockResolvedValue({ id: 'n1' } as any);

      const { container } = renderPage();
      fireEvent.click(screen.getByTestId('housing-register-promo-toggle'));
      const draft = await submitAndGetDraft(registerSpy, container);
      expect(draft.allowPromoTweet).toBe(false);

      vi.restoreAllMocks();
      window.localStorage.removeItem(AUTOSAVE_KEY);
    });

    it('住所非公開を選ぶとトグルは消える', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      seedPublicDraft();
      vi.spyOn(housingApiClient, 'canRegister').mockResolvedValue({ remaining: 5 } as any);
      renderPage();
      expect(screen.getByTestId('housing-register-promo-toggle')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('housing-register-visibility-unlisted'));
      expect(screen.queryByTestId('housing-register-promo-toggle')).not.toBeInTheDocument();
      vi.restoreAllMocks();
      window.localStorage.removeItem(AUTOSAVE_KEY);
    });

    it('mode=edit ではトグルを出さない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: { ...EDITABLE_LISTING, visibility: 'public' } as any });
      expect(screen.queryByTestId('housing-register-promo-toggle')).not.toBeInTheDocument();
      vi.restoreAllMocks();
    });
  });

  // 2026-07-20 実ユーザー報告(9枚登録→1枚しか表示されない)の回帰テスト。
  // HousingRegisterImageField は登録時の保存上限 SAVED_IMAGES_LIMIT (4) 枚を
  // ピッカー自体の選択上限としており、12枚選んで先頭4枚だけ保存するような
  // 二段構えの UI や「使用」バッジは存在しない (常に選んだ枚がそのまま保存対象)。
  // performRegister の uploadListingThumbnail が選択された画像を正確にアップロード
  // していることを検証する。
  it('mode=create: 4枚の画像を選ぶと、 uploadListingThumbnail は全て (SAVED_IMAGES_LIMIT 枚) 呼ばれる', async () => {
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
    const canRegisterSpy = vi
      .spyOn(housingApiClient, 'canRegister')
      .mockResolvedValue({ remaining: 5 } as any);
    const checkDuplicateSpy = vi
      .spyOn(housingApiClient, 'checkDuplicate')
      .mockResolvedValue({ duplicates: [], privateMatchCount: 0 } as any);
    const registerSpy = vi
      .spyOn(housingApiClient, 'registerListing')
      .mockResolvedValue({ id: 'new1' } as any);
    const uploadSpy = vi
      .spyOn(housingApiClient, 'uploadListingThumbnail')
      .mockResolvedValue({ success: true, thumbnailPath: 'https://x/main-0.webp' });

    const { container } = renderPage();

    ensureUploadExpanded(container);
    const input = container.querySelector('.housing-register-image-input') as HTMLInputElement;
    const files = Array.from({ length: SAVED_IMAGES_LIMIT }, (_, i) => new File(['x'], `photo${i}.png`, { type: 'image/png' }));
    fireEvent.change(input, { target: { files } });
    await waitFor(() =>
      expect(container.querySelectorAll('.housing-register-image-tile').length).toBe(SAVED_IMAGES_LIMIT),
    );

    const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
    fireEvent.click(addressGateBtn);

    const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    await waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(SAVED_IMAGES_LIMIT));

    const calledIndices = uploadSpy.mock.calls
      .map(([arg]) => (arg as { index?: number }).index)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(calledIndices).toEqual([0, 1, 2, 3]);

    canRegisterSpy.mockRestore();
    checkDuplicateSpy.mockRestore();
    registerSpy.mockRestore();
    uploadSpy.mockRestore();
    window.localStorage.removeItem(AUTOSAVE_KEY);
  });

  it('mode=create: 画像ピッカーは4枚で上限に達し、追加エリアが消える', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    const { container } = renderPage();

    await attachImages(container, SAVED_IMAGES_LIMIT);

    expect(container.querySelectorAll('.housing-register-image-tile').length).toBe(
      SAVED_IMAGES_LIMIT,
    );
    expect(container.querySelector('.housing-register-image-input')).toBeNull();
  });

  it('mode=create: 残り枚数を超えてまとめて選ぶと確認モーダルが出て先頭4枚だけ追加される', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    const { container } = renderPage();

    await attachImages(container, 6);

    expect(container.querySelectorAll('.housing-register-image-tile').length).toBe(
      SAVED_IMAGES_LIMIT,
    );
    const modal = await screen.findByText(
      i18n.t('housing.register.image.limitModal.body', { selected: 6, max: SAVED_IMAGES_LIMIT }),
    );
    expect(modal).not.toBeNull();

    const confirmBtn = screen.getByRole('button', {
      name: i18n.t('housing.register.image.limitModal.confirm'),
    });
    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(
        screen.queryByText(
          i18n.t('housing.register.image.limitModal.body', { selected: 6, max: SAVED_IMAGES_LIMIT }),
        ),
      ).toBeNull(),
    );
  });

  it('mode=create: 上限ぴったりの枚数を選んだ場合は確認モーダルを出さない', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    const { container } = renderPage();

    await attachImages(container, SAVED_IMAGES_LIMIT);

    expect(container.querySelector('.housing-register-image-limit-modal-body')).toBeNull();
  });

  // Plan B (2026-07-21): 方式A撤廃により edit も写真ステップを含む (旧 Task3.4-1 の逆)。
  describe('ステッパー: mode=edit も写真ステップを含む (Plan B)', () => {
    it('mode=edit でもステッパーに写真ステップが出て、5 ステップになる', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const nav = screen.getByRole('navigation', { name: '登録ステップ' });
      expect(within(nav).getByText('SNS投稿・サイトから自動入力')).toBeInTheDocument();
      expect(within(nav).getAllByRole('button')).toHaveLength(5);
      expect(within(nav).getByTestId('housing-register-step-1')).toHaveTextContent('SNS投稿・サイトから自動入力');
    });

    it('mode=create ではステッパーに写真ステップを含む 5 ステップを出す (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const nav = screen.getByRole('navigation', { name: '登録ステップ' });
      expect(within(nav).getAllByRole('button')).toHaveLength(5);
      expect(within(nav).getByTestId('housing-register-step-1')).toHaveTextContent('SNS投稿・サイトから自動入力');
    });
  });

  // I 根治: 編集モードでは自分の doc が必ずヒットして誤「重複」になるため、ライブ重複照会
  // パネルを出さない (ライブ照会 effect 側も mode==='edit' で走らせない)。create は不変。
  describe('重複照会パネル: mode=edit は出さない (I 根治)', () => {
    it('mode=edit では右カラムに重複照会パネルが出ない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(screen.queryByTestId('housing-register-dup-panel')).not.toBeInTheDocument();
    });

    it('mode=create では重複照会パネルが出る (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();
      expect(screen.getByTestId('housing-register-dup-panel')).toBeInTheDocument();
    });
  });

  // Plan B (2026-07-21): 方式A撤廃により edit も CheckPanel に画像行を出す (推奨行のまま)。
  describe('CheckPanel: mode=edit も画像行を出す (Plan B)', () => {
    it('mode=edit でも CheckPanel に画像行が出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const panel = screen.getByTestId('housing-register-check-panel');
      expect(within(panel).getByTestId('housing-register-check-image')).toBeInTheDocument();
      expect(within(panel).getByTestId('housing-register-check-address')).toBeInTheDocument();
      expect(within(panel).getByTestId('housing-register-check-title')).toBeInTheDocument();
    });

    it('mode=create では CheckPanel に画像行が出る (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const panel = screen.getByTestId('housing-register-check-panel');
      expect(within(panel).getByTestId('housing-register-check-image')).toBeInTheDocument();
    });
  });

});
