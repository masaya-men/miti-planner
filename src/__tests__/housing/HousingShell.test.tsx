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
import { BrowsePage } from '../../components/housing/pages/BrowsePage';

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
});

function renderShell() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/housing']}>
        <Routes>
          <Route path="/housing" element={<HousingShell />}>
            <Route index element={<BrowsePage />} />
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
  // タブリンク(≥6)の検証は TabBar 導入後 (Task 3) に追加する。
});
