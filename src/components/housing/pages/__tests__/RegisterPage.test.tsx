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

import { RegisterPage } from '../RegisterPage';
// create パス (performRegister) の API を spy するため実モジュールを名前空間 import する
// (module 全体 mock は他 export を壊すため spyOn で個別に差し替える)。
import * as housingApiClient from '../../../../lib/housingApiClient';
import { AUTOSAVE_KEY } from '../../../../lib/housing/registerAutosave';

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
  tags: ['cafe'],
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

describe('RegisterPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, loading: false });
    updateMock.mockReset();
    navigateMock.mockReset();
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
      tags: ['cafe'],
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

    // タグ (選択済みチップとして表示される)
    expect(screen.getByText('カフェ')).toBeInTheDocument();
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
    renderPage({ onSaved });

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

  // Task3.4-1: 幽霊ステップ解消。 edit は写真セクションを出さない (方式A) ので、
  // ステッパーからも media ステップを除外する (クリックしても無反応な「押せない幽霊ステップ」を無くす)。
  describe('ステッパー: mode=edit は写真ステップを除外する (Task3.4-1)', () => {
    it('mode=edit ではステッパーに写真ステップが出ず、4 ステップに詰められる', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const nav = screen.getByRole('navigation', { name: '登録ステップ' });
      expect(within(nav).queryByText('画像・SNS URL')).not.toBeInTheDocument();
      expect(within(nav).getAllByRole('button')).toHaveLength(4);
      // 番号がずれず 1 から詰められる (先頭は住所ステップ)。
      expect(within(nav).getByTestId('housing-register-step-1')).toHaveTextContent('住所');
      expect(within(nav).queryByTestId('housing-register-step-5')).not.toBeInTheDocument();
    });

    it('mode=create ではステッパーに写真ステップを含む 5 ステップを出す (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const nav = screen.getByRole('navigation', { name: '登録ステップ' });
      expect(within(nav).getAllByRole('button')).toHaveLength(5);
      expect(within(nav).getByTestId('housing-register-step-1')).toHaveTextContent('画像・SNS URL');
    });
  });

  // Task3.4-2: 右カラム CheckPanel の画像行を edit で非表示 (写真を編集しない方式Aと整合)。
  describe('CheckPanel: mode=edit は画像行を出さない (Task3.4-2)', () => {
    it('mode=edit では CheckPanel に画像行が出ない (必須行は残る)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const panel = screen.getByTestId('housing-register-check-panel');
      expect(within(panel).queryByTestId('housing-register-check-image')).not.toBeInTheDocument();
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

  // 最終レビュー Important#1: 確認セクションの画像枚数要約は mode=edit で出さない。
  // edit は画像 state をプリフィルしないため imageCount が常に 0 になり、「0 枚」表示が
  // 写真を持つ家主に「写真が消えた?」と誤認させる (方式A: 写真はサーバー側で保持されたまま)。
  describe('確認セクション: mode=edit は画像枚数の要約行を出さない (最終レビュー Important#1)', () => {
    it('mode=edit では確認セクションに画像枚数の行が出ない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).queryByText('画像・SNS URL')).not.toBeInTheDocument();
    });

    it('mode=create では確認セクションに画像枚数の行が出る (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).getByText('画像・SNS URL')).toBeInTheDocument();
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
   * size は (エリア × 区画) から一意に決まるので手入力させない (2026-07-10)。
   * RegisterPage の導出 effect が唯一の書き込み口で、UI 側の select は disabled。
   * 参照表 = src/data/housing/wardPlotSizes.ts (LavenderBeds: plot1=M / plot3=L / plot29=S)。
   */
  describe('size は区画から自動導出され手入力できない', () => {
    const sizeSelect = (container: HTMLElement) =>
      container.querySelector('#housing-register-size') as HTMLSelectElement;

    it('size の select は disabled (手入力を受け付けない)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeSelect(container).disabled).toBe(true);
    });

    it('mode=edit のプリフィルで区画由来の size が入り、auto-filled バッジが出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // LavenderBeds plot 3 = L (listing の size も L で一致)
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeSelect(container).value).toBe('L');
      // fieldState が 'auto-filled' でないと requiredFields('size') が empty のまま送信できない
      expect(screen.getByTestId('housing-auto-badge-size')).toBeInTheDocument();
    });

    it('保存済みデータの size が区画と食い違っていても、開いた時点で区画側に訂正される', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // LavenderBeds plot 29 の実サイズは S。listing には誤った 'L' が入っている。
      const wrong = { ...EDITABLE_LISTING, plot: 29, size: 'L' } as unknown as HousingListing;
      const { container } = renderPage({ mode: 'edit', initialValues: wrong });
      expect(sizeSelect(container).value).toBe('S');
    });

    it('mode=create で エリアと区画を入れると size が自動で入る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();

      // 区画だけではエリアが決まらないので size は空のまま
      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '1' } });
      expect(sizeSelect(container).value).toBe('');

      // エリアが入った瞬間に導出される (LavenderBeds plot 1 = M)
      fireEvent.change(container.querySelector('#housing-register-area')!, {
        target: { value: 'LavenderBeds' },
      });
      expect(sizeSelect(container).value).toBe('M');

      // 区画を変えれば追従する (plot 3 = L)
      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '3' } });
      expect(sizeSelect(container).value).toBe('L');
    });

    it('区画が範囲外なら size は空に戻る (古い値が残らない)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeSelect(container).value).toBe('L');

      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '61' } });
      expect(sizeSelect(container).value).toBe('');
    });

    it('アパートに切り替えると size 欄ごと消える (apartment は size を持てない)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      expect(sizeSelect(container)).not.toBeNull();

      fireEvent.click(screen.getByRole('radio', { name: 'アパート' }));
      expect(sizeSelect(container)).toBeNull();
    });
  });
});
