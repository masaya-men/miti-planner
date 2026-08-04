// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { PersonalTagFilterLink } from '../../components/housing/workspace/PersonalTagFilterLink';

const getHousingerProfileMock = vi.fn();
vi.mock('../../lib/housing/housingerProfileService', () => ({
  getHousingerProfile: (...args: unknown[]) => getHousingerProfileMock(...args),
}));

beforeAllInit();
function beforeAllInit() {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja',
      fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
}

function renderLink(tagIds: string[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <PersonalTagFilterLink tagIds={tagIds} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('PersonalTagFilterLink', () => {
  beforeEach(() => {
    getHousingerProfileMock.mockReset();
  });

  it('個人タグが選択されていなければ何も表示しない', () => {
    const { container } = renderLink([]);
    expect(container).toBeEmptyDOMElement();
    expect(getHousingerProfileMock).not.toHaveBeenCalled();
  });

  it('個人タグが2つ以上選択されていれば何も表示しない (1つに絞られているときだけ)', () => {
    const { container } = renderLink(['personal_a', 'personal_b']);
    expect(container).toBeEmptyDOMElement();
    expect(getHousingerProfileMock).not.toHaveBeenCalled();
  });

  it('個人タグ1つで絞り込み中なら解決してハウジンガーページへのリンクを出す', async () => {
    getHousingerProfileMock.mockResolvedValue({
      displayName: 'yuura', avatarUrl: null, bio: null, snsUrl: null,
      isPublished: true, isModerationHidden: false, reportCount: 0, createdAt: 0, updatedAt: 0,
      displayNameLower: 'yuura',
    });
    renderLink(['personal_abc123']);

    const link = await screen.findByRole('link', { name: /yuura.*ハウジンガーページを見る/ });
    expect(link).toHaveAttribute('href', '/housing/housinger/abc123');
    expect(getHousingerProfileMock).toHaveBeenCalledWith('hashed:abc123');
  });

  it('プロフィール解決に失敗 (null、非公開等) したら何も表示しない', async () => {
    getHousingerProfileMock.mockResolvedValue(null);
    const { container } = renderLink(['personal_gone']);
    await waitFor(() => {
      expect(getHousingerProfileMock).toHaveBeenCalledWith('hashed:gone');
    });
    expect(container).toBeEmptyDOMElement();
  });
});
