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
  it('HOUSING_LIMITS の値が固定されている', () => {
    expect(HOUSING_LIMITS.MAX_TAGS_PER_LISTING).toBe(5);
    expect(HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH).toBe(200);
    expect(HOUSING_LIMITS.MAX_TOUR_TITLE_LENGTH).toBe(50);
    expect(HOUSING_LIMITS.MAX_THUMBNAIL_BYTES).toBe(100 * 1024);
    expect(HOUSING_LIMITS.THUMBNAIL_DIMENSION_PX).toBe(400);
    expect(HOUSING_LIMITS.MAX_TOUR_LISTINGS).toBe(100);
    expect(HOUSING_LIMITS.MAX_FAVORITES_PER_USER).toBe(100);
  });

  it('Ward / Plot 範囲 (plot は 1-60 通し: 本街 1-30 + 拡張街 31-60)', () => {
    expect(WARD_RANGE.min).toBe(1);
    expect(WARD_RANGE.max).toBe(30);
    expect(PLOT_RANGE.min).toBe(1);
    expect(PLOT_RANGE.max).toBe(60);
    expect(APARTMENT_ROOM_RANGE.min).toBe(1);
    expect(APARTMENT_ROOM_RANGE.max).toBe(90);
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
