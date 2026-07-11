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

import {
  MapSpotCard,
  HOVER_INTENT_DELAY_MS,
  HOVER_CLOSE_DELAY_MS,
} from '../../components/housing/browse/map/MapSpotCard';

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
// クランプ計算 (Finding2) に十分な余裕を持たせたデフォルトの位置/コンテナ実寸。
// 値そのものを検証したいテストはこれらを明示的に上書きする (下記「拡大カードのコンテナ内クランプ」参照)。
const defaultMarkerPos = { x: 400, y: 300 };
const defaultWrapSize = { w: 900, h: 500 };

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
        markerPos={defaultMarkerPos}
        wrapSize={defaultWrapSize}
        gestureActiveRef={{ current: false }}
        {...props}
      />
    </I18nextProvider>,
  );
}

describe('MapSpotCard — 常時マウント (1 枚カードが scale 拡大)', () => {
  it('expanded=false でも ListingCard を常時描画する (縮小表示・hover ごとの mount/unmount をしない)', () => {
    renderCard({ expanded: false });
    expect(screen.getByTestId('housing-listing-card')).toBeTruthy();
  });

  it('expanded=true でも ListingCard を描画し、onAddToTour が listing.id で届く', () => {
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

  it('data-expanded が expanded prop を反映する (CSS の scale 切替の元)', () => {
    renderCard({ expanded: true });
    expect(screen.getByTestId('bmap-card-plot:5')).toHaveAttribute('data-expanded', 'true');
  });

  it('expanded=false のとき data-expanded="false"', () => {
    renderCard({ expanded: false });
    expect(screen.getByTestId('bmap-card-plot:5')).toHaveAttribute('data-expanded', 'false');
  });

  it('n=1 のときは前後ナビを描画しない', () => {
    const { container } = renderCard({ spot: mkSpot([mkListing()]), expanded: true });
    expect(container.querySelector('.housing-bmap-card-nav')).toBeNull();
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

describe('MapSpotCard — hover で拡大するトリガー', () => {
  it('focus (キーボード/タッチ) は hover ディレイを待たず即座に onExpand(spot.key) を呼ぶ', () => {
    const spot = mkSpot([mkListing()]);
    const onExpand = vi.fn();
    renderCard({ spot, onExpand, expanded: false });
    // focus は card の onFocus (focusin バブル) が拾う。ListingCard(role=link)を focus して確認。
    fireEvent.focus(screen.getByRole('link'));
    expect(onExpand).toHaveBeenCalledWith('plot:5');
  });

  it('hover (mouseEnter) は即座には展開せず、HOVER_INTENT_DELAY_MS 経過後に onExpand(spot.key) が呼ばれる', () => {
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      renderCard({ onExpand });
      fireEvent.mouseEnter(screen.getByTestId('bmap-card-plot:5'));
      expect(onExpand).not.toHaveBeenCalled(); // 遅延中はまだ呼ばれない

      vi.advanceTimersByTime(HOVER_INTENT_DELAY_MS - 1);
      expect(onExpand).not.toHaveBeenCalled(); // 満了直前もまだ

      vi.advanceTimersByTime(1);
      expect(onExpand).toHaveBeenCalledWith('plot:5');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hover-intent ディレイ中に mouseLeave すると展開されない (フルに時間が経過しても呼ばれない)', () => {
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      renderCard({ onExpand });
      const mini = screen.getByTestId('bmap-card-plot:5');
      fireEvent.mouseEnter(mini);
      vi.advanceTimersByTime(HOVER_INTENT_DELAY_MS / 2);
      fireEvent.mouseLeave(mini);
      vi.advanceTimersByTime(HOVER_INTENT_DELAY_MS * 2);
      expect(onExpand).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('地図ジェスチャー中 (gestureActiveRef.current=true) は hover しても展開を予約しない', () => {
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      const gestureActiveRef = { current: true };
      renderCard({ onExpand, gestureActiveRef });
      fireEvent.mouseEnter(screen.getByTestId('bmap-card-plot:5'));
      vi.advanceTimersByTime(HOVER_INTENT_DELAY_MS * 2);
      expect(onExpand).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('hover ディレイ開始後にジェスチャーが始まった場合、発火時点で再チェックし展開しない', () => {
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      const gestureActiveRef = { current: false };
      renderCard({ onExpand, gestureActiveRef });
      fireEvent.mouseEnter(screen.getByTestId('bmap-card-plot:5'));
      gestureActiveRef.current = true; // ディレイ中にドラッグ (パン/ピンチ) が始まった想定
      vi.advanceTimersByTime(HOVER_INTENT_DELAY_MS);
      expect(onExpand).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

// 2026-07-12 ユーザー要望: マウスは「乗っている間だけ拡大、外したら畳む」。1 枚カードなので
// 受け渡し隙間は無いが、端のクランプ移動での際どい離脱に備え離脱は HOVER_CLOSE_DELAY_MS の猶予付き。
describe('MapSpotCard — hover で畳む (2026-07-12)', () => {
  it('拡大中にカードから mouseLeave すると HOVER_CLOSE_DELAY_MS 経過後に onExpand(null) が呼ばれる', () => {
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      renderCard({ onExpand, expanded: true });
      fireEvent.mouseLeave(screen.getByTestId('bmap-card-plot:5'));
      expect(onExpand).not.toHaveBeenCalled(); // 猶予中はまだ畳まない
      vi.advanceTimersByTime(HOVER_CLOSE_DELAY_MS - 1);
      expect(onExpand).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onExpand).toHaveBeenCalledWith(null);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mouseLeave 後、猶予内に再び mouseEnter すれば畳まれない (際どい離脱の誤クローズ吸収)', () => {
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      renderCard({ onExpand, expanded: true });
      const card = screen.getByTestId('bmap-card-plot:5');
      fireEvent.mouseLeave(card); // 畳む予約
      vi.advanceTimersByTime(HOVER_CLOSE_DELAY_MS / 2);
      fireEvent.mouseEnter(card); // 猶予内に戻る
      vi.advanceTimersByTime(HOVER_CLOSE_DELAY_MS * 2);
      expect(onExpand).not.toHaveBeenCalled(); // 畳まれない
    } finally {
      vi.useRealTimers();
    }
  });

  it('未拡大のカードを素通り (enter→intent 前に leave) しても onExpand は一切呼ばれない (誤クローズを出さない)', () => {
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      renderCard({ onExpand, expanded: false });
      const card = screen.getByTestId('bmap-card-plot:5');
      fireEvent.mouseEnter(card);
      vi.advanceTimersByTime(HOVER_INTENT_DELAY_MS / 2);
      fireEvent.mouseLeave(card);
      vi.advanceTimersByTime(HOVER_INTENT_DELAY_MS + HOVER_CLOSE_DELAY_MS);
      expect(onExpand).not.toHaveBeenCalled(); // 開きも畳みもしない
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('MapSpotCard — flip', () => {
  it('flip.x/y が data 属性として反映される', () => {
    renderCard({ flip: { x: true, y: true } });
    const mini = screen.getByTestId('bmap-card-plot:5');
    expect(mini).toHaveAttribute('data-flip-x', 'true');
    expect(mini).toHaveAttribute('data-flip-y', 'true');
  });

  it('flip 未指定相当 (false/false) では data 属性が false になる', () => {
    renderCard({ flip: noFlip });
    const mini = screen.getByTestId('bmap-card-plot:5');
    expect(mini).toHaveAttribute('data-flip-x', 'false');
    expect(mini).toHaveAttribute('data-flip-y', 'false');
  });
});

// Finding2: 拡大カードがマウント時に自身の実寸を測定し、clampExpandedCardOffset (純関数、
// mapCardClamp.test.ts で個別に検証済み) の結果を CSS カスタムプロパティとして反映することを、
// 実際のコンポーネントの配線を通して確認する (ここでは getBoundingClientRect をモックして
// 「測定されたカード実寸」を固定する。happy-dom は実レイアウトを行わないため既定は 0×0 になる)。
describe('MapSpotCard — 拡大カードのコンテナ内クランプ (Finding2)', () => {
  it('上端寄りスポット(flipY=true)でコンテナが低いと --housing-bmap-clamp-y が負の値になり、CSS 側の calc() でカード下端がコンテナ内に収まる', () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 280, height: 300, top: 0, left: 0, right: 280, bottom: 300, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    try {
      renderCard({
        spot: mkSpot([mkListing()]),
        expanded: true,
        flip: { x: false, y: true },
        markerPos: { x: 400, y: 15 },
        wrapSize: { w: 900, h: 300 },
      });
      const expandedEl = screen.getByTestId('bmap-card-plot:5');
      // top=15+14=29, bottom=29+300=329 > 300-8=292 → dy = 292-329 = -37 (mapCardClamp.test.ts と同じ式)。
      expect(expandedEl.style.getPropertyValue('--housing-bmap-clamp-y')).toBe('-37px');
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('コンテナ中央付近のスポットでは --housing-bmap-clamp-x/-y が 0px のまま (flip のみの従来位置)', () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 280, height: 270, top: 0, left: 0, right: 280, bottom: 270, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    try {
      renderCard({
        spot: mkSpot([mkListing()]),
        expanded: true,
        flip: noFlip,
        markerPos: { x: 450, y: 300 },
        wrapSize: { w: 900, h: 500 },
      });
      const expandedEl = screen.getByTestId('bmap-card-plot:5');
      expect(expandedEl.style.getPropertyValue('--housing-bmap-clamp-x')).toBe('0px');
      expect(expandedEl.style.getPropertyValue('--housing-bmap-clamp-y')).toBe('0px');
    } finally {
      rectSpy.mockRestore();
    }
  });
});
