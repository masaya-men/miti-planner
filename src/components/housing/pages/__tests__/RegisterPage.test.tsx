// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
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

import { RegisterPage } from '../RegisterPage';

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

function renderPage(props?: { mode?: 'create' | 'edit'; initialValues?: HousingListing }) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <RegisterPage mode={props?.mode} initialValues={props?.initialValues} />
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
});
