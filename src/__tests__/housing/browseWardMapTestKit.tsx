/**
 * BrowseWardMap.*.test.tsx 共通の準備 (テストデータ・描画関数・環境の用意)。
 * vi.mock は hoist されるため各テストファイルに直接書く。
 */
import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { BrowseWardMap } from '../../components/housing/browse/map/BrowseWardMap';
import { useWardMapAsset } from '../../lib/housing/useWardMapAsset';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { BrowseMapSpot } from '../../lib/housing/browseMapSpots';
import type { MockListing } from '../../data/housing/mockListings';

// コンテナ rect のモック(ズーム/パン変換テスト用)。happy-dom はレイアウトを行わないため
// getBoundingClientRect は既定で全 0 を返す(既存テストはこれでも成立=フィット計算が早期 return するだけ)。
// ズーム/パン変換のテストではフィット計算(BrowseWardMap.tsx のコンテナ実寸 contain フィット)を
// 実際に走らせる必要があるため、全テスト共通で固定サイズの矩形を返すようにする。
let rectSpy: ReturnType<typeof vi.spyOn> | undefined;
const WRAP_RECT = { width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

/** テストファイルの先頭で呼ぶ (ResizeObserver・i18n・矩形モックの用意と後始末を登録する)。 */
export function installBrowseWardMapEnv(): void {
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
    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(WRAP_RECT);
  });

  afterEach(() => {
    rectSpy?.mockRestore();
  });
}

export const mockJson: WardMapJson = {
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

export function mkSpot(over: Partial<BrowseMapSpot>): BrowseMapSpot {
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

export const spots: BrowseMapSpot[] = [
  mkSpot({ key: 'plot:5', kind: 'plot', plot: 5 }),
  mkSpot({ key: 'apart:1', kind: 'apart', plot: 1 }),
];

export const renderMap = (props: Partial<React.ComponentProps<typeof BrowseWardMap>> = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BrowseWardMap
          mapKey="mist"
          spots={spots}
          expandedKey={null}
          onExpand={() => {}}
          onAddToTour={() => {}}
          onOpenPanel={() => {}}
          {...props}
        />
      </MemoryRouter>
    </I18nextProvider>,
  );
