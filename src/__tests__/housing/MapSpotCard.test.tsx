// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import type { BrowseMapSpot } from '../../lib/housing/browseMapSpots';
import type { MockListing } from '../../data/housing/mockListings';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { MapSpotCard } from '../../components/housing/browse/map/MapSpotCard';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja',
      fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
      } as unknown as MediaQueryList);
  }
});

beforeEach(() => {
  navigate.mockReset();
});

let seq = 0;
function mkListing(over: Partial<MockListing> = {}): MockListing {
  seq += 1;
  return {
    id: `l-${seq}`,
    ownerUid: 'u1',
    dc: 'Mana',
    server: 'Anima',
    region: 'JP',
    area: 'Mist',
    ward: 3,
    buildingType: 'house',
    plot: 5,
    size: 'M',
    imageMode: 'none',
    tags: [],
    createdAt: 1000,
    lastConfirmedAt: 1000,
    addressKey: `k-${seq}`,
    ...over,
  };
}

function mkSpot(listings: MockListing[]): BrowseMapSpot {
  return {
    key: 'plot:5',
    kind: 'plot',
    plot: 5,
    listings,
    representative: listings[0],
  };
}

const noFlip = { x: false, y: false };

function renderCard(props: Partial<React.ComponentProps<typeof MapSpotCard>> = {}) {
  const spot = props.spot ?? mkSpot([mkListing()]);
  return render(
    <I18nextProvider i18n={i18n}>
      <MapSpotCard
        spot={spot}
        expanded={false}
        onExpand={() => {}}
        onAddToTour={() => {}}
        flip={noFlip}
        {...props}
      />
    </I18nextProvider>,
  );
}

describe('MapSpotCard — ミニカードの件数バッジ', () => {
  it('n=1 のときバッジを描画しない', () => {
    renderCard({ spot: mkSpot([mkListing()]) });
    expect(screen.queryByText('×1')).toBeNull();
  });

  it('n=3 のとき ×3 バッジを描画する', () => {
    renderCard({ spot: mkSpot([mkListing(), mkListing(), mkListing()]) });
    expect(screen.getByText('×3')).toBeTruthy();
  });
});

describe('MapSpotCard — 拡大 (ListingCard 素通し)', () => {
  it('expanded=true で ListingCard が描画され、onAddToTour が listing.id で届く', () => {
    const listing = mkListing();
    const spot = mkSpot([listing]);
    const onAddToTour = vi.fn();
    renderCard({ spot, expanded: true, onAddToTour });

    expect(screen.getByTestId('housing-listing-card')).toBeTruthy();

    const addBtn = screen.getAllByRole('button').find((btn) => btn.className.includes('housing-card-add-btn'));
    expect(addBtn).toBeTruthy();
    fireEvent.click(addBtn!);
    expect(onAddToTour).toHaveBeenCalledWith(listing.id);
  });

  it('expanded=false では ListingCard も拡大カードも描画されない', () => {
    renderCard({ expanded: false });
    expect(screen.queryByTestId('housing-listing-card')).toBeNull();
  });

  it('n=1 のときは前後ナビを描画しない', () => {
    const { container } = renderCard({ spot: mkSpot([mkListing()]), expanded: true });
    expect(container.querySelector('.housing-bmap-expanded-nav')).toBeNull();
    expect(screen.queryByLabelText('この場所の前の家へ')).toBeNull();
  });
});

describe('MapSpotCard — 複数件の前後ナビ (循環)', () => {
  it('前後ボタンで 1/3 → 2/3 → 3/3 → 1/3 と循環する', () => {
    const listings = [mkListing(), mkListing(), mkListing()];
    const spot = mkSpot(listings);
    renderCard({ spot, expanded: true });

    expect(screen.getByText('この場所の家 1/3')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('この場所の次の家へ'));
    expect(screen.getByText('この場所の家 2/3')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('この場所の次の家へ'));
    expect(screen.getByText('この場所の家 3/3')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('この場所の次の家へ'));
    expect(screen.getByText('この場所の家 1/3')).toBeTruthy(); // 循環

    fireEvent.click(screen.getByLabelText('この場所の前の家へ'));
    expect(screen.getByText('この場所の家 3/3')).toBeTruthy(); // 逆循環
  });

  it('表示中の listing が index に応じて切り替わる (ListingCard の aria-label で確認)', () => {
    const a = mkListing({ title: 'ハウスA' });
    const b = mkListing({ title: 'ハウスB' });
    const spot = mkSpot([a, b]);
    renderCard({ spot, expanded: true });

    expect(screen.getByRole('link', { name: 'ハウスA' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('この場所の次の家へ'));
    expect(screen.getByRole('link', { name: 'ハウスB' })).toBeTruthy();
  });
});

describe('MapSpotCard — Esc で閉じる', () => {
  it('拡大中に Esc を押すと onExpand(null) が呼ばれる', () => {
    const onExpand = vi.fn();
    renderCard({ expanded: true, onExpand });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExpand).toHaveBeenCalledWith(null);
  });

  it('未展開中は Esc を拾わない (listener 未登録)', () => {
    const onExpand = vi.fn();
    renderCard({ expanded: false, onExpand });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExpand).not.toHaveBeenCalled();
  });
});

describe('MapSpotCard — ミニカードの開閉トリガー', () => {
  it('クリックで onExpand(spot.key) が呼ばれ、aria-expanded が付与される', () => {
    const spot = mkSpot([mkListing()]);
    const onExpand = vi.fn();
    renderCard({ spot, onExpand, expanded: false });
    const mini = screen.getByTestId('bmap-marker-plot:5');
    expect(mini).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(mini);
    expect(onExpand).toHaveBeenCalledWith('plot:5');
  });

  it('expanded=true のとき aria-expanded="true"', () => {
    renderCard({ expanded: true });
    expect(screen.getByTestId('bmap-marker-plot:5')).toHaveAttribute('aria-expanded', 'true');
  });

  it('hover (mouseEnter) で onExpand(spot.key) が呼ばれる', () => {
    const onExpand = vi.fn();
    renderCard({ onExpand });
    fireEvent.mouseEnter(screen.getByTestId('bmap-marker-plot:5'));
    expect(onExpand).toHaveBeenCalledWith('plot:5');
  });
});

describe('MapSpotCard — flip', () => {
  it('flip.x/y が data 属性として反映される', () => {
    renderCard({ flip: { x: true, y: true } });
    const mini = screen.getByTestId('bmap-marker-plot:5');
    expect(mini).toHaveAttribute('data-flip-x', 'true');
    expect(mini).toHaveAttribute('data-flip-y', 'true');
  });

  it('flip 未指定相当 (false/false) では data 属性が false になる', () => {
    renderCard({ flip: noFlip });
    const mini = screen.getByTestId('bmap-marker-plot:5');
    expect(mini).toHaveAttribute('data-flip-x', 'false');
    expect(mini).toHaveAttribute('data-flip-y', 'false');
  });
});
