// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const listAllPersonalTagsMock = vi.fn();
vi.mock('../../lib/housing/personalTagLookup', () => ({
  listAllPersonalTags: (...args: unknown[]) => listAllPersonalTagsMock(...args),
}));

import { HousingerTagSection } from '../../components/housing/browse/tagpicker/HousingerTagSection';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

beforeEach(() => {
  listAllPersonalTagsMock.mockReset();
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const TAGS = [
  { id: 'personal_taro', displayName: 'taro', displayNameLower: 'taro', ownerUid: 'u1', createdAt: 0, reportCount: 0, isHidden: false },
  { id: 'personal_hanako', displayName: 'hanako', displayNameLower: 'hanako', ownerUid: 'u2', createdAt: 0, reportCount: 0, isHidden: false },
];

describe('HousingerTagSection', () => {
  it('ロード中はローディング文言を表示する', () => {
    listAllPersonalTagsMock.mockReturnValue(new Promise(() => {}));
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
  });

  it('取得できたら全員分をチップで表示する', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce(TAGS);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    expect(screen.getByText('hanako')).toBeInTheDocument();
  });

  it('各チップにアバター(画像URL無し=頭文字プレースホルダ)を表示する', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce(TAGS);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    const taroButton = screen.getByText('taro').closest('button') as HTMLElement;
    const fallback = taroButton.querySelector('.housinger-avatar-fallback');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toBe('T');
    expect(taroButton.querySelector('img')).toBeNull();
  });

  it('selected に含まれるチップは data-selected=true', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce(TAGS);
    wrap(<HousingerTagSection selected={['personal_taro']} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    expect(screen.getByText('taro').closest('button')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByText('hanako').closest('button')).toHaveAttribute('data-selected', 'false');
  });

  it('チップクリックで onToggle が呼ばれる', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce(TAGS);
    const onToggle = vi.fn();
    wrap(<HousingerTagSection selected={[]} onToggle={onToggle} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    fireEvent.click(screen.getByText('taro'));
    expect(onToggle).toHaveBeenCalledWith('personal_taro');
  });

  it('0件なら空状態の文言を表示する', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce([]);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('まだハウジンガーが登録されていません')).toBeInTheDocument());
  });

  it('セクション見出しクリックで折りたたむ (チップが非表示になる)', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce(TAGS);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'ハウジンガー' }));
    expect(screen.queryByText('taro')).toBeNull();
  });
});
