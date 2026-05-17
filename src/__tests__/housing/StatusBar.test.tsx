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
import { StatusBar } from '../../components/housing/workspace/StatusBar';
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
    },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  useThemeStore.setState({ theme: 'dark' });
  i18n.changeLanguage('ja');
});

function renderStatusBar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <StatusBar />
    </I18nextProvider>
  );
}

describe('StatusBar', () => {
  it('renders Build / Lat / Lon / Theme readouts in the left group', () => {
    renderStatusBar();
    expect(screen.getByText(/Build/)).toBeInTheDocument();
    expect(screen.getByText(/Lat/)).toBeInTheDocument();
    expect(screen.getByText(/Lon/)).toBeInTheDocument();
    // Theme readout — matches the dark theme set in beforeEach
    expect(screen.getAllByText(/Dark/).length).toBeGreaterThan(0);
  });

  it('renders Stops / ETA / FPS in the right group', () => {
    renderStatusBar();
    expect(screen.getByText(/Stops/)).toBeInTheDocument();
    expect(screen.getByText(/ETA/)).toBeInTheDocument();
    expect(screen.getByText(/FPS/)).toBeInTheDocument();
  });

  it('renders language switcher with ja/en/ko/zh and marks active', () => {
    renderStatusBar();
    const ja = screen.getByRole('button', { name: 'ja' });
    const en = screen.getByRole('button', { name: 'en' });
    const ko = screen.getByRole('button', { name: 'ko' });
    const zh = screen.getByRole('button', { name: 'zh' });
    expect(ja).toBeInTheDocument();
    expect(en).toBeInTheDocument();
    expect(ko).toBeInTheDocument();
    expect(zh).toBeInTheDocument();
    expect(ja.className).toContain('is-on');
  });

  it('changes language on click', () => {
    renderStatusBar();
    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(i18n.language).toBe('en');
  });
});
