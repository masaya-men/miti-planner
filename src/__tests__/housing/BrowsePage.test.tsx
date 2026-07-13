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

const getPersonalTagByIdMock = vi.fn();
vi.mock('../../lib/housing/personalTagLookup', () => ({
  getPersonalTagById: (...args: unknown[]) => getPersonalTagByIdMock(...args),
}));

import { BrowsePage } from '../../components/housing/pages/BrowsePage';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';

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
  useHousingViewStore.getState().reset();
  useHousingFilterStore.getState().clearAll();
  getPersonalTagByIdMock.mockReset();
});

const renderPage = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BrowsePage />
      </MemoryRouter>
    </I18nextProvider>,
  );

describe('BrowsePage', () => {
  it('renders a card per filtered listing', () => {
    renderPage();
    // カードは role="link" (カード全体クリックで詳細へ・B9) なので testid で数える
    expect(screen.getAllByTestId('housing-listing-card').length).toBe(2);
  });

  it('shows the list|map view toggle in ready state (default = list)', () => {
    renderPage();
    const listTab = screen.getByRole('tab', { name: '一覧' });
    expect(listTab.getAttribute('data-selected')).toBe('true');
    // 既定は一覧 = 地図プレースホルダは出ない
    expect(screen.queryByTestId('housing-browse-map-view')).toBeNull();
  });

  it('browseView=map swaps only the center (map placeholder shown, tray stays)', () => {
    useHousingViewStore.getState().setBrowseView('map');
    renderPage();
    expect(screen.getByTestId('housing-browse-map-view')).toBeTruthy();
    // 一覧グリッドは出ない
    expect(screen.queryByTestId('housing-listing-card')).toBeNull();
    // トレイ (右カラム) は地図モードでも従来どおり表示 (spec 4.4)
    expect(screen.getByRole('button', { name: /開始|start/i })).toBeTruthy();
  });

  it('個人タグ 1 つで絞り込み中は結果一覧の上にハウジンガーページへのリンクを出す (統合契約4)', async () => {
    getPersonalTagByIdMock.mockResolvedValue({
      id: 'personal_abc123', displayName: 'yuura', displayNameLower: 'yuura',
      ownerUid: 'u-owner', createdAt: 0, reportCount: 0, isHidden: false,
    });
    useHousingFilterStore.getState().toggleTag('personal_abc123');

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <BrowsePage />
        </MemoryRouter>
      </I18nextProvider>,
    );

    const link = await screen.findByRole('link', { name: /yuura.*ハウジンガーページを見る/ });
    expect(link).toHaveAttribute('href', '/housing/housinger/u-owner');
  });
});
