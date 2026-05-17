// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { StatusBar } from '../../components/housing/workspace/StatusBar';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderStatusBar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <StatusBar />
    </I18nextProvider>
  );
}

describe('StatusBar', () => {
  it('renders theme and language switchers', () => {
    renderStatusBar();
    expect(screen.getByText(/Light/i)).toBeInTheDocument();
    expect(screen.getByText(/Dark/i)).toBeInTheDocument();
    expect(screen.getByText('JA')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });
});
