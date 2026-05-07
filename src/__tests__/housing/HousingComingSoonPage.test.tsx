// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { HousingComingSoonPage } from '../../components/housing/HousingComingSoonPage';

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
        <HousingComingSoonPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('HousingComingSoonPage', () => {
  it('eyebrow / title / lead / detail / back link を表示する', () => {
    renderPage();
    expect(screen.getByText('ハウジングツアー')).toBeInTheDocument();
    expect(screen.getByText('もうすぐ来ます')).toBeInTheDocument();
    expect(screen.getByText(/FF14 のハウジングを巡る/)).toBeInTheDocument();
    expect(screen.getByText(/投稿写真ギャラリー/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'トップに戻る' })).toHaveAttribute('href', '/');
  });
});
