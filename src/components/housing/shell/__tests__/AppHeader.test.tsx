// @vitest-environment happy-dom
/**
 * Stream C-1 (d): ヘッダー「ハウジングツアー」は探す (/housing) への遷移ボタンになった。
 * 文言は不変 (housing.workspace.topbar.subtitle = 「ハウジングツアー」) で、
 * 見た目上の飾り <span> から実際にクリックできる <button> へ変わったことのみ検証する。
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

// useNavigate だけ差し替え、他の react-router-dom export (MemoryRouter/useLocation 等) は実物のまま使う
// (HousingActionBar.test.tsx と同じパターン)。
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { AppHeader } from '../AppHeader';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja',
      fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
  // HousingShell.test.tsx と同じ shim (useThemeStore の初期化 / LoPoButton の ResizeObserver)。
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
  }
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

beforeEach(() => {
  navigateMock.mockReset();
});

// 検索窓 (showSearch) は /housing 限定の別関心事なので、それ以外のパスで描画してノイズを避ける。
function renderHeader(path = '/housing/favorites') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <AppHeader />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('AppHeader', () => {
  it('「ハウジングツアー」はクリック可能なボタンとして描画され、文言は不変', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'ハウジングツアー' })).toBeInTheDocument();
  });

  it('「ハウジングツアー」ボタンをクリックすると探す (/housing) へ navigate する', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'ハウジングツアー' }));
    expect(navigateMock).toHaveBeenCalledWith('/housing');
  });
});
