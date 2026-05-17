// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { TopBar } from '../../components/housing/workspace/TopBar';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderTopBar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <TopBar />
    </I18nextProvider>
  );
}

describe('TopBar', () => {
  it('renders logo, search, register CTA, favorites, avatar', () => {
    renderTopBar();
    expect(screen.getByRole('img', { name: /lopo/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/お家|find a home|집|搜索/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登録|add yours|등록|注册/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /お気に入り|favorites|즐겨찾기|收藏/i })).toBeInTheDocument();
  });
});
