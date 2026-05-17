// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { HousingWorkspace } from '../../components/housing/workspace/HousingWorkspace';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });

  // happy-dom matchMedia polyfill (SceneryVideo uses prefers-reduced-motion)
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
  }
});

describe('HousingWorkspace', () => {
  it('renders top bar, left panel placeholder, center, right panel placeholder, status bar', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <HousingWorkspace />
        </MemoryRouter>
      </I18nextProvider>
    );
    // top bar
    expect(screen.getByRole('img', { name: /lopo/i })).toBeInTheDocument();
    // 3 main regions (use data-region for unambiguous targeting)
    expect(document.querySelector('[data-region="left"]')).toBeTruthy();
    expect(document.querySelector('[data-region="center"]')).toBeTruthy();
    expect(document.querySelector('[data-region="right"]')).toBeTruthy();
    // status bar
    expect(screen.getByText(/Light/i)).toBeInTheDocument();
  });

  it('renders both scenery videos', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <HousingWorkspace />
        </MemoryRouter>
      </I18nextProvider>
    );
    expect(container.querySelectorAll('video').length).toBe(2);
  });
});
