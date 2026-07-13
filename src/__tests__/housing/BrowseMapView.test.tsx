// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { BrowseMapView } from '../../components/housing/browse/map/BrowseMapView';
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

const renderView = (filtered: MockListing[] = [], onAddToTour: (id: string) => void = () => {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <BrowseMapView filtered={filtered} onAddToTour={onAddToTour} />
    </I18nextProvider>,
  );

describe('BrowseMapView', () => {
  describe('WorldSelectGate (servers.length !== 1)', () => {
    it('servers が 0件ならゲートを表示する', () => {
      renderView();
      expect(screen.getByTestId('housing-world-gate')).toBeTruthy();
    });

    it('servers が 2件以上ならゲートを表示する', () => {
      useHousingFilterStore.setState({ servers: ['Anima', 'Asura'] });
      renderView();
      expect(screen.getByTestId('housing-world-gate')).toBeTruthy();
    });

    it('servers が 1件ならゲートを表示しない (地図側へ)', () => {
      useHousingFilterStore.setState({ servers: ['Anima'] });
      renderView([mkListing({ area: 'Mist', ward: 3 })]);
      expect(screen.queryByTestId('housing-world-gate')).toBeNull();
    });

    it('DC→ワールドの順に選択すると setDC + setServerExclusive が呼ばれる', () => {
      renderView();
      fireEvent.click(screen.getByRole('button', { name: 'Mana' }));
      fireEvent.click(screen.getByRole('button', { name: 'Anima' }));
      expect(useHousingFilterStore.getState().dc).toBe('Mana');
      expect(useHousingFilterStore.getState().servers).toEqual(['Anima']);
    });

    it('dc が選択済みならそのDCのワールド一覧から開始する (DC再選択不要)', () => {
      useHousingFilterStore.setState({ dc: 'Mana' });
      renderView();
      expect(screen.getByRole('button', { name: 'Anima' })).toBeTruthy();
    });

    it('ゲート表示中に外部 (FilterPanel) が dc を変えるとワールド一覧が追従し、選択時に巻き戻らない', () => {
      useHousingFilterStore.setState({ dc: 'Mana' });
      renderView();
      // ゲートは Mana のワールド一覧から開始する
      expect(screen.getByRole('button', { name: 'Anima' })).toBeTruthy();

      // 地図モード中も常時描画される左カラム FilterPanel が同じ setDC を呼ぶケースを模す
      act(() => {
        useHousingFilterStore.setState({ dc: 'Gaia' });
      });

      // pendingDC がストアの dc 変化に追従し、ワールド一覧が Gaia のものに切り替わる
      expect(screen.queryByRole('button', { name: 'Anima' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Alexander' })).toBeTruthy();

      // Gaia のワールドを選択しても dc が Mana に無言で巻き戻らない
      fireEvent.click(screen.getByRole('button', { name: 'Alexander' }));
      expect(useHousingFilterStore.getState().dc).toBe('Gaia');
      expect(useHousingFilterStore.getState().servers).toEqual(['Alexander']);
    });

    it('ワールド選択後はゲートが自動的に外れる', () => {
      const { rerender } = renderView();
      fireEvent.click(screen.getByRole('button', { name: 'Mana' }));
      fireEvent.click(screen.getByRole('button', { name: 'Anima' }));
      rerender(
        <I18nextProvider i18n={i18n}>
          <BrowseMapView filtered={[mkListing({ area: 'Mist', ward: 3 })]} onAddToTour={() => {}} />
        </I18nextProvider>,
      );
      expect(screen.queryByTestId('housing-world-gate')).toBeNull();
    });
  });

  describe('空状態 (servers.length===1 だが findInitialWardTarget が null)', () => {
    it('このワールドに登録がない場合、空状態 + 一覧に戻るボタンを表示する', () => {
      useHousingFilterStore.setState({ servers: ['Anima'] });
      renderView([]);
      expect(screen.getByText('このワールドにはまだ登録がありません')).toBeTruthy();
      const backBtn = screen.getByRole('button', { name: '一覧に戻る' });
      fireEvent.click(backBtn);
      expect(useHousingViewStore.getState().browseView).toBe('list');
    });

    it('登録がある場合は空状態を表示しない', () => {
      useHousingFilterStore.setState({ servers: ['Anima'] });
      renderView([mkListing({ area: 'Mist', ward: 3 })]);
      expect(screen.queryByText('このワールドにはまだ登録がありません')).toBeNull();
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
      useHousingFilterStore.setState({ servers: ['Anima'] });
    });

    afterEach(() => {
      rectSpy?.mockRestore();
    });

    const renderMultiSpotView = () => {
      const listings = [
        mkListing({ area: 'Mist', ward: 3, plot: 5, buildingType: 'house' }),
        mkListing({ area: 'Mist', ward: 3, plot: 5, buildingType: 'house' }),
      ];
      return render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <BrowseMapView filtered={listings} onAddToTour={() => {}} />
          </MemoryRouter>
        </I18nextProvider>,
      );
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
