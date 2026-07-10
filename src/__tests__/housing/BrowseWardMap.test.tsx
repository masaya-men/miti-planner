// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { BrowseWardMap } from '../../components/housing/browse/map/BrowseWardMap';
import { useWardMapAsset, type WardMapAssetState } from '../../lib/housing/useWardMapAsset';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { BrowseMapSpot } from '../../lib/housing/browseMapSpots';
import type { MockListing } from '../../data/housing/mockListings';

// useWardMapAsset をモックし、テストごとに ready/loading/error を切り替える (task-4-brief Step1)。
vi.mock('../../lib/housing/useWardMapAsset', () => ({
  useWardMapAsset: vi.fn(),
}));

// happy-dom が ResizeObserver を持たない場合に備えてポリフィル (LiquidGlassPanel.test.tsx 踏襲)。
beforeAll(() => {
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
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
  useHousingViewStore.getState().reset();
  vi.mocked(useWardMapAsset).mockReset();
});

const mockJson: WardMapJson = {
  area: 'Mist',
  viewBox: { w: 100, h: 100 },
  nodes: [],
  edges: [],
  houses: [
    { kind: 'plot', plot: 5, x: 0.3, y: 0.4, node: null, outline: null },
    { kind: 'apart', plot: 1, x: 0.7, y: 0.2, node: null, outline: null },
  ],
  roadPath: '',
  visibleRoadPath: null,
};

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

function mkSpot(over: Partial<BrowseMapSpot>): BrowseMapSpot {
  const listing = mkListing();
  return {
    key: 'plot:5',
    kind: 'plot',
    plot: 5,
    listings: [listing],
    representative: listing,
    ...over,
  };
}

const spots: BrowseMapSpot[] = [
  mkSpot({ key: 'plot:5', kind: 'plot', plot: 5 }),
  mkSpot({ key: 'apart:1', kind: 'apart', plot: 1 }),
];

const renderMap = (props: Partial<React.ComponentProps<typeof BrowseWardMap>> = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <BrowseWardMap
        mapKey="mist"
        spots={spots}
        expandedKey={null}
        onExpand={() => {}}
        onAddToTour={() => {}}
        {...props}
      />
    </I18nextProvider>,
  );

describe('BrowseWardMap', () => {
  it('ready 時、spots 2件からマーカーが2個描画される', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
    renderMap();
    expect(screen.getByTestId('bmap-marker-plot:5')).toBeTruthy();
    expect(screen.getByTestId('bmap-marker-apart:1')).toBeTruthy();
  });

  it('loading 時は静かな文言を表示し、マーカーは描画しない', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'loading' } as WardMapAssetState);
    renderMap();
    expect(screen.getByTestId('bmap-loading')).toBeTruthy();
    expect(screen.queryByTestId('bmap-marker-plot:5')).toBeNull();
  });

  it('error 時は load_error 文言 + 一覧に戻るボタンを表示する', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'error' } as WardMapAssetState);
    renderMap();
    expect(screen.getByText('地図を読み込めませんでした')).toBeTruthy();
    const backBtn = screen.getByRole('button', { name: '一覧に戻る' });
    fireEvent.click(backBtn);
    expect(useHousingViewStore.getState().browseView).toBe('list');
  });

  it('地図の空白クリックで onExpand(null) が呼ばれる', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
    const onExpand = vi.fn();
    renderMap({ onExpand });
    fireEvent.click(screen.getByTestId('bmap-wrap'));
    expect(onExpand).toHaveBeenCalledWith(null);
  });

  it('座標が見つからないスポットはスキップし、クラッシュしない', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
    const badSpot = mkSpot({ key: 'plot:99', kind: 'plot', plot: 99 });
    expect(() => renderMap({ spots: [...spots, badSpot] })).not.toThrow();
    expect(screen.queryByTestId('bmap-marker-plot:99')).toBeNull();
  });
});
