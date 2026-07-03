import { describe, it, expect } from 'vitest';
import { resolveTourSteps, stepStatus, computeTourProgress, isMistPlaceable } from '../tourNav';
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

describe('isMistPlaceable', () => {
  it('area==="Mist" のみ true、null/他エリアは false', () => {
    expect(isMistPlaceable(L('a', 'Mist'))).toBe(true);
    expect(isMistPlaceable(L('a', 'LavenderBeds'))).toBe(false);
    expect(isMistPlaceable(null)).toBe(false);
  });
});
