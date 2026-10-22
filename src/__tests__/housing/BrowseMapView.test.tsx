// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { BrowseMapView } from '../../components/housing/browse/map/BrowseMapView';
import { buildMapIndex } from '../../lib/housing/browseMapIndex';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { useWardMapAsset, type WardMapAssetState } from '../../lib/housing/useWardMapAsset';
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { MockListing } from '../../data/housing/mockListings';

// 大量部屋パネル配線テスト (Task6) のために useWardMapAsset をモックする (BrowseWardMap.test.tsx の
// 流儀を踏襲)。既存の WorldSelectGate/空状態テストはマップ内部の状態を検証しないため、既定値
// (loading) のままでも影響を受けない。
vi.mock('../../lib/housing/useWardMapAsset', () => ({
  useWardMapAsset: vi.fn(() => ({ status: 'loading' }) as WardMapAssetState),
}));

// MockListing は必須フィールドが多いため最小限を埋めるフィクスチャビルダー
// (browseMapSpots.test.ts の mkListing パターンを踏襲)。
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

beforeAll(() => {
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
  useHousingFilterStore.getState().clearAll();
  useHousingViewStore.getState().reset();
});

const renderView = (
  listings: MockListing[] = [],
  onAddToTour: (id: string) => void = () => {},
  onOpenDcMenu: () => void = () => {},
) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BrowseMapView
          listings={listings}
          index={buildMapIndex(listings)}
          onAddToTour={onAddToTour}
          onOpenDcMenu={onOpenDcMenu}
        />
      </MemoryRouter>
    </I18nextProvider>,
  );

const pressed = (testId: string) => screen.getByTestId(testId).getAttribute('aria-pressed');

// Mana: Anima は Mist 3区(本街 plot5)×3 が最多、Asura は 2 件。Anima の Goblet 7区は拡張街(plot 35)が 2 件。
const manaPool = (): MockListing[] => [
  mkListing({ server: 'Anima', area: 'Mist', ward: 3, plot: 5 }),
  mkListing({ server: 'Anima', area: 'Mist', ward: 3, plot: 6 }),
  mkListing({ server: 'Anima', area: 'Mist', ward: 3, plot: 7 }),
  mkListing({ server: 'Anima', area: 'Mist', ward: 8, plot: 1 }),
  mkListing({ server: 'Anima', area: 'Goblet', ward: 7, plot: 35 }),
  mkListing({ server: 'Anima', area: 'Goblet', ward: 7, plot: 36 }),
  mkListing({ server: 'Asura', area: 'Shirogane', ward: 2, plot: 4 }),
  mkListing({ server: 'Asura', area: 'Shirogane', ward: 2, plot: 5 }),
];

describe('BrowseMapView', () => {
  describe('DC 未選択', () => {
    it('DC が未選択なら「DC を選ぶ」案内を出し、ボタンで DC メニューを開く依頼が飛ぶ', () => {
      const onOpen = vi.fn();
      renderView(manaPool(), () => {}, onOpen);
      expect(screen.queryByTestId('housing-map-rail')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'データセンターを選ぶ' }));
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('DC を選んだ時の自動選択と store 連動', () => {
    it('dc だけ選ばれていれば、その DC で最多のワールド・エリア・区・種別が選ばれ store の servers に反映される', () => {
      useHousingFilterStore.setState({ dc: 'Mana' });
      renderView(manaPool());
      expect(useHousingFilterStore.getState().servers).toEqual(['Anima']);
      expect(pressed('housing-maprail-world-Anima')).toBe('true');
      expect(pressed('housing-maprail-area-Mist')).toBe('true');
      expect(pressed('housing-maprail-ward-3')).toBe('true');
      expect(pressed('housing-maprail-kind-main')).toBe('true');
      expect(screen.getByTestId('housing-map-here').textContent).toContain('Anima');
    });

    it('左の絞り込みで既に 1 ワールドが選ばれていれば、それが初期値になる (store は書き換えない)', () => {
      useHousingFilterStore.setState({ dc: 'Mana', servers: ['Asura'] });
      renderView(manaPool());
      expect(pressed('housing-maprail-world-Asura')).toBe('true');
      expect(pressed('housing-maprail-area-Shirogane')).toBe('true');
      expect(pressed('housing-maprail-ward-2')).toBe('true');
      expect(useHousingFilterStore.getState().servers).toEqual(['Asura']);
    });

    it('その DC に家が 1 件も無ければ空状態を出す', () => {
      useHousingFilterStore.setState({ dc: 'Gaia' });
      renderView(manaPool());
      expect(screen.getByText('このワールドにはまだ登録がありません')).toBeTruthy();
    });
  });

  describe('案内板の切替で下位が最多へ自動選択される', () => {
    beforeEach(() => {
      useHousingFilterStore.setState({ dc: 'Mana' });
    });

    it('ワールドを替えると store の servers が替わり、エリア・区・種別がそのワールドの最多になる', () => {
      renderView(manaPool());
      fireEvent.click(screen.getByTestId('housing-maprail-world-Asura'));
      expect(useHousingFilterStore.getState().servers).toEqual(['Asura']);
      expect(pressed('housing-maprail-world-Asura')).toBe('true');
      expect(pressed('housing-maprail-area-Shirogane')).toBe('true');
      expect(pressed('housing-maprail-ward-2')).toBe('true');
    });

    it('エリアを替えると、そのエリアで最多の区と種別が選ばれる (拡張街側が多ければ拡張街)', () => {
      renderView(manaPool());
      fireEvent.click(screen.getByTestId('housing-maprail-area-Goblet'));
      expect(pressed('housing-maprail-ward-7')).toBe('true');
      expect(pressed('housing-maprail-kind-sub')).toBe('true');
      expect(screen.getByTestId('housing-browse-map-view').getAttribute('data-map-kind')).toBe('sub');
    });

    it('家の無いエリアは押せない', () => {
      renderView(manaPool());
      const empty = screen.getByTestId('housing-maprail-area-Empyreum') as HTMLButtonElement;
      expect(empty.disabled).toBe(true);
    });

    it('区タイルは家のある区だけ並び、区を替えると件数の多い側の種別が選ばれる', () => {
      renderView(manaPool());
      expect(screen.queryByTestId('housing-maprail-ward-4')).toBeNull();
      expect(screen.getByTestId('housing-maprail-ward-8')).toBeTruthy();
      fireEvent.click(screen.getByTestId('housing-maprail-ward-8'));
      expect(pressed('housing-maprail-ward-8')).toBe('true');
      expect(pressed('housing-maprail-kind-main')).toBe('true');
    });

    it('本街/拡張街の件数を出し、0 件側は押せない', () => {
      renderView(manaPool());
      const main = screen.getByTestId('housing-maprail-kind-main') as HTMLButtonElement;
      const sub = screen.getByTestId('housing-maprail-kind-sub') as HTMLButtonElement;
      expect(main.textContent).toContain('3');
      expect(sub.textContent).toContain('0');
      expect(sub.disabled).toBe(true);
      expect(main.disabled).toBe(false);
    });
  });

  // 大量部屋パネル配線 (Task6): 複数スポット (listings>=2) の「N件を見る」→ パネル表示 →
  // 戻る/Esc で閉じる、を検証する。useWardMapAsset を ready モックしマーカーを実描画させる必要が
  // あり、RoomListPanel/MapSpotCard は内部で ListingCard (react-router の useNavigate) を使うため
  // MemoryRouter で包む (BrowseWardMap.test.tsx の mock/フィクスチャ流儀を踏襲)。
  // jsdom/happy-dom 上の検証であり、パン/ズーム込みの実座標描画やスクロール挙動までは検証しない
  // (最終確認はブリーフ Step5 のユーザー実機チェックに委ねる)。
  describe('大量部屋パネル配線 (Task6)', () => {
    let rectSpy: ReturnType<typeof vi.spyOn> | undefined;
    const WRAP_RECT = {
      width: 300,
      height: 200,
      top: 0,
      left: 0,
      right: 300,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;

    const mockJson: WardMapJson = {
      area: 'Mist',
      viewBox: { w: 100, h: 100 },
      nodes: [],
      edges: [],
      houses: [{ kind: 'plot', plot: 5, x: 0.3, y: 0.4, node: null, outline: null }],
      roadPath: '',
      visibleRoadPath: null,
    };

    beforeAll(() => {
      if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
          observe() {}
          unobserve() {}
          disconnect() {}
        };
      }
    });

    beforeEach(() => {
      vi.mocked(useWardMapAsset).mockReturnValue({
        status: 'ready',
        json: mockJson,
        svg: '<svg data-mock="1"></svg>',
      } as WardMapAssetState);
      rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(WRAP_RECT);
      useHousingFilterStore.setState({ dc: 'Mana', servers: ['Anima'] });
    });

    afterEach(() => {
      rectSpy?.mockRestore();
    });

    const renderMultiSpotView = () => {
      const listings = [
        mkListing({ area: 'Mist', ward: 3, plot: 5, buildingType: 'house' }),
        mkListing({ area: 'Mist', ward: 3, plot: 5, buildingType: 'house' }),
      ];
      return renderView(listings);
    };

    it('複数スポットの「N件を見る」でパネルが開き、戻るで閉じる', () => {
      renderMultiSpotView();

      fireEvent.click(screen.getByRole('button', { name: /件を見る/ }));
      expect(screen.getByTestId('bmap-roompanel')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: '地図に戻る' }));
      expect(screen.queryByTestId('bmap-roompanel')).toBeNull();
    });

    it('パネル表示中に Esc を押すと閉じる', () => {
      renderMultiSpotView();

      fireEvent.click(screen.getByRole('button', { name: /件を見る/ }));
      expect(screen.getByTestId('bmap-roompanel')).toBeTruthy();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('bmap-roompanel')).toBeNull();
    });
  });
});
