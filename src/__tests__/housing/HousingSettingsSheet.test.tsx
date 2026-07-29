// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import enTranslations from '../../locales/en.json';
import koTranslations from '../../locales/ko.json';
import zhTranslations from '../../locales/zh.json';
import zhHantTranslations from '../../locales/zh-Hant.json';
import { MemoryRouter } from 'react-router-dom';
import { HousingSettingsSheet } from '../../components/housing/shell/HousingSettingsSheet';
import { useThemeStore } from '../../store/useThemeStore';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: {
      ja: { translation: jaTranslations },
      en: { translation: enTranslations },
      ko: { translation: koTranslations },
      zh: { translation: zhTranslations },
      'zh-Hant': { translation: zhHantTranslations },
    },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  useThemeStore.setState({ theme: 'dark' });
  i18n.changeLanguage('ja');
});

function renderSheet() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <HousingSettingsSheet isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('HousingSettingsSheet', () => {
  it('renders language switcher with ja/en/ko/zh/zh-Hant and marks active', () => {
    renderSheet();
    const ja = screen.getByRole('button', { name: 'ja' });
    const en = screen.getByRole('button', { name: 'en' });
    const ko = screen.getByRole('button', { name: 'ko' });
    const zh = screen.getByRole('button', { name: 'zh' });
    const zhHant = screen.getByRole('button', { name: 'zh-Hant' });
    expect(ja).toBeInTheDocument();
    expect(en).toBeInTheDocument();
    expect(ko).toBeInTheDocument();
    expect(zh).toBeInTheDocument();
    expect(zhHant).toBeInTheDocument();
    expect(ja.className).toContain('is-on');
  });

  it('changes language on click', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(i18n.language).toBe('en');
  });

  it('marks only zh-Hant active (not zh) when language is zh-Hant (2026-07-28 誤判定バグの回帰テスト)', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'zh-Hant' }));
    const zh = screen.getByRole('button', { name: 'zh' });
    const zhHant = screen.getByRole('button', { name: 'zh-Hant' });
    expect(zhHant.className).toContain('is-on');
    expect(zh.className).not.toContain('is-on');
  });

  it('toggles theme on click', () => {
    renderSheet();
    const tabs = screen.getAllByRole('tab');
    const lightTab = tabs.find((el) => el.getAttribute('aria-selected') === 'false');
    fireEvent.click(lightTab!);
    expect(useThemeStore.getState().theme).toBe('light');
  });
});
