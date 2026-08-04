// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const listPublishedHousingersMock = vi.fn();
vi.mock('../../lib/housing/publishedHousingers', () => ({
  listPublishedHousingers: (...args: unknown[]) => listPublishedHousingersMock(...args),
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
  listPublishedHousingersMock.mockReset();
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const HOUSINGERS = [
  { uid: 'taro', displayName: 'taro', displayNameLower: 'taro', avatarUrl: null, bio: null, snsUrl: null, isPublished: true, isModerationHidden: false, reportCount: 0, createdAt: 0, updatedAt: 0 },
  { uid: 'hanako', displayName: 'hanako', displayNameLower: 'hanako', avatarUrl: null, bio: null, snsUrl: null, isPublished: true, isModerationHidden: false, reportCount: 0, createdAt: 0, updatedAt: 0 },
];

describe('HousingerTagSection', () => {
  it('ロード中はローディング文言を表示する', () => {
    listPublishedHousingersMock.mockReturnValue(new Promise(() => {}));
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
  });

  it('取得できたら全員分をチップで表示する', async () => {
    listPublishedHousingersMock.mockResolvedValueOnce(HOUSINGERS);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    expect(screen.getByText('hanako')).toBeInTheDocument();
  });

  it('各チップにアバター(画像URL無し=頭文字プレースホルダ)を表示する', async () => {
    listPublishedHousingersMock.mockResolvedValueOnce(HOUSINGERS);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    const taroButton = screen.getByText('taro').closest('button') as HTMLElement;
    const fallback = taroButton.querySelector('.housinger-avatar-fallback');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toBe('T');
    expect(taroButton.querySelector('img')).toBeNull();
  });

  it('tag.avatarUrl があれば HousingerAvatar に渡り img で表示される (頭文字フォールバックにならない)', async () => {
    const tagsWithAvatar = [
      { ...HOUSINGERS[0], avatarUrl: 'https://example.com/taro.webp' },
      HOUSINGERS[1],
    ];
    listPublishedHousingersMock.mockResolvedValueOnce(tagsWithAvatar);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    const taroButton = screen.getByText('taro').closest('button') as HTMLElement;
    const img = taroButton.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/taro.webp');
    expect(taroButton.querySelector('.housinger-avatar-fallback')).toBeNull();

    // avatarUrl の無い hanako は引き続き頭文字フォールバックのまま
    const hanakoButton = screen.getByText('hanako').closest('button') as HTMLElement;
    expect(hanakoButton.querySelector('img')).toBeNull();
    expect(hanakoButton.querySelector('.housinger-avatar-fallback')?.textContent).toBe('H');
  });

  it('selected に含まれるチップは data-selected=true', async () => {
    listPublishedHousingersMock.mockResolvedValueOnce(HOUSINGERS);
    wrap(<HousingerTagSection selected={['personal_taro']} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    expect(screen.getByText('taro').closest('button')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByText('hanako').closest('button')).toHaveAttribute('data-selected', 'false');
  });

  it('チップクリックで onToggle が呼ばれる', async () => {
    listPublishedHousingersMock.mockResolvedValueOnce(HOUSINGERS);
    const onToggle = vi.fn();
    wrap(<HousingerTagSection selected={[]} onToggle={onToggle} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    fireEvent.click(screen.getByText('taro'));
    expect(onToggle).toHaveBeenCalledWith('personal_taro');
  });

  it('0件なら空状態の文言を表示する', async () => {
    listPublishedHousingersMock.mockResolvedValueOnce([]);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('まだハウジンガーが登録されていません')).toBeInTheDocument());
  });

  it('セクション見出しクリックで折りたたむ (チップが非表示になる)', async () => {
    listPublishedHousingersMock.mockResolvedValueOnce(HOUSINGERS);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'ハウジンガー' }));
    expect(screen.queryByText('taro')).toBeNull();
  });
});
