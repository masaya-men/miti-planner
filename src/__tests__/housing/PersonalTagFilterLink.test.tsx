// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { PersonalTagFilterLink } from '../../components/housing/workspace/PersonalTagFilterLink';

const getPersonalTagByIdMock = vi.fn();
vi.mock('../../lib/housing/personalTagLookup', () => ({
  getPersonalTagById: (...args: unknown[]) => getPersonalTagByIdMock(...args),
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
    getPersonalTagByIdMock.mockReset();
  });

  it('個人タグが選択されていなければ何も表示しない', () => {
    const { container } = renderLink([]);
    expect(container).toBeEmptyDOMElement();
    expect(getPersonalTagByIdMock).not.toHaveBeenCalled();
  });

  it('個人タグが2つ以上選択されていれば何も表示しない (1つに絞られているときだけ)', () => {
    const { container } = renderLink(['personal_a', 'personal_b']);
    expect(container).toBeEmptyDOMElement();
    expect(getPersonalTagByIdMock).not.toHaveBeenCalled();
  });

  it('個人タグ1つで絞り込み中なら解決してハウジンガーページへのリンクを出す', async () => {
    getPersonalTagByIdMock.mockResolvedValue({
      id: 'personal_abc123', displayName: 'yuura', displayNameLower: 'yuura',
      ownerUid: 'u-owner', createdAt: 0, reportCount: 0, isHidden: false,
    });
    renderLink(['personal_abc123']);

    const link = await screen.findByRole('link', { name: /yuura.*ハウジンガーページを見る/ });
    expect(link).toHaveAttribute('href', '/housing/housinger/u-owner');
    expect(getPersonalTagByIdMock).toHaveBeenCalledWith('personal_abc123');
  });

  it('タグ解決に失敗 (null) したら何も表示しない', async () => {
    getPersonalTagByIdMock.mockResolvedValue(null);
    const { container } = renderLink(['personal_gone']);
    await waitFor(() => {
      expect(getPersonalTagByIdMock).toHaveBeenCalledWith('personal_gone');
    });
    expect(container).toBeEmptyDOMElement();
  });
});
