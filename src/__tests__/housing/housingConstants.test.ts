import { describe, it, expect } from 'vitest';
import {
  HOUSING_LIMITS,
  WARD_RANGE,
  PLOT_RANGE,
  APARTMENT_ROOM_RANGE,
  REPORT_AUTO_HIDE_THRESHOLD,
  REGISTRATION_INITIAL_BONUS,
  REGISTRATION_DAILY_QUOTA,
  HOUSING_ROUTES,
  buildListingDetailPath,
  buildTourDetailPath,
} from '../../constants/housing';

describe('housingConstants', () => {
  it('限度値定数が論理整合性を持つ', () => {
    expect(HOUSING_LIMITS.MAX_TAGS_PER_LISTING).toBeGreaterThan(0);
    expect(HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH).toBeGreaterThan(0);
    expect(HOUSING_LIMITS.MAX_TOUR_TITLE_LENGTH).toBeGreaterThan(0);
  });

  it('Ward / Plot 範囲が現実的', () => {
    expect(WARD_RANGE.min).toBe(1);
    expect(WARD_RANGE.max).toBeGreaterThanOrEqual(30);
    expect(PLOT_RANGE.min).toBe(1);
    expect(PLOT_RANGE.max).toBeGreaterThanOrEqual(60);
    expect(APARTMENT_ROOM_RANGE.min).toBe(1);
    expect(APARTMENT_ROOM_RANGE.max).toBeGreaterThanOrEqual(90);
  });

  it('通報自動非表示閾値は設計書通り 3', () => {
    expect(REPORT_AUTO_HIDE_THRESHOLD).toBe(3);
  });

  it('登録枠 D 案: 初回 30 + 日次 5', () => {
    expect(REGISTRATION_INITIAL_BONUS).toBe(30);
    expect(REGISTRATION_DAILY_QUOTA).toBe(5);
  });

  it('ルート定数が定義されている', () => {
    expect(HOUSING_ROUTES.TOP).toBe('/housing');
    expect(HOUSING_ROUTES.LISTING_DETAIL_TEMPLATE).toBe('/housing/p/:id');
    expect(HOUSING_ROUTES.TOUR_DETAIL_TEMPLATE).toBe('/housing/tour/:id');
  });

  it('buildListingDetailPath が正しい URL を組み立てる', () => {
    expect(buildListingDetailPath('abc')).toBe('/housing/p/abc');
    expect(buildListingDetailPath('123')).toBe('/housing/p/123');
  });

  it('buildTourDetailPath が正しい URL を組み立てる', () => {
    expect(buildTourDetailPath('xyz')).toBe('/housing/tour/xyz');
    expect(buildTourDetailPath('456')).toBe('/housing/tour/456');
  });
});
