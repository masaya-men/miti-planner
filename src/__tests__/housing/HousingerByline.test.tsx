// @vitest-environment happy-dom
/**
 * Task 7: 詳細パネルの登録者行 (HousingerByline)。
 * - 公開 profile があれば名前 + リンク先 (/housing/housinger/:uid) が出る
 * - profile が null (非公開/未取得/取得失敗) なら行ごと何も描画しない (§6.3)
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import type { HousingerProfile } from '../../types/housing';

const mockGetHousingerProfile = vi.fn();
vi.mock('../../lib/housing/housingerProfileService', () => ({
  getHousingerProfile: (...args: unknown[]) => mockGetHousingerProfile(...args),
}));

import { HousingerByline } from '../../components/housing/housinger/HousingerByline';

const publishedProfile: HousingerProfile = {
  displayName: 'たかし',
  avatarUrl: null,
  bio: null,
  snsUrl: null,
  isPublished: true,
  isModerationHidden: false,
  reportCount: 0,
  createdAt: 1,
  updatedAt: 1,
};

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

beforeEach(() => {
  mockGetHousingerProfile.mockReset();
});

function renderByline(ownerUid: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <HousingerByline ownerUid={ownerUid} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('HousingerByline', () => {
  it('公開 profile があれば名前 + リンク先が出る', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    const { container } = renderByline('uid-1');

    const link = await screen.findByRole('link', { name: /たかし/ });
    expect(link).toHaveAttribute('href', '/housing/housinger/uid-1');
    expect(container.textContent).toContain('たかし のハウジング');
  });

  // #3: リンクは hashed: prefix を外した短縮 URL にする (profile 取得は raw uid のまま)。
  it('ownerUid が hashed: 付きでもリンク先は prefix を外した URL になる', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    renderByline('hashed:d34d9c');

    const link = await screen.findByRole('link', { name: /たかし/ });
    expect(link).toHaveAttribute('href', '/housing/housinger/d34d9c');
    // profile 取得は内部 ID (hashed: 付き) のまま呼ぶ (剥がすのはリンク文字列だけ)。
    expect(mockGetHousingerProfile).toHaveBeenCalledWith('hashed:d34d9c');
  });

  it('profile が null (非公開/取得不可) なら何も描画しない', async () => {
    mockGetHousingerProfile.mockResolvedValueOnce(null);
    const { container } = renderByline('uid-2');

    await vi.waitFor(() => {
      expect(mockGetHousingerProfile).toHaveBeenCalledWith('uid-2');
    });
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('');
  });
});
