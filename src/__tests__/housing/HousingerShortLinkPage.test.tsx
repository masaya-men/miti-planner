// @vitest-environment happy-dom
/**
 * 短縮URL (/h/:slug) の入口ページ。slug → uid 解決の分岐だけを検証する
 * (見つかった後の描画内容自体は HousingerPage.test.tsx の責務なので、ここではモックに委譲する)。
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const mockResolve = vi.fn();
vi.mock('../../lib/housing/housingerProfileService', () => ({
  resolveHousingerUidByShortCode: (...args: unknown[]) => mockResolve(...args),
}));

vi.mock('../../components/housing/pages/HousingerPage', () => ({
  HousingerPage: ({ uidOverride }: { uidOverride?: string }) => (
    <div data-testid="housinger-page">uid={uidOverride}</div>
  ),
}));

import { HousingerShortLinkPage } from '../../components/housing/pages/HousingerShortLinkPage';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  mockResolve.mockReset();
});

function renderShortLink(slug: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[`/h/${slug}`]}>
        <Routes>
          <Route path="/h/:slug" element={<HousingerShortLinkPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('HousingerShortLinkPage', () => {
  it('解決できれば HousingerPage に uidOverride を渡して委譲する', async () => {
    mockResolve.mockResolvedValueOnce('hashed:d34d9c12abcdef');
    renderShortLink('たかし-d34d9c12');
    expect(await screen.findByTestId('housinger-page')).toHaveTextContent('uid=hashed:d34d9c12abcdef');
    expect(mockResolve).toHaveBeenCalledWith('d34d9c12');
  });

  it('解決できなければ (非公開/存在しない) unavailable 表示', async () => {
    mockResolve.mockResolvedValueOnce(null);
    renderShortLink('たかし-deadbeef');
    expect(await screen.findByText('このハウジンガーは公開されていません')).toBeInTheDocument();
  });

  it('slug が不正な形式 (識別コード無し) なら resolve を呼ばず unavailable 表示', async () => {
    renderShortLink('たかし');
    expect(await screen.findByText('このハウジンガーは公開されていません')).toBeInTheDocument();
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
