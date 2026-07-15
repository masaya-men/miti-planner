// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { HousingDetailMap } from '../HousingDetailMap';
import type { HousingListing } from '../../../../types/housing';
import type { MockListing } from '../../../../data/housing/mockListings';
import type { WardMapJson } from '../../../../data/housing/wardMapManifest';
import { resolveWardMapRef } from '../../../../lib/housing/resolveWardMapRef';
import { useWardMapAsset } from '../../../../lib/housing/useWardMapAsset';
import { buildTourMapPlacements } from '../../../../lib/housing/buildTourMapPlacements';
import { firestoreToGalleryListing } from '../../../../lib/housing/galleryAdapter';
import { getPlotDirections } from '../../../../lib/housing/wardDirections';

// TourNavMap をスタブ化して「呼ばれたか」+ 実際に渡された props 配線を data-* で観測
vi.mock('../../tour/TourNavMap', () => ({
  TourNavMap: (p: {
    status: string;
    stepKey: string | number;
    originName?: string | null;
    svg: string | null;
  }) => (
    <div
      data-testid="tour-nav-map"
      data-status={p.status}
      data-step-key={String(p.stepKey)}
      data-origin-name={p.originName ?? ''}
      data-has-svg={p.svg != null ? '1' : '0'}
    />
  ),
}));

vi.mock('../../../../lib/housing/resolveWardMapRef', () => ({
  resolveWardMapRef: vi.fn(),
}));
vi.mock('../../../../lib/housing/useWardMapAsset', () => ({
  useWardMapAsset: vi.fn(),
}));
vi.mock('../../../../lib/housing/buildTourMapPlacements', () => ({
  buildTourMapPlacements: vi.fn(),
}));
vi.mock('../../../../lib/housing/galleryAdapter', () => ({
  firestoreToGalleryListing: vi.fn(),
}));
vi.mock('../../../../lib/housing/wardDirections', () => ({
  getPlotDirections: vi.fn(),
}));

const mockResolveWardMapRef = vi.mocked(resolveWardMapRef);
const mockUseWardMapAsset = vi.mocked(useWardMapAsset);
const mockBuildTourMapPlacements = vi.mocked(buildTourMapPlacements);
const mockFirestoreToGalleryListing = vi.mocked(firestoreToGalleryListing);
const mockGetPlotDirections = vi.mocked(getPlotDirections);

it('mapRef 引けない物件では何も描画しない(null)', () => {
  mockResolveWardMapRef.mockReturnValue(null);
  mockUseWardMapAsset.mockReturnValue({ status: 'idle' });
  mockFirestoreToGalleryListing.mockReturnValue(null);
  mockGetPlotDirections.mockReturnValue(null);

  const listing = { id: 'x', area: 'Unknown', plot: null, buildingType: 'house' } as unknown as HousingListing;
  const { queryByTestId } = render(<HousingDetailMap listing={listing} />);
  expect(queryByTestId('tour-nav-map')).toBeNull();
});

it('P3 §3.5/Task6 (防御多重化): unlisted は mapRef が解決できても地図を一切描画しない (座標が DOM に漏れない)', () => {
  // mapRef/asset が「もし呼ばれたら」描画されてしまう値をあえて用意し、
  // それでも isAddressHidden の早期 return が座標計算そのものを止めることを検証する。
  mockResolveWardMapRef.mockReturnValue({
    mapKey: 'mist',
    highlightPlot: 3,
    highlightKind: 'plot',
    elementId: 'plot_3',
  });
  mockUseWardMapAsset.mockReturnValue({
    status: 'ready',
    svg: '<svg></svg>',
    json: { viewBox: { w: 100, h: 100 } } as unknown as WardMapJson,
  });
  // 座標由来の値が返っても unlisted では描画に至らない (漏洩しない) ことを確認する。
  mockGetPlotDirections.mockReturnValue({ aetheryte: 'Should Not Appear', directions: '道なり' });

  const listing = {
    id: 'unlisted-1',
    visibility: 'unlisted',
    area: 'Mist',
    plot: 3,
    buildingType: 'house',
  } as unknown as HousingListing;

  // 防御多重化 (§8.5): unlisted は mapRef が解決できても地図 (TourNavMap) を一切描画しない。
  // 座標由来の計算自体は rules-of-hooks 順守のため走るが、DOM に出ない=漏洩しない。
  const { container, queryByTestId } = render(<HousingDetailMap listing={listing} />);
  expect(queryByTestId('tour-nav-map')).toBeNull();
  expect(container.firstChild).toBeNull();
  expect(container.textContent).not.toContain('Should Not Appear');
});

it('mapRef 解決 + asset ready で TourNavMap に status=ready を配線し、buildTourMapPlacements を実際の変換結果で呼ぶ', () => {
  const mapRef = { mapKey: 'mist', highlightPlot: 3, highlightKind: 'plot' as const, elementId: 'plot_3' };
  mockResolveWardMapRef.mockReturnValue(mapRef);

  const svg = '<svg data-test="mist"></svg>';
  const json = { viewBox: { w: 100, h: 100 } } as unknown as WardMapJson;
  mockUseWardMapAsset.mockReturnValue({ status: 'ready', svg, json });

  const galleryListing = { id: 'listing-1', area: 'Mist', plot: 3, buildingType: 'house' } as unknown as MockListing;
  mockFirestoreToGalleryListing.mockReturnValue(galleryListing);

  mockBuildTourMapPlacements.mockReturnValue({
    target: { x: 1, y: 2 },
    placed: [],
    routePath: null,
    routeJumpPath: null,
    origin: null,
    originName: 'Model Aetheryte', // directions が引ける場合は下の優先順で上書きされる想定
    targetElId: 'plot_3',
    targetOutline: null,
  });

  // directions 側が引ける場合は model.originName より優先される (HousingDetailMap.tsx の
  // `directions?.aetheryte ?? model?.originName ?? null` の実配線を検証する)。
  mockGetPlotDirections.mockReturnValue({ aetheryte: 'Directions Aetheryte', directions: '道なり' });

  const listing = {
    id: 'listing-1',
    area: 'Mist',
    plot: 3,
    buildingType: 'house',
  } as unknown as HousingListing;

  const { getByTestId } = render(<HousingDetailMap listing={listing} />);
  const el = getByTestId('tour-nav-map');
  expect(el.dataset.status).toBe('ready');
  expect(el.dataset.stepKey).toBe('0');
  expect(el.dataset.hasSvg).toBe('1');
  expect(el.dataset.originName).toBe('Directions Aetheryte');

  // wiring: firestoreToGalleryListing の変換結果が steps[0].listing として buildTourMapPlacements に渡る
  expect(mockBuildTourMapPlacements).toHaveBeenCalledWith(
    json,
    mapRef.mapKey,
    mapRef,
    galleryListing,
    [{ id: galleryListing.id, listing: galleryListing }],
    0,
  );
});
