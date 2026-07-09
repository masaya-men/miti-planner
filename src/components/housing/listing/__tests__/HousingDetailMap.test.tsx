// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { HousingDetailMap } from '../HousingDetailMap';
import type { HousingListing } from '../../../../types/housing';

// TourNavMap をスタブ化して「呼ばれたか」だけ観測
vi.mock('../../tour/TourNavMap', () => ({
  TourNavMap: (p: { status: string }) => <div data-testid="tour-nav-map" data-status={p.status} />,
}));
// mapRef が引けないケース: resolveWardMapRef が null
vi.mock('../../../../lib/housing/resolveWardMapRef', () => ({
  resolveWardMapRef: () => null,
}));

it('mapRef 引けない物件では何も描画しない(null)', () => {
  const listing = { id: 'x', area: 'Unknown', plot: null, buildingType: 'house' } as unknown as HousingListing;
  const { queryByTestId } = render(<HousingDetailMap listing={listing} />);
  expect(queryByTestId('tour-nav-map')).toBeNull();
});
