// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { RegisterPage } from '../RegisterPage';
import { useAuthStore } from '../../../../store/useAuthStore';
import type { HousingListing } from '../../../../types/housing';

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
});
