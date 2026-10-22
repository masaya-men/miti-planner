// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { MockListing } from '../../../../data/housing/mockListings';
import { useHousingListOrderStore } from '../../../../store/useHousingListOrderStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../ListingCard', () => ({
  ListingCard: ({ listing }: { listing: { id: string } }) => <div data-testid="card">{listing.id}</div>,
}));
vi.mock('../HiddenListingCard', () => ({ HiddenListingCard: () => <div data-testid="card" /> }));
vi.mock('../BrowseSortSelect', () => ({ BrowseSortSelect: () => null }));
vi.mock('../../../../lib/scroll/useSmoothWheelScroll', () => ({ useSmoothWheelScroll: () => {} }));

import { ListingGrid, LISTING_INITIAL_COUNT, LISTING_STEP_COUNT } from '../ListingGrid';

// IntersectionObserver モック: テストから「見張りが見えた」を発火できる
let ioCallbacks: IntersectionObserverCallback[] = [];
class MockIO {
  constructor(cb: IntersectionObserverCallback) { ioCallbacks.push(cb); }
  observe() {}
  unobserve() {}
  disconnect() {}
}
const fireVisible = () =>
  act(() => {
    const cb = ioCallbacks[ioCallbacks.length - 1];
    cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });

const make = (n: number, prefix = 'a'): MockListing[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }) as unknown as MockListing);

const renderGrid = (listings: MockListing[], sort: 'newest' | 'oldest' = 'newest') => {
  const ui = (l: MockListing[], s: 'newest' | 'oldest') => (
    <ListingGrid listings={l} sort={s} onSortChange={() => {}} listKey="browse" />
  );
  const r = render(ui(listings, sort));
  return { ...r, rerenderWith: (l: MockListing[], s: 'newest' | 'oldest' = sort) => r.rerender(ui(l, s)) };
};

beforeEach(() => {
  ioCallbacks = [];
  vi.stubGlobal('IntersectionObserver', MockIO);
  useHousingListOrderStore.getState().reset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ListingGrid 段階描画', () => {
  it('100 件渡すと最初は INITIAL 枚だけ描き、見張りがある', () => {
    renderGrid(make(100));
    expect(screen.getAllByTestId('card')).toHaveLength(LISTING_INITIAL_COUNT);
    expect(screen.getByTestId('listing-grid-sentinel')).toBeTruthy();
  });

  it('見張りが見えたら STEP 枚増え、全件描いたら見張りが消える', () => {
    renderGrid(make(100));
    fireVisible();
    expect(screen.getAllByTestId('card')).toHaveLength(LISTING_INITIAL_COUNT + LISTING_STEP_COUNT);
    fireVisible();
    expect(screen.getAllByTestId('card')).toHaveLength(100);
    expect(screen.queryByTestId('listing-grid-sentinel')).toBeNull();
  });

  it('件数が少ない時は全件で見張りなし', () => {
    renderGrid(make(10));
    expect(screen.getAllByTestId('card')).toHaveLength(10);
    expect(screen.queryByTestId('listing-grid-sentinel')).toBeNull();
  });

  it('並び替えで最初の枚数に戻る', () => {
    const { rerenderWith } = renderGrid(make(100));
    fireVisible();
    expect(screen.getAllByTestId('card').length).toBeGreaterThan(LISTING_INITIAL_COUNT);
    rerenderWith(make(100, 'b'), 'oldest');
    expect(screen.getAllByTestId('card')).toHaveLength(LISTING_INITIAL_COUNT);
  });

  it('先頭 1 件が消えただけ (お気に入り解除) では枚数を戻さない', () => {
    const list = make(100);
    const { rerenderWith } = renderGrid(list);
    fireVisible();
    const n = screen.getAllByTestId('card').length;
    rerenderWith(list.slice(1));
    expect(screen.getAllByTestId('card')).toHaveLength(n);
  });

  it('保存スクロール位置が深い時は、そこまで届く枚数を描いてから復元する', () => {
    useHousingListOrderStore.getState().setScrollTop('browse', 5000);
    // 1 枚 100px・画面 500px のグリッドを再現 (scrollHeight は描画枚数に比例)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('housing-listing-grid') ? this.querySelectorAll('[data-testid="card"]').length * 100 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('housing-listing-grid') ? 500 : 0;
    });
    renderGrid(make(274));
    const grid = document.querySelector('.housing-listing-grid') as HTMLElement;
    const drawn = screen.getAllByTestId('card').length;
    // 5000 + 500 px に届く 55 枚以上は描いている (全件ではない)
    expect(drawn).toBeGreaterThanOrEqual(55);
    expect(drawn).toBeLessThan(274);
    expect(grid.scrollTop).toBe(5000);
    vi.restoreAllMocks();
  });
});
