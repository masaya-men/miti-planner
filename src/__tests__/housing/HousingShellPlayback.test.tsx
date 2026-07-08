// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

// firebase 依存を持つ listings load を無害化 (docs=[] で adapter も走らない)。
// HousingShell.test.tsx と同じ理由 (memory: reference_vitest_pool_firebase)。
vi.mock('../../lib/housingListingsService', () => ({
  getGalleryListings: () => Promise.resolve([]),
}));

import { useHousingPlayback } from '../../lib/housing/HousingPlaybackContext';
import { HousingShell } from '../../components/housing/shell/HousingShell';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });

  // matchMedia (prefers-reduced-motion) を happy-dom に用意（未定義だと useReducedMotion が落ちる）
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
      } as unknown as MediaQueryList);
  }
  // LoPoButton (AppHeader 内) が ResizeObserver を使うため happy-dom 環境に shim を用意 (HousingShell.test.tsx 踏襲)。
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function AmbientProbe() {
  const { ambientOn } = useHousingPlayback();
  return <span data-testid="ambient-probe">{ambientOn ? 'on' : 'off'}</span>;
}

describe('HousingShell — 生きたカード Provider mount', () => {
  it('子ルートで useHousingPlayback().ambientOn が Provider 由来 (reduced-motion 非時 on) になる', () => {
    const { getByTestId } = render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/housing']}>
          <Routes>
            <Route path="/housing" element={<HousingShell />}>
              <Route index element={<AmbientProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(getByTestId('ambient-probe').textContent).toBe('on');
  });
});
