// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const listPublishedHousingersMock = vi.fn();
vi.mock('../../lib/housing/publishedHousingers', () => ({
  listPublishedHousingers: (...args: unknown[]) => listPublishedHousingersMock(...args),
}));

import { BrowseHousingerView } from '../../components/housing/browse/BrowseHousingerView';
import { BrowseViewToggle } from '../../components/housing/browse/BrowseViewToggle';
import { resetPublishedHousingersCache } from '../../lib/housing/publishedHousingersCache';
import { MOCK_LISTINGS, type MockListing } from '../../data/housing/mockListings';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const mk = (uid: string, name: string, bio: string | null = null) => ({
  uid, displayName: name, displayNameLower: name.toLowerCase(), avatarUrl: null, bio, snsUrl: null,
  isPublished: true, isModerationHidden: false, reportCount: 0, createdAt: 0, updatedAt: 0,
});
const HOUSINGERS = [mk('hashed:aaa', 'Alice', '紹介A'), mk('hashed:bbb', 'Bob'), mk('hashed:ccc', 'あやか'), mk('hashed:ddd', '漢字さん'), mk('hashed:eee', 'Nobody')];

const listing = (id: string, owner: string, createdAt: number): MockListing => ({ ...MOCK_LISTINGS[0], id, ownerUid: owner, createdAt });
const FILTERED = [
  listing('1', 'hashed:aaa', 10), listing('2', 'hashed:aaa', 30), listing('3', 'hashed:aaa', 20), listing('4', 'hashed:aaa', 5),
  listing('5', 'hashed:bbb', 1), listing('6', 'hashed:ccc', 1), listing('7', 'hashed:ddd', 1),
];

beforeEach(() => {
  listPublishedHousingersMock.mockReset();
  listPublishedHousingersMock.mockResolvedValue(HOUSINGERS);
  resetPublishedHousingersCache();
});

const wrap = (ui: React.ReactElement) =>
  render(<I18nextProvider i18n={i18n}><MemoryRouter>{ui}</MemoryRouter></I18nextProvider>);

describe('BrowseViewToggle', () => {
  it('「ハウジンガー」タブが出る', () => {
    wrap(<BrowseViewToggle value="list" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'ハウジンガー' })).toBeInTheDocument();
  });
});

describe('BrowseHousingerView', () => {
  it('絞り込み後の家を持つ人だけ出す (持たない人は出さない)・件数表示', async () => {
    wrap(<BrowseHousingerView filtered={FILTERED} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.queryByText('Nobody')).toBeNull();
    expect(screen.getByText('4 人')).toBeInTheDocument();
  });

  it('頭文字見出しが順序どおり・サムネは新しい順で最大 3 枚', async () => {
    const { container } = wrap(<BrowseHousingerView filtered={FILTERED} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    const heads = Array.from(container.querySelectorAll('.housing-housinger-heading')).map((e) => e.textContent);
    expect(heads).toEqual(['A', 'B', 'かな', '漢字']);
    const aliceRow = screen.getByText('Alice').closest('a') as HTMLElement;
    expect(aliceRow.querySelectorAll('img')).toHaveLength(3);
    expect(aliceRow.textContent).toContain('紹介A');
  });

  it('行は /housing/housinger/:uid へのリンク (hashed: は剥がす)', async () => {
    wrap(<BrowseHousingerView filtered={FILTERED} />);
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    expect(screen.getByText('Bob').closest('a')).toHaveAttribute('href', '/housing/housinger/bbb');
  });

  it('2 回目の表示では listPublishedHousingers を再度呼ばない', async () => {
    const first = wrap(<BrowseHousingerView filtered={FILTERED} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    first.unmount();
    wrap(<BrowseHousingerView filtered={FILTERED} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(listPublishedHousingersMock).toHaveBeenCalledTimes(1);
  });

  it('0 人のとき空表示', async () => {
    wrap(<BrowseHousingerView filtered={[]} />);
    await waitFor(() => expect(screen.getByText('該当するハウジンガーがいません')).toBeInTheDocument());
  });
});
