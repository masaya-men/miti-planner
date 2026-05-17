// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { HousingWorkspace } from '../../components/housing/workspace/HousingWorkspace';
import { useHousingViewStore } from '../../store/useHousingViewStore';

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
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  useHousingViewStore.getState().reset();
});

function renderWorkspace() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <HousingWorkspace />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('HousingWorkspace', () => {
  it('renders top bar, three regions (data-region), and status footer', () => {
    renderWorkspace();
    // TopBar brand
    expect(screen.getByRole('img', { name: /lopo/i })).toBeInTheDocument();
    // 3 main regions
    expect(document.querySelector('[data-region="left"]')).toBeTruthy();
    expect(document.querySelector('[data-region="center"]')).toBeTruthy();
    expect(document.querySelector('[data-region="right"]')).toBeTruthy();
    // StatusBar Build label is unique to status footer
    expect(screen.getByText(/Build/)).toBeInTheDocument();
  });

  it('renders both scenery videos', () => {
    const { container } = renderWorkspace();
    expect(container.querySelectorAll('video').length).toBe(2);
  });

  it('uses housing-main grid container with collapse data attrs reflecting view store', () => {
    renderWorkspace();
    const main = document.querySelector('.housing-main') as HTMLElement;
    expect(main).toBeTruthy();
    expect(main.getAttribute('data-left-collapsed')).toBe('false');
    expect(main.getAttribute('data-right-collapsed')).toBe('false');
  });

  it('collapses left panel data attr when leftPanelOpen is false', () => {
    useHousingViewStore.setState({ leftPanelOpen: false });
    renderWorkspace();
    const main = document.querySelector('.housing-main') as HTMLElement;
    expect(main.getAttribute('data-left-collapsed')).toBe('true');
  });
});
