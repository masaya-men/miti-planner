// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { TabBar } from '../../components/housing/shell/TabBar';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja',
      fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <TabBar />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('TabBar', () => {
  it('marks the browse tab active on /housing', () => {
    renderAt('/housing');
    const browse = screen.getByRole('link', { name: /housing\.tabs\.browse|探す/ });
    expect(browse.getAttribute('aria-current')).toBe('page');
  });

  it('marks favorites active on /housing/favorites and browse NOT active', () => {
    renderAt('/housing/favorites');
    const fav = screen.getByRole('link', { name: /housing\.tabs\.favorites|お気に入り/ });
    expect(fav.getAttribute('aria-current')).toBe('page');
    const browse = screen.getByRole('link', { name: /housing\.tabs\.browse|探す/ });
    expect(browse.getAttribute('aria-current')).toBeNull();
  });
});
