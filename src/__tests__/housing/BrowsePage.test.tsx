// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

// firebase 依存の遅延 import を無害化 (BrowsePage は load を呼ばないが FilterPanel 経由の安全網)。
vi.mock('../../lib/housingListingsService', () => ({
  getGalleryListings: () => Promise.resolve([]),
}));

import { BrowsePage } from '../../components/housing/pages/BrowsePage';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';

const mk = (id: string) => ({
  id, area: 'Mist', ward: 1, plot: 1, buildingType: 'house',
  size: 'M', imageMode: 'none', tags: [],
});

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
  }
});

beforeEach(() => {
  useHousingListingsStore.setState({ status: 'ready', listings: [mk('a'), mk('b')], error: null } as never);
});

describe('BrowsePage', () => {
  it('renders a card per filtered listing', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <BrowsePage />
        </MemoryRouter>
      </I18nextProvider>,
    );
    // カードは role="link" (カード全体クリックで詳細へ・B9) なので testid で数える
    expect(screen.getAllByTestId('housing-listing-card').length).toBe(2);
  });
});
