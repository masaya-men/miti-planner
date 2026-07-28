// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
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
      'zh-Hant': { translation: zhHantTranslations },
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
      <MemoryRouter>
        <StatusBar />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('StatusBar', () => {
  it('renders SE copyright + fan-tool disclaimer + legal links + Ko-fi link in the left group (2026-07-11 著作権是正)', () => {
    renderStatusBar();
    // FF14 素材はスクエニ著作物。© LoPo は誤りで、軽減表フッターと同じ SE 表記 + 非公式免責にする。
    expect(screen.getByText(/SQUARE ENIX CO\., LTD\. All Rights Reserved\./)).toBeInTheDocument();
    expect(screen.getByText(/非公式のファンツール/)).toBeInTheDocument();
    expect(screen.queryByText(/© \d+ LoPo/)).not.toBeInTheDocument();
    const privacy = screen.getByRole('link', { name: 'プライバシーポリシー' });
    const terms = screen.getByRole('link', { name: '利用規約' });
    // Ko-fi は LoPo 内の応援説明ページ /support への内部リンク (他フッター導線と統一)。
    const kofi = screen.getByRole('link', { name: 'Ko-fiで応援' });
    expect(privacy).toHaveAttribute('href', '/privacy');
    expect(privacy).toHaveAttribute('target', '_blank');
    expect(privacy).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(terms).toHaveAttribute('href', '/terms');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(kofi).toHaveAttribute('href', '/support');
  });

  it('does not render the removed BUILD / LAT / LON / STOPS / FPS dummy readouts', () => {
    renderStatusBar();
    expect(screen.queryByText(/Build/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lat/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lon/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Stops/)).not.toBeInTheDocument();
    expect(screen.queryByText(/FPS/)).not.toBeInTheDocument();
  });

  it('renders theme readout in the right group (kept)', () => {
    renderStatusBar();
    // Theme readout — matches the dark theme set in beforeEach
    expect(screen.getAllByText(/Dark/).length).toBeGreaterThan(0);
  });

  it('renders language switcher with ja/en/ko/zh/zh-Hant and marks active', () => {
    renderStatusBar();
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
    renderStatusBar();
    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(i18n.language).toBe('en');
  });

  it('marks only zh-Hant active (not zh) when language is zh-Hant (2026-07-28 誤判定バグの回帰テスト)', () => {
    renderStatusBar();
    fireEvent.click(screen.getByRole('button', { name: 'zh-Hant' }));
    const zh = screen.getByRole('button', { name: 'zh' });
    const zhHant = screen.getByRole('button', { name: 'zh-Hant' });
    expect(zhHant.className).toContain('is-on');
    expect(zh.className).not.toContain('is-on');
  });

  it('mount 時に build 版数を console.info へ 1 回出す (BUILD UI 撤去後も診断価値を残す)', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    renderStatusBar();
    expect(spy).toHaveBeenCalledWith('[housing] build', expect.any(String));
    spy.mockRestore();
  });
});
