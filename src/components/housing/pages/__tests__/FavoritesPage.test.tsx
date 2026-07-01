// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { FavoritesPage } from '../FavoritesPage';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('FavoritesPage', () => {
  it('お気に入りが空なら空状態を表示', () => {
    useHousingFavoritesStore.setState({ ids: [] });
    renderPage();
    expect(screen.getByTestId('housing-favorites-empty')).toBeInTheDocument();
  });

  it('お気に入りが1件以上あれば空状態を非表示', () => {
    useHousingFavoritesStore.setState({ ids: ['listing-1'] });
    renderPage();
    expect(screen.queryByTestId('housing-favorites-empty')).not.toBeInTheDocument();
  });
});
