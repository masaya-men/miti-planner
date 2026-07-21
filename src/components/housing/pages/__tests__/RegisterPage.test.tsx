// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
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

import { RegisterPage } from '../RegisterPage';
// create パス (performRegister) の API を spy するため実モジュールを名前空間 import する
// (module 全体 mock は他 export を壊すため spyOn で個別に差し替える)。
import * as housingApiClient from '../../../../lib/housingApiClient';
// 複数URL集約 (Batch2) の重複検出テスト用: showToast 呼び出しを spy する
// (housingApiClient と同じ「実モジュールを名前空間 import → vi.spyOn」方式)。
import * as ToastModule from '../../../Toast';
import { AUTOSAVE_KEY } from '../../../../lib/housing/registerAutosave';
import { saveRegisterPrefill, consumeRegisterPrefill } from '../../../../lib/housing/registerPrefill';
import { SAVED_IMAGES_LIMIT } from '../../register/HousingRegisterImageField';

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

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPage(props?: {
  mode?: 'create' | 'edit';
  initialValues?: HousingListing;
  onSaved?: (listingId: string) => void | Promise<unknown>;
}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <RegisterPage
          mode={props?.mode}
          initialValues={props?.initialValues}
          onSaved={props?.onSaved}
        />
      </MemoryRouter>
    </I18nextProvider>
  );
}

// Batch2 (Task7): 直接アップロード欄は既定で折りたたまれている。
// 「画像をアップロードして登録する」トグルがまだ展開されていなければ先に押して入力欄を出す。
function ensureUploadExpanded(container: HTMLElement) {
  const toggle = container.querySelector(
    '[data-testid="housing-register-toggle-upload"]',
  ) as HTMLButtonElement | null;
  if (toggle) {
    fireEvent.click(toggle);
  }
}

// 画像必須 (mode=create) のテスト用: ローカル画像を 1 枚追加して canSubmit を満たす。
// 圧縮は vi.mock で同期スタブ化済み。タイルが出るまで待って反映を保証する。
async function attachImage(container: HTMLElement) {
  ensureUploadExpanded(container);
  const input = container.querySelector('.housing-register-image-input') as HTMLInputElement;
  const file = new File(['x'], 'photo.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect(container.querySelector('.housing-register-image-tile')).not.toBeNull(),
  );
}

// 複数枚まとめて添付するヘルパー
async function attachImages(container: HTMLElement, count: number) {
  ensureUploadExpanded(container);
  const input = container.querySelector('.housing-register-image-input') as HTMLInputElement;
  const files = Array.from({ length: count }, (_, i) => new File(['x'], `photo${i}.png`, { type: 'image/png' }));
  fireEvent.change(input, { target: { files } });
  await waitFor(() =>
    expect(container.querySelectorAll('.housing-register-image-tile').length).toBeGreaterThan(0),
  );
}

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

  // 2026-07-20 実ユーザー報告の回帰テスト:「最初に登録した物件を編集すると、別の物件の
  // データになってしまい編集できない」。根因は2つ: ①オートセーブ (新規登録の下書き復旧)
  // が mode を問わず動作しており、以前どこかで保存された無関係な下書きが編集フォームへ
  // 無条件で上書き適用されていた ②HousingEditPage が RegisterPage を key 無しで描画しており
  // (App.tsx の Route も同様)、別 listingId の編集へ遷移してもコンポーネントが再マウントされず、
  // 一度きりの useState 初期化 (initialValues 由来) が古い物件の値のまま残っていた。
  describe('編集ページの物件取り違えバグ回帰 (2026-07-20)', () => {
    it('mode=edit は localStorage に残った別物件/新規登録の下書きを復元しない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // 「以前どこかで保存された無関係な下書き」を模す (別物件の編集中 or 新規登録の入力中)。
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({ title: '別の物件のタイトル', dc: 'Chaos', tags: ['event_seasonal'] }),
      );

      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      // 表示されるのはあくまで initialValues (サーバーの現在値) であり、下書きの内容ではない。
      expect((screen.getByTestId('housing-register-title-input') as HTMLInputElement).value).toBe(
        'テスト物件',
      );
      expect((container.querySelector('#housing-register-dc') as HTMLSelectElement).value).toBe(
        'Meteor',
      );
    });

    it('mode=edit: 別物件の下書きが残っていても保存内容は initialValues 由来のまま (取り違え防止)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      updateMock.mockResolvedValueOnce({ ok: true });
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({ title: '別の物件のタイトル', dc: 'Chaos' }),
      );

      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));

      await waitFor(() => expect(updateMock).toHaveBeenCalled());
      expect(updateMock).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({ title: 'テスト物件', dc: 'Meteor' }),
      );
    });

    it('key={listingId} で再マウントすると、前に編集していた別物件のフォーム内容が残らない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const listingA = {
        ...EDITABLE_LISTING,
        id: 'lidA',
        title: '物件A',
        dc: 'Meteor',
      } as HousingListing;
      const listingB = {
        ...EDITABLE_LISTING,
        id: 'lidB',
        title: '物件B',
        dc: 'Chaos',
        server: 'Cerberus',
      } as HousingListing;

      const { rerender, container } = render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage key={listingA.id} mode="edit" initialValues={listingA} />
          </MemoryRouter>
        </I18nextProvider>,
      );
      expect((screen.getByTestId('housing-register-title-input') as HTMLInputElement).value).toBe(
        '物件A',
      );

      // HousingEditPage が実際に行う遷移を模す: 別 listingId への navigate で
      // initialValues が変わり、key (= listingId) も追従して変わる。
      rerender(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage key={listingB.id} mode="edit" initialValues={listingB} />
          </MemoryRouter>
        </I18nextProvider>,
      );

      // key が変わったことで RegisterPage は完全に再マウントされ、物件Bの内容だけが表示される。
      expect((screen.getByTestId('housing-register-title-input') as HTMLInputElement).value).toBe(
        '物件B',
      );
      expect((container.querySelector('#housing-register-dc') as HTMLSelectElement).value).toBe(
        'Chaos',
      );
    });
  });

  // Task3.3a 回帰修復: create パス (performRegister) は onSaved を呼ばない (create 挙動不変)。
  // オートセーブ復元で create フォームを valid 状態にし、実 register を spy して検証する。
  it('mode=create の登録成功では onSaved は呼ばれない', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    // 復元でフォームを埋めて canSubmit=true にする (EDITABLE_LISTING と同じ有効な住所)。
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
    const onSaved = vi.fn();

    // mode 省略 = create (既定)。
    const { container } = renderPage({ onSaved });

    // 画像必須 (mode=create): 復元では画像は戻らないので 1 枚追加してから確認・送信する。
    await attachImage(container);

    // 住所確認ゲート (C案・2026-07-10): オートセーブ復元の住所は未確認扱いのため、
    // 送信可能になる前に確認ボタンを押す必要がある。
    const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
    fireEvent.click(addressGateBtn);

    const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/housing/listing/new1'));
    // create パスは onSaved を配線しない
    expect(onSaved).not.toHaveBeenCalled();

    canRegisterSpy.mockRestore();
    checkDuplicateSpy.mockRestore();
    registerSpy.mockRestore();
    window.localStorage.removeItem(AUTOSAVE_KEY);
  });

  // ② 確認&公開ボタン上の住所をフル住所化 (2026-07-13 round2 A-3)。
  it('mode=create: 住所が揃うとリージョン/DC/ワールドを含むフル住所が確認セクションに出る (A-3)', () => {
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

    const { container } = renderPage();

    // Meteor は JP リージョン (dcServerMap.ts)。A-3 以前は住所行が街区住所のみ
    // ("ラベンダーベッド 29-3") だったが、formatFullHousingAddress 化で
    // リージョン/DC/ワールドを含むフル住所になる。2026-07-15 の UI 調整で住所は確認セクションの
    // 主役ブロックに 1 回だけ大きく表示するようになった (旧: ゲート + 要約 dl の二重表示)。
    const gateAddress = container.querySelector('.housing-register-confirm-address-value');
    expect(gateAddress?.textContent).toBe('日本 / Meteor / Ramuh / ラベンダーベッド 29-3');

    window.localStorage.removeItem(AUTOSAVE_KEY);
  });

  // c: 登録後に探すへ即反映 (Firestore 読み取り0) (2026-07-13 round2 A-5)。
  it('mode=create: 登録成功時、ローカル view-model で upsert され、fetchAndUpsert/loadMine は呼ばれない (A-5)', async () => {
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
    const upsertSpy = vi.spyOn(useHousingListingsStore.getState(), 'upsert');
    const fetchAndUpsertSpy = vi.spyOn(useHousingListingsStore.getState(), 'fetchAndUpsert');
    const loadMineSpy = vi.spyOn(useHousingListingsStore.getState(), 'loadMine');

    const { container } = renderPage();

    // 画像必須 (mode=create): 復元では画像は戻らないので 1 枚追加してから確認・送信する。
    await attachImage(container);

    const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
    fireEvent.click(addressGateBtn);

    const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    await waitFor(() => expect(upsertSpy).toHaveBeenCalledTimes(1));

    // ローカル view-model の主要フィールドを確認 (Firestore 読み取り無しで組み立てられたもの)。
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new1',
        ownerUid: 'me',
        dc: 'Meteor',
        server: 'Ramuh',
        region: 'JP',
        area: 'LavenderBeds',
        ward: 29,
        buildingType: 'house',
        plot: 3,
        visibility: 'public',
        title: '新規物件',
      }),
    );

    // 追加の Firestore 読み取り (getDoc 1件 + getMyListings 最大200件) が発生しないことを固定する。
    expect(fetchAndUpsertSpy).not.toHaveBeenCalled();
    expect(loadMineSpy).not.toHaveBeenCalled();

    canRegisterSpy.mockRestore();
    checkDuplicateSpy.mockRestore();
    registerSpy.mockRestore();
    upsertSpy.mockRestore();
    fetchAndUpsertSpy.mockRestore();
    loadMineSpy.mockRestore();
    window.localStorage.removeItem(AUTOSAVE_KEY);
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

  // Plan B (2026-07-21): Task1 で imageCount 算出に editThumbnailPaths を含めたため、
  // edit でも正しい枚数を要約できるようになった (方式A時代の「常に0枚」誤表示は解消)。
  describe('確認セクション: mode=edit も画像枚数の要約行を出す (Plan B)', () => {
    it('mode=edit でも確認セクションに画像枚数の行が出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).getByText('SNS投稿・サイトから自動入力')).toBeInTheDocument();
      // EDITABLE_LISTING は sourceImageUrls を1件持つ (Task1で stillCount に反映済み)。
      // ラベルの存在だけでなく実際の枚数値も検証し、imageCount 計算の退行を検知できるようにする。
      expect(within(section).getByText('1 枚')).toBeInTheDocument();
    });

    it('mode=create では確認セクションに画像枚数の行が出る (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).getByText('SNS投稿・サイトから自動入力')).toBeInTheDocument();
    });
  });

  // Task3.4-4: onSaved (resolveReport) を fetchAndUpsert より前に呼ぶ (unhide 後の store 再取得を保証)。
  it('mode=edit の保存成功時、 onSaved が fetchAndUpsert より先に呼ばれる (Task3.4-4)', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    updateMock.mockResolvedValueOnce({ ok: true });

    const callOrder: string[] = [];
    const fetchAndUpsertSpy = vi
      .spyOn(useHousingListingsStore.getState(), 'fetchAndUpsert')
      .mockImplementation(async () => {
        callOrder.push('fetchAndUpsert');
      });
    const onSaved = vi.fn(async () => {
      callOrder.push('onSaved');
    });

    renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING, onSaved });
    fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));

    await waitFor(() => expect(fetchAndUpsertSpy).toHaveBeenCalled());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(callOrder).toEqual(['onSaved', 'fetchAndUpsert']);

    fetchAndUpsertSpy.mockRestore();
  });

  /**
   * commitEditSnsFetch (編集ページ「投稿URLを追加する」commit) の回帰テスト
   * (最終レビュー Critical/Important fix・2026-07-21 → Batch2・2026-07-22 で
   * 「貼り替え=全差し替え」から「追加 (既存+新規の累積)」へ仕様変更したことに伴い
   * シナリオ/期待値を書き換え)。
   *
   * バグ1 (Critical・維持): `payload = { ...buildDraft(), ...freshImageFields }` は
   * 「buildDraft() 側の画像フィールドは常に空 = {}」という前提だったが、この関数は
   * 成功時に setSnsCapture(capture) を呼ぶため、2回目以降の呼び出し時点では
   * snsCapture (延いては buildDraft() の画像フィールド) が前回貼り付けた古いSNSデータ
   * を保持している。freshImageFields に無いキーは buildDraft() 側の古い値がスプレッドで
   * 生き残ってサーバーに送信されてしまう。修正 (buildDraft() の画像フィールドを明示的に
   * 除去してからマージする) はBatch2でも変更していないため、引き続き機能する。
   *
   * バグ2 (Important・仕様変更で意味が反転): 旧仕様 (貼り替え) では「動画付き→動画なし」
   * で動画プレビューが消えるのが正しい挙動だった。Batch2 (追加方式) では逆に、動画を
   * 一度確立したら動画を含まない後続URLを貼ってもプレビューが消えてはいけない
   * (貼り替えではなく追加なので、動画を明示的に取り除く操作をしていない限り維持する)。
   *
   * HousingEditSourcePanel (実物・モックしない) 経由で URL 欄を操作し、
   * useTweetFetch をモックして「取得成功」を模擬することで、commitEditSnsFetch を
   * RegisterPage の外部から間接的に駆動する。
   */
  describe('編集ページ URL追加: commitEditSnsFetch の回帰 (Batch2・2026-07-22)', () => {
    const TWEET_URL_A = 'https://x.com/user/status/1842217368673759498';
    const TWEET_URL_C = 'https://x.com/user/status/1842217368673759499';

    // ツイートA: 動画付き (写真なし)
    const tweetDataVideoA = {
      text: 'A',
      author: { name: 'A', screen_name: 'a' },
      photos: [],
      video: {
        url: 'https://video.twimg.com/ext_tw_video/A.mp4',
        posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/posterA.jpg',
        aspectRatio: 1.5,
      },
    };

    // ツイートC: 写真だけ (動画なし)
    const tweetDataPhotosC = {
      text: 'C',
      author: { name: 'C', screen_name: 'c' },
      photos: ['https://pbs.twimg.com/c1.jpg', 'https://pbs.twimg.com/c2.jpg'],
      video: null,
    };

    function editTree() {
      return (
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage mode="edit" initialValues={EDITABLE_LISTING} />
          </MemoryRouter>
        </I18nextProvider>
      );
    }

    it('動画付きツイートA→写真だけのツイートCの順で貼ると、Aの動画を保持したままCの写真が既存画像に追記される', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      updateMock.mockResolvedValue({ ok: true });
      const { rerender } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1回目: 動画付きツイートAを貼る
      fireEvent.change(input, { target: { value: TWEET_URL_A } });
      tweetState = { ...tweetState, status: 'success', data: tweetDataVideoA };
      rerender(editTree());

      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
      expect(updateMock.mock.calls[0][1]).toEqual(
        expect.objectContaining({ videoUrl: tweetDataVideoA.video.url }),
      );

      // バグ2 回帰確認: 動画プレビューが反映される
      await waitFor(() => {
        const preview = screen.getByTestId('housing-register-media-video');
        expect(preview.querySelector('img')?.getAttribute('src')).toBe(
          tweetDataVideoA.video.posterUrl,
        );
      });

      // 2回目: 写真だけのツイートCを追加で貼る (Batch2: 貼り替えではなく追加)。
      fireEvent.change(input, { target: { value: TWEET_URL_C } });
      tweetState = { ...tweetState, status: 'success', data: tweetDataPhotosC };
      rerender(editTree());

      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(2));
      const secondPayload = updateMock.mock.calls[1][1];

      // Batch2 の核心: 追加方式なので、Cの写真は「貼り替え」ではなくEDITABLE_LISTINGの既存
      // sourceImageUrls (['https://x/a.jpg']) に追記される。かつ、Aで確立した動画は
      // (Cが動画を持たないからといって) 消えず維持される (バグ1の除去ロジックとは別に、
      // capture 自体が意図的に前の動画を引き継ぐ設計)。
      expect(secondPayload.videoUrl).toBe(tweetDataVideoA.video.url);
      expect(secondPayload.videoPosterUrl).toBe(tweetDataVideoA.video.posterUrl);
      expect(secondPayload.videoAspectRatio).toBe(tweetDataVideoA.video.aspectRatio);
      expect(secondPayload.sourceImageUrls).toEqual([
        'https://x/a.jpg',
        ...tweetDataPhotosC.photos,
      ]);
      // 代表 (tweetId) は最初に確立したURL (A) のまま維持される (RegisterPage.tsx
      // handleTweetFetched と同じ「代表は最初の1件が正」設計)。
      expect(secondPayload.tweetId).toBe('1842217368673759498');
      // sourcePostUrls には両方のURLが記録され、重複扱いにならない。
      expect(secondPayload.sourcePostUrls).toEqual([TWEET_URL_A, TWEET_URL_C]);

      // バグ2 回帰確認 (仕様反転): 追加方式なので動画なしツイートを追加しても
      // 動画プレビューは消えずそのまま残る。
      await waitFor(() => {
        const preview = screen.getByTestId('housing-register-media-video');
        expect(preview.querySelector('img')?.getAttribute('src')).toBe(
          tweetDataVideoA.video.posterUrl,
        );
      });
    });
  });

  /**
   * size は (エリア × 区画) から一意に決まるので手入力させない (2026-07-10)。
   * RegisterPage の導出 effect が唯一の書き込み口で、UI 側は読み取り専用表示 (Task3-1: 旧
   * disabled <select> はドロップダウン矢印が見えてしまうため disabled <input> に置換済み)。
   * 表示は housingSizeMasterData のラベル (例 'L' → 'Lハウス')。
   * 参照表 = src/data/housing/wardPlotSizes.ts (LavenderBeds: plot1=M / plot3=L / plot29=S)。
   */
  describe('size は区画から自動導出され手入力できない', () => {
    const sizeField = (container: HTMLElement) =>
      container.querySelector('#housing-register-size') as HTMLInputElement;

    it('size 欄は disabled (手入力を受け付けない読み取り専用表示)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeField(container).disabled).toBe(true);
    });

    it('mode=edit のプリフィルで区画由来の size が入り、auto-filled バッジが出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // LavenderBeds plot 3 = L (listing の size も L で一致)
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeField(container).value).toBe('Lハウス');
      // fieldState が 'auto-filled' でないと requiredFields('size') が empty のまま送信できない
      expect(screen.getByTestId('housing-auto-badge-size')).toBeInTheDocument();
    });

    it('保存済みデータの size が区画と食い違っていても、開いた時点で区画側に訂正される', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // LavenderBeds plot 29 の実サイズは S。listing には誤った 'L' が入っている。
      const wrong = { ...EDITABLE_LISTING, plot: 29, size: 'L' } as unknown as HousingListing;
      const { container } = renderPage({ mode: 'edit', initialValues: wrong });
      expect(sizeField(container).value).toBe('Sハウス');
    });

    it('mode=create で エリアと区画を入れると size が自動で入る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();

      // 建物タイプ (個人宅) を選ぶまで番地/サイズ欄は出ない → 先に選ぶ。
      fireEvent.click(
        within(container.querySelectorAll('[role="radiogroup"]')[0] as HTMLElement).getByRole(
          'radio',
          { name: '個人宅・FCハウス' },
        ),
      );

      // 区画だけではエリアが決まらないので size は空のまま
      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '1' } });
      expect(sizeField(container).value).toBe('');

      // エリアが入った瞬間に導出される (LavenderBeds plot 1 = M)
      fireEvent.change(container.querySelector('#housing-register-area')!, {
        target: { value: 'LavenderBeds' },
      });
      expect(sizeField(container).value).toBe('Mハウス');

      // 区画を変えれば追従する (plot 3 = L)
      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '3' } });
      expect(sizeField(container).value).toBe('Lハウス');
    });

    it('区画が範囲外なら size は空に戻る (古い値が残らない)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeField(container).value).toBe('Lハウス');

      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '61' } });
      expect(sizeField(container).value).toBe('');
    });

    it('アパートに切り替えると size 欄ごと消える (apartment は size を持てない)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeField(container)).not.toBeNull();

      fireEvent.click(screen.getByRole('radio', { name: 'アパルトメント' }));
      expect(sizeField(container)).toBeNull();
    });
  });

  // FCハウスの個室トグル (2026-07-15): 部屋区分の 2 択チップを廃し、「FCハウスの個室ですか?」の
  // オンオフ 1 つに。default=オフ=家全体。オンで部屋番号欄が出る (roomKind=private_chamber)。
  describe('FCハウスの個室トグル', () => {
    const clickHouse = (container: HTMLElement) =>
      fireEvent.click(
        within(container.querySelectorAll('[role="radiogroup"]')[0] as HTMLElement).getByRole(
          'radio',
          { name: '個人宅・FCハウス' },
        ),
      );

    it('個人宅を選んだ直後は個室オフ = 部屋番号欄が出ない (default=家全体)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      clickHouse(container);
      expect(container.querySelector('#housing-register-room-number')).toBeNull();
    });

    it('個室トグルをオンにすると部屋番号欄が出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      clickHouse(container);
      fireEvent.click(screen.getByTestId('housing-register-room-chamber-toggle'));
      expect(container.querySelector('#housing-register-room-number')).not.toBeNull();
    });

    it('個室オン→オフに戻すと部屋番号欄が消える', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      clickHouse(container);
      const toggle = screen.getByTestId('housing-register-room-chamber-toggle');
      fireEvent.click(toggle);
      expect(container.querySelector('#housing-register-room-number')).not.toBeNull();
      fireEvent.click(toggle);
      expect(container.querySelector('#housing-register-room-number')).toBeNull();
    });
  });

  // Task1: 住所確認ゲート (C案・2026-07-10)。フォーム値から組み立てた住所文を確認セクションに
  // 提示し、「この住所で間違いありません」を押すまで送信できない。
  describe('住所確認ゲート (C案・2026-07-10)', () => {
    // buildingType の「家」チップと roomKind (家全体) チップが同じラベルを共有しているため
    // (Task3 で解消予定)、role=radiogroup の先頭 (buildingType) を明示的に絞って操作する。
    const clickHouseChip = (container: HTMLElement) => {
      const radiogroups = container.querySelectorAll('[role="radiogroup"]');
      fireEvent.click(within(radiogroups[0] as HTMLElement).getByRole('radio', { name: '個人宅・FCハウス' }));
    };

    const fillValidAddress = async (container: HTMLElement) => {
      clickHouseChip(container);
      fireEvent.change(container.querySelector('#housing-register-dc')!, { target: { value: 'Meteor' } });
      fireEvent.change(container.querySelector('#housing-register-server')!, { target: { value: 'Ramuh' } });
      fireEvent.change(container.querySelector('#housing-register-area')!, {
        target: { value: 'LavenderBeds' },
      });
      fireEvent.change(container.querySelector('#housing-register-ward')!, { target: { value: '29' } });
      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '3' } });
      // 画像必須 (mode=create): 送信可否は「住所確認 + 画像」で決まるので 1 枚用意しておく。
      await attachImage(container);
    };

    it('mode=create: 住所が妥当でも確認ボタンを押すまで送信不可・不足アクションに出る', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      await fillValidAddress(container);

      const submitBtn = screen.getByTestId('housing-register-confirm-submit');
      expect(submitBtn).toBeDisabled();
      expect(screen.getByTestId('housing-register-confirm-missing-address')).toHaveTextContent(
        '住所を確認してください',
      );

      fireEvent.click(screen.getByTestId('housing-register-confirm-address-btn'));

      expect(submitBtn).not.toBeDisabled();
      expect(screen.queryByTestId('housing-register-confirm-missing-address')).not.toBeInTheDocument();
    });

    it('確認後に住所フィールド (どれでも) を変更すると確認が解除される', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      await fillValidAddress(container);
      fireEvent.click(screen.getByTestId('housing-register-confirm-address-btn'));

      const submitBtn = screen.getByTestId('housing-register-confirm-submit');
      expect(submitBtn).not.toBeDisabled();

      fireEvent.change(container.querySelector('#housing-register-ward')!, { target: { value: '5' } });

      expect(submitBtn).toBeDisabled();
      expect(screen.getByTestId('housing-register-confirm-address-btn')).not.toBeDisabled();
    });

    it('mode=edit: 住所に触れなければ初期状態から確認済み扱い (送信可)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      expect(screen.getByTestId('housing-register-confirm-submit')).not.toBeDisabled();
      const gateBtn = screen.getByTestId('housing-register-confirm-address-btn');
      expect(gateBtn).toBeDisabled();
      expect(gateBtn).toHaveAttribute('data-confirmed', 'true');
    });

    it('mode=edit: 住所を変更すると再確認が必要になり、再確認すれば送信可に戻る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const submitBtn = screen.getByTestId('housing-register-confirm-submit');
      expect(submitBtn).not.toBeDisabled();

      fireEvent.change(container.querySelector('#housing-register-ward')!, { target: { value: '5' } });
      expect(submitBtn).toBeDisabled();

      fireEvent.click(screen.getByTestId('housing-register-confirm-address-btn'));
      expect(submitBtn).not.toBeDisabled();
    });

    it('size の自動導出 (区画由来の食い違い訂正) だけでは確認は解除されない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // LavenderBeds plot 29 の実サイズは S。listing には誤った 'L' が入っている
      // (「size は区画から自動導出され手入力できない」テストと同じフィクスチャ)。
      // 導出 effect が size を書き換えるが、住所変更とはみなさず確認は解除されない。
      const wrong = { ...EDITABLE_LISTING, plot: 29, size: 'L' } as unknown as HousingListing;
      renderPage({ mode: 'edit', initialValues: wrong });

      expect(screen.getByTestId('housing-register-confirm-submit')).not.toBeDisabled();
      expect(screen.getByTestId('housing-register-confirm-address-btn')).toHaveAttribute(
        'data-confirmed',
        'true',
      );
    });
  });

  // Task6 (Batch2): handleTweetFetched の重複URL検出回帰テスト。
  // mode=create の RegisterSectionMedia は現時点 (Task7未着手) では単一の
  // HousingRegisterSnsUrlField しか描画しないため、同じ URL 入力欄に同じ URL を
  // 2回「貼る」操作 (fireEvent.change → useTweetFetch モックを success に遷移) を繰り返すことで
  // handleTweetFetched が同じ postUrl で2回呼ばれる状況を再現する
  // (実際の複数欄UIはTask7で配線されるが、重複検出ロジック自体はどちらの経路でも同じ関数が
  // 判定するため、この駆動方法で isDuplicatePostUrl の統合を検証できる)。
  describe('RegisterPage: 複数URL集約 (Batch2)', () => {
    const TWEET_URL = 'https://x.com/user/status/1842217368673759510';

    function createTree() {
      return (
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage />
          </MemoryRouter>
        </I18nextProvider>
      );
    }

    it('同じURLを2回貼っても重複エラーになりsourcePostUrlsが増えない', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});

      const { rerender } = render(createTree());

      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: 正常に取得 (写真1枚)。
      fireEvent.change(input, { target: { value: TWEET_URL } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'D',
          author: { name: 'D', screen_name: 'd' },
          photos: ['https://pbs.twimg.com/d1.jpg'],
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

      // 2本目: 同じURLをもう一度貼る (重複) → 新しい data オブジェクトで dispatch ガードを
      // すり抜けさせつつ、postUrl は1本目と完全一致させる。
      fireEvent.change(input, { target: { value: TWEET_URL } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'D',
          author: { name: 'D', screen_name: 'd' },
          photos: ['https://pbs.twimg.com/d1.jpg'],
          video: null,
        },
      };
      rerender(createTree());

      await waitFor(() =>
        expect(showToastSpy).toHaveBeenCalledWith(
          'housing.register.snsUrl.error.duplicate_url',
          'error',
        ),
      );

      // sourcePostUrls / sourceImageUrls が二重追加されていない (画像枚数は1本目のまま)。
      expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
        i18n.t('housing.register.media.fetched_count', { count: 1 }),
      );

      showToastSpy.mockRestore();
    });

    /**
     * Bug1 回帰 (2026-07-21 レビュー指摘・Important): 写真だけのツイートが先に「代表」になった
     * 状態で、2本目のツイートに動画が付いていると、修正前は setSnsCapture の updater が
     * 常に prev (代表確定済み) をそのまま返すため、`capturedVideoRef.current` は true になり
     * (= video_limit トーストは出ず「受理」扱い) 見た目上は動画1本制限も守られたように見えるが、
     * 肝心の video データ自体は snsCapture に一切反映されず、buildDraft/registerListing の
     * ペイロードにも videoUrl 等が現れない「受理したのに消える」事故になる。
     */
    it('写真だけのツイート→動画付きツイートの順で貼ると、2本目の動画が代表のtweetDataに合流し登録データに残る (Bug1回帰)', async () => {
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
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});

      const TWEET_URL_PHOTO = 'https://x.com/user/status/1842217368673759511';
      const TWEET_URL_VIDEO = 'https://x.com/user/status/1842217368673759512';

      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: 写真だけ (動画なし) → 代表として確定する。
      fireEvent.change(input, { target: { value: TWEET_URL_PHOTO } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-only',
          author: { name: 'P', screen_name: 'p' },
          photos: ['https://pbs.twimg.com/p1.jpg'],
          video: null,
        },
      };
      rerender(createTree());
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 1 }),
        ),
      );

      // 2本目: 動画付き (写真なし)。代表は既に1本目 (tweetData) で確定済みなので、
      // 修正前はここで受理判定 (トーストなし) にはなるが動画データ自体が握りつぶされる。
      fireEvent.change(input, { target: { value: TWEET_URL_VIDEO } });
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'video-tweet',
          author: { name: 'V', screen_name: 'v' },
          photos: [],
          video: {
            url: 'https://video.twimg.com/ext_tw_video/V.mp4',
            posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/posterV.jpg',
            aspectRatio: 1.7,
          },
        },
      };
      rerender(createTree());

      // 「受理」判定であること (video_limit トーストは出ない)。
      await waitFor(() => {
        expect(screen.getByTestId('housing-register-media-video')).toBeInTheDocument();
      });
      expect(showToastSpy).not.toHaveBeenCalledWith(
        'housing.register.snsUrl.error.video_limit',
        'error',
      );

      // 実際に登録データ (registerListing 引数 = buildDraft の出力) に動画が載ることを確認する
      // (プレビュー表示だけでなく保存データそのものを検証するのが本バグの核心)。
      const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
      fireEvent.click(addressGateBtn);
      const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      fireEvent.click(submitBtn);

      await waitFor(() => expect(registerSpy).toHaveBeenCalled());
      expect(registerSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          videoUrl: 'https://video.twimg.com/ext_tw_video/V.mp4',
          videoPosterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/posterV.jpg',
          // 代表 (1本目) の静止画も維持されている (動画差し込みで代表自体が入れ替わっていない)。
          sourceImageUrls: ['https://pbs.twimg.com/p1.jpg'],
        }),
      );

      canRegisterSpy.mockRestore();
      checkDuplicateSpy.mockRestore();
      registerSpy.mockRestore();
      showToastSpy.mockRestore();
      window.localStorage.removeItem(AUTOSAVE_KEY);
    });

    /**
     * Bug3 回帰 (2026-07-21 レビュー指摘・Critical): buildDraftImageFields の Twitter 分岐は
     * `sns.tweetData.photos` のみを読み、ページ全体の集約プール (`sourceImageUrls`) は見ない
     * (並び替え UI 経由の再順序化で photoAspectRatios と index がズレるのを避けるため意図的)。
     * 代表 (1本目) が確定した後、2本目のツイート URL が持つ写真は `sourceImageUrls` には
     * 追記される (画面上の「N枚取得しました」表示は増える) のに、修正前の setSnsCapture
     * updater は代表確定済みなら常に prev をそのまま返すため tweetData.photos には合流せず、
     * 保存データから静かに消える。複数投稿URL集約という Batch2 の目玉機能 (Twitterスレッド等
     * から画像を集約) そのものが壊れていた。
     */
    it('写真付きツイート→別の写真付きツイートの順で貼ると、2本目の写真も登録データに合流する (Bug3回帰)', async () => {
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
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});

      const TWEET_URL_A = 'https://x.com/user/status/1842217368673759521';
      const TWEET_URL_B = 'https://x.com/user/status/1842217368673759522';

      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: 写真Aのみ → 代表として確定する。
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
      rerender(createTree());
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 1 }),
        ),
      );

      // 2本目: 別のツイートで写真Bのみ。代表 (1本目) は既に確定済みなので、
      // 修正前は tweetData.photos に合流せず保存データから消える。
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
      rerender(createTree());
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 2 }),
        ),
      );
      expect(showToastSpy).not.toHaveBeenCalled();

      // 実際に登録データ (registerListing 引数 = buildDraft の出力) に両方の写真が載ることを
      // 確認する (プレビュー上の枚数表示だけでなく保存データそのものを検証するのが本バグの核心)。
      const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
      fireEvent.click(addressGateBtn);
      const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      fireEvent.click(submitBtn);

      await waitFor(() => expect(registerSpy).toHaveBeenCalled());
      expect(registerSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          sourceImageUrls: ['https://pbs.twimg.com/a1.jpg', 'https://pbs.twimg.com/b1.jpg'],
        }),
      );

      canRegisterSpy.mockRestore();
      checkDuplicateSpy.mockRestore();
      registerSpy.mockRestore();
      showToastSpy.mockRestore();
      window.localStorage.removeItem(AUTOSAVE_KEY);
    });

    /**
     * Bug3 修正と同時に追加した安全側ガード: 代表がツイート (tweetData) で確定した後に
     * OGP URL の写真を貼っても、pbs.twimg.com 以外の任意ホストの画像を tweetData.photos に
     * 混ぜると validateImage の host 制約 (housingValidation.ts:413、tweetId 併用時は
     * sourceImageUrls の全 URL が pbs.twimg.com 限定) に違反し、登録全体が invalid_url で
     * 失敗する (「一部の写真が消える」より悪い「全部保存できない」regression)。そのため
     * この組み合わせはマージせず拒否トーストを出し、集約プール (sourceImageUrls) にも
     * 追加しない (見た目の「N枚」表示が実際に保存されない画像を含んで嘘をつくのを防ぐ)。
     */
    it('代表がツイートで確定した後にOGP画像を貼るとマージされず拒否トーストが出る (host混在防止・Bug3関連)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});

      const TWEET_URL = 'https://x.com/user/status/1842217368673759531';
      const OGP_URL = 'https://housingsnap.com/98765';

      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: ツイートの写真A → 代表として確定する。
      fireEvent.change(input, { target: { value: TWEET_URL } });
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
      rerender(createTree());
      await waitFor(() =>
        expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
          i18n.t('housing.register.media.fetched_count', { count: 1 }),
        ),
      );

      // 2本目: OGP URL の写真B。代表は既にツイートで確定済みなので拒否されるはず。
      fireEvent.change(input, { target: { value: OGP_URL } });
      ogpState = {
        ...ogpState,
        status: 'success',
        data: {
          image: 'https://housingsnap.com/img/b1.jpg',
          images: ['https://housingsnap.com/img/b1.jpg'],
          title: 't',
          description: 'd',
          siteName: 'housingsnap',
          text: 'text',
        },
      };
      rerender(createTree());

      await waitFor(() =>
        expect(showToastSpy).toHaveBeenCalledWith(
          i18n.t('housing.register.snsUrl.error.photo_source_conflict'),
          'error',
        ),
      );

      // 写真枚数表示は1本目のまま (OGP画像は集約プールにも追加されず、実際に保存されない
      // 画像が枚数に混ざらない)。
      expect(screen.getByTestId('housing-register-media-success')).toHaveTextContent(
        i18n.t('housing.register.media.fetched_count', { count: 1 }),
      );

      showToastSpy.mockRestore();
    });

    /**
     * 計画書の self-review 要件 (docs/superpowers/plans/2026-07-21-housing-multi-source-url.md:1606):
     * 「YouTube+複数URLの扱い: 既存のconflict_sources制約(YouTubeは画像/動画と排他)は維持し、
     * YouTube確定後に画像URLを追加しようとした場合はvideo_limitと同じエラー経路で拒否する」。
     * 修正前は handleTweetFetched が「代表が既に YouTube か」を一切チェックせず、写真を
     * 無条件で集約プール (sourceImageUrls) に追加していた。buildDraftImageFields の YouTube 分岐は
     * sourceImageUrls を一切読まない (youtubeVideoId 優先で imageMode='sns' を組む) ため、
     * 画面上は「N枚取得しました」と表示されるのに保存データには一切反映されない全損失
     * (photo-loss) 事故になっていた (Bug1/Bug3 の「一部消える」より悪い「受理したのに丸ごと消える」)。
     *
     * 再現手順の注記: 単一URL欄 (Task7の複数枠UIはまだ無い) では、ツイートURLを貼った直後に
     * 別URLへ書き換えると `HousingRegisterSnsUrlField` の classifySnsUrl 分岐が
     * `onYoutubeFetched(null)` を同期的に呼び、代表を即座にクリアしてしまう。そのため
     * 「YouTube貼付→ただちにツイートURLへ書き換えて即時解決」という単純な順序では
     * ガード対象の状態 (代表=YouTube 確定済みのままツイートの写真が届く) に到達できない
     * (実験して確認済み)。実際に到達可能なのは、ツイート fetch が pending のまま
     * ユーザーが YouTube URL に書き換えて代表を確立した後、**取り残された最初のツイート fetch が
     * 遅れて成功する**というレース (低速回線・気が変わって貼り直す、という現実的な操作順)。
     * `useTweetFetch` の dispatch は effect 実行時点の**現在の url** から tweetId を再計算するため
     * (`HousingRegisterSnsUrlField.tsx` の `parseTweetUrl(url)`)、url が既に YouTube に変わっていると
     * `source=null` の「孤立ディスパッチ」になり、`isDuplicatePostUrl` の入口チェックも通過してしまう。
     * テスト環境では `tweetState` (外部変数) の更新を意図的に遅らせることでこの pending 状態を再現する。
     */
    it('ツイートURL貼付(fetch pending)の直後にYouTube URLへ書き換えて代表が確定し、後から遅れてツイートの写真fetchが届いてもvideo_limitで拒否される (YouTube代表確立後の写真拒否)', async () => {
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
      const showToastSpy = vi.spyOn(ToastModule, 'showToast').mockImplementation(() => {});

      const YOUTUBE_URL = 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o';
      const TWEET_URL_PHOTO = 'https://x.com/user/status/1842217368673759541';

      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      // 1本目: 写真付きツイート URL を貼るが、まだ fetch が成功していない (tweetState は idle のまま =
      // pending を模す)。fetchTweet 自体はモックの no-op なので実際に何かが起きるわけではない。
      fireEvent.change(input, { target: { value: TWEET_URL_PHOTO } });

      // ユーザーが (低速回線で) 待たずに YouTube URL に書き換える → YouTube が代表として確定する。
      fireEvent.change(input, { target: { value: YOUTUBE_URL } });

      // 取り残された1本目のツイート fetch が遅れて成功する。dispatch 時点の url は既に YouTube URL
      // に変わっているため tweetId が取れず source=null の「孤立ディスパッチ」になるが、
      // data (写真) 自体は届く。
      tweetState = {
        ...tweetState,
        status: 'success',
        data: {
          text: 'photo-after-youtube',
          author: { name: 'P', screen_name: 'p' },
          photos: ['https://pbs.twimg.com/py1.jpg'],
          video: null,
        },
      };
      rerender(createTree());

      await waitFor(() =>
        expect(showToastSpy).toHaveBeenCalledWith(
          'housing.register.snsUrl.error.video_limit',
          'error',
        ),
      );

      // 写真は集約プール (sourceImageUrls) にも追加されない
      // (「N枚取得しました」表示自体が出ない = 実際に保存されない画像が枚数に混ざらない)。
      expect(screen.queryByTestId('housing-register-media-success')).not.toBeInTheDocument();

      // 実際に登録データ (registerListing 引数 = buildDraft の出力) にも写真が一切含まれず、
      // YouTube のまま保存されることを確認する (プレビュー表示だけでなく保存データそのものを検証)。
      const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
      fireEvent.click(addressGateBtn);
      const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      fireEvent.click(submitBtn);

      await waitFor(() => expect(registerSpy).toHaveBeenCalled());
      expect(registerSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          imageMode: 'sns',
          youtubeVideoId: 'Ypg8w7Dmq9o',
        }),
      );
      expect(registerSpy.mock.calls[0][0].sourceImageUrls).toBeUndefined();

      canRegisterSpy.mockRestore();
      checkDuplicateSpy.mockRestore();
      registerSpy.mockRestore();
      showToastSpy.mockRestore();
      window.localStorage.removeItem(AUTOSAVE_KEY);
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
        'housing.register.snsUrl.error.duplicate_url',
        'error',
      );

      showToastSpy.mockRestore();
      window.localStorage.removeItem(AUTOSAVE_KEY);
    });
  });
});
