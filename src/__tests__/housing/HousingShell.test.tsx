// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

// firebase 依存を持つ listings load を無害化 (docs=[] で adapter も走らない)。
vi.mock('../../lib/housingListingsService', () => ({
  getGalleryListings: () => Promise.resolve([]),
}));

import { HousingShell } from '../../components/housing/shell/HousingShell';

// シェルは Outlet に任意の子を描画できることだけ検証する (BrowsePage 本体には依存しない)。
const DummyPage: React.FC = () => <div data-testid="browse-page" />;

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
  }
  // LoPoButton が ResizeObserver を使うため happy-dom 環境に shim を用意。
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function renderShell() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/housing']}>
        <Routes>
          <Route path="/housing" element={<HousingShell />}>
            <Route index element={<DummyPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('HousingShell', () => {
  it('renders header region and nested route outlet', () => {
    renderShell();
    expect(document.querySelector('[data-region="header"]')).toBeTruthy();
    expect(screen.getByTestId('browse-page')).toBeTruthy();
  });
  it('renders tab links inside header', () => {
    renderShell();
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(6);
  });
});
