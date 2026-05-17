// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { TopBar } from '../../components/housing/workspace/TopBar';
import { useThemeStore } from '../../store/useThemeStore';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  useThemeStore.setState({ theme: 'dark' });
});

function renderTopBar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <TopBar />
    </I18nextProvider>
  );
}

describe('TopBar', () => {
  it('renders brand (logo + LoPo + subtitle), breadcrumb, and theme toggle', () => {
    renderTopBar();
    // Brand mark exposed as role=img via aria-label
    expect(screen.getByRole('img', { name: /lopo/i })).toBeInTheDocument();
    // Subtitle from i18n (housing.workspace.topbar.subtitle)
    expect(screen.getByText(/ハウジングツアー/)).toBeInTheDocument();
    // Breadcrumb placeholder
    expect(screen.getByText(/ブラウズモード/)).toBeInTheDocument();
    // Theme toggle pill has two tabs
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /dark/i })).toBeInTheDocument();
  });

  it('marks the active theme tab with is-on class and aria-selected', () => {
    useThemeStore.setState({ theme: 'dark' });
    renderTopBar();
    const dark = screen.getByRole('tab', { name: /dark/i });
    expect(dark.className).toContain('is-on');
    expect(dark.getAttribute('aria-selected')).toBe('true');
    const light = screen.getByRole('tab', { name: /light/i });
    expect(light.className).not.toContain('is-on');
  });

  it('switches theme on click', () => {
    useThemeStore.setState({ theme: 'dark' });
    renderTopBar();
    fireEvent.click(screen.getByRole('tab', { name: /light/i }));
    expect(useThemeStore.getState().theme).toBe('light');
  });
});
