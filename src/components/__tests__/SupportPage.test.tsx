// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SupportPage } from '../SupportPage';

// react-i18next の useTranslation をモック
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'support.title': 'LoPo を応援する',
        'support.subtitle': 'LoPo の運営支援はこちらから',
        'support.about_heading': 'LoPo について',
        'support.about_body': 'LoPo は個人で運営している...',
        'support.usage_heading': '資金の使い道',
        'support.usage_items': 'サーバー費,ストレージ費,開発時間',
        'support.kofi_heading': 'Ko-fi で支援する',
        'support.kofi_note': 'Ko-fi は寄付プラットフォーム...',
        'support.disclaimer': '本サイトは SQUARE ENIX の公式サイトではありません...',
        'support.back': '← 戻る',
        'footer.kofi': 'Ko-fiで応援',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'ja' },
  }),
}));

// useThemeStore のモック
vi.mock('../../store/useThemeStore', () => ({
  useThemeStore: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

// useTransitionOverlay のモック
vi.mock('../ui/TransitionOverlay', () => ({
  useTransitionOverlay: () => ({ runTransition: (cb: () => void) => cb() }),
}));

// useCanonicalUrl のモック
vi.mock('../../hooks/useCanonicalUrl', () => ({
  useCanonicalUrl: vi.fn(),
}));

describe('SupportPage', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('全セクションのタイトルが表示される', () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <Routes>
          <Route path="/support" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('LoPo を応援する')).toBeTruthy();
    expect(screen.getByText('LoPo について')).toBeTruthy();
    expect(screen.getByText('資金の使い道')).toBeTruthy();
    expect(screen.getByText('Ko-fi で支援する')).toBeTruthy();
  });

  it('Ko-fi ボタンが正しい URL を持つ', () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <Routes>
          <Route path="/support" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: /Ko-fiで応援/ });
    expect(link.getAttribute('href')).toBe('https://ko-fi.com/lopoly');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('資金使途リストが 3 項目展開される', () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <Routes>
          <Route path="/support" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('サーバー費')).toBeTruthy();
    expect(screen.getByText('ストレージ費')).toBeTruthy();
    expect(screen.getByText('開発時間')).toBeTruthy();
  });

  it('SE 免責が表示される', () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <Routes>
          <Route path="/support" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/SQUARE ENIX の公式サイトではありません/)).toBeTruthy();
  });
});
