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
import { useTourTrayStore } from '../../store/useTourTrayStore';

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

  it('モバイルではマウント直後に無条件でビューポート補正する (resizeイベント無しでも)', () => {
    const originalMatchMedia = window.matchMedia;
    const originalVisualViewport = (window as unknown as { visualViewport?: unknown }).visualViewport;

    // モバイル判定を true に固定
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: true, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
    (window as unknown as { visualViewport: unknown }).visualViewport = {
      height: 600,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    try {
      renderShell();
      // resync() は window.scrollTo(0, 0) を最初に呼ぶ。resizeイベントを一切発火させていないので、
      // これが呼ばれているならマウント時の無条件補正が効いている証拠。
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    } finally {
      scrollToSpy.mockRestore();
      window.matchMedia = originalMatchMedia;
      (window as unknown as { visualViewport: unknown }).visualViewport = originalVisualViewport;
    }
  });

  // Task8 スコープ追加 (実機FB#10 派生): Task7 の計画画面 (/housing/tour, トレイあり&未開始) は
  // 自前の一覧+開始ボタンを持つため、フローティングの MobileTourTrayBar が重なると開始ボタンが
  // 二重表示され、並べ替えも機能重複していた。HousingShell 側で /housing/tour タブ在中だけ
  // 小バーの描画を止める (onTourTab ガード) ことを検証する。対照として他タブでは従来通り出ることも確認する。
  it('モバイル+トレイあり+/housing/tour タブでは MobileTourTrayBar を描画しない (対照: 他タブでは描画する)', () => {
    const originalMatchMedia = window.matchMedia;
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: true, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
    useTourTrayStore.getState().setTrayIds(['a']);

    try {
      const onTour = render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/housing/tour']}>
            <Routes>
              <Route path="/housing/tour" element={<HousingShell />}>
                <Route index element={<DummyPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </I18nextProvider>,
      );
      expect(onTour.queryByTestId('mobile-tour-tray-bar')).not.toBeInTheDocument();
      onTour.unmount();

      const elsewhere = render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/housing/favorites']}>
            <Routes>
              <Route path="/housing/favorites" element={<HousingShell />}>
                <Route index element={<DummyPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </I18nextProvider>,
      );
      expect(elsewhere.getByTestId('mobile-tour-tray-bar')).toBeInTheDocument();
      elsewhere.unmount();
    } finally {
      window.matchMedia = originalMatchMedia;
      useTourTrayStore.getState().clear();
    }
  });
});
