import { describe, it, expect } from 'vitest';
import { resolveTourSteps, stepStatus, computeTourProgress, isTourPlaceable } from '../tourNav';
import type { MockListing } from '../../../data/housing/mockListings';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import type { HousingArea } from '../../../types/housing';

// MockListing は必須フィールドが多い (dc/server/region 等) ため、実データを spread して
// テストで意味を持つ id / area だけ override する (tsc -b の TS2352 回避・型安全・キャスト不要)。
const L = (id: string, area: HousingArea = 'Mist'): MockListing =>
  ({ ...MOCK_LISTINGS[0], id, area });

describe('resolveTourSteps', () => {
  it('listingIds の順序を保ち、欠落は listing=null にする', () => {
    const pool = [L('b'), L('a')];
    const steps = resolveTourSteps(['a', 'x', 'b'], pool);
    expect(steps.map((s) => s.id)).toEqual(['a', 'x', 'b']);
    expect(steps[0].listing?.id).toBe('a');
    expect(steps[1].listing).toBeNull();
    expect(steps[2].listing?.id).toBe('b');
  });
});

describe('stepStatus', () => {
  it('index<current=arrived / =current / >current=upcoming', () => {
    expect(stepStatus(0, 2)).toBe('arrived');
    expect(stepStatus(2, 2)).toBe('current');
    expect(stepStatus(3, 2)).toBe('upcoming');
  });
});

describe('computeTourProgress', () => {
  it('到着数/残り/％/現在/最近 を算出', () => {
    const steps = resolveTourSteps(['a', 'b', 'c', 'd', 'e'], [L('a'), L('b'), L('c'), L('d'), L('e')]);
    const p = computeTourProgress(steps, 2);
    expect(p.total).toBe(5);
    expect(p.arrivedCount).toBe(2);
    expect(p.remainingCount).toBe(3);
    expect(p.percent).toBe(40);
    expect(p.currentStep?.id).toBe('c');
    expect(p.recent.map((s) => s.id)).toEqual(['b', 'a']); // 直近順
  });
  it('currentIndex===total で完了(currentStep=null・100%)', () => {
    const steps = resolveTourSteps(['a', 'b'], [L('a'), L('b')]);
    const p = computeTourProgress(steps, 2);
    expect(p.currentStep).toBeNull();
    expect(p.percent).toBe(100);
    expect(p.remainingCount).toBe(0);
  });
  it('空ツアーは0%・currentStep=null', () => {
    const p = computeTourProgress([], 0);
    expect(p.total).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.currentStep).toBeNull();
  });
});

const placeable = (over: Partial<MockListing>): MockListing => ({ id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP', area: 'LavenderBeds', ward: 1, buildingType: 'house', plot: 6, size: 'M', addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, ...over });

describe('isTourPlaceable (全5エリア対応)', () => {
  it('全5エリアの house(1-60)/apartment は配置可能', () => {
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum'] as const) {
      expect(isTourPlaceable(placeable({ area, plot: 6 }))).toBe(true);
      expect(isTourPlaceable(placeable({ area, plot: 45 }))).toBe(true);
    }
    expect(isTourPlaceable(placeable({ buildingType: 'apartment', plot: undefined, apartmentBuilding: 2, roomNumber: 3 }))).toBe(true);
  });
  it('plot 無し house / 未知エリア / null は不可', () => {
    expect(isTourPlaceable(placeable({ buildingType: 'house', plot: undefined }))).toBe(false);
    expect(isTourPlaceable(placeable({ area: 'Nowhere' as MockListing['area'] }))).toBe(false);
    expect(isTourPlaceable(null)).toBe(false);
  });
});
