// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { HousingWorkspace } from '../../components/housing/workspace/HousingWorkspace';
import { useHousingTourStore } from '../../store/useHousingTourStore';
import { useHousingViewStore } from '../../store/useHousingViewStore';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((q: string) => ({
        matches: false, media: q, onchange: null,
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
      })),
    });
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
  // Reset both stores to a clean slate before each test
  useHousingTourStore.getState().reset();
  useHousingViewStore.getState().reset();
  sessionStorage.removeItem('housing-tour-id');
});

afterEach(() => {
  cleanup();
});

function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/housing" element={<HousingWorkspace />} />
          <Route path="/housing/tour/:tourId" element={<HousingWorkspace />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('/housing/tour/:tourId auto-enter', () => {
  it('auto-enters tour mode when listings are present in local store', () => {
    useHousingTourStore.getState().setListings(['mock-001', 'mock-002']);
    renderAt('/housing/tour/abc');
    expect(useHousingViewStore.getState().mode).toBe('tour');
    expect(useHousingTourStore.getState().running).toBe(true);
    expect(sessionStorage.getItem('housing-tour-id')).toBe('abc');
  });

  it('does NOT auto-enter tour mode when local listings are empty', () => {
    useHousingTourStore.getState().setListings([]);
    renderAt('/housing/tour/abc');
    expect(useHousingViewStore.getState().mode).toBe('browse');
    expect(useHousingTourStore.getState().running).toBe(false);
    // Note: we do NOT assert sessionStorage here because the test environment
    // (Firebase App Check debug token) may write to sessionStorage independently.
  });
});
