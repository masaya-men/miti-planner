import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../data/housing/wardRouteOverrides.generated.json', () => ({
  default: { mist: { '8': { road: [[0.44, 0.18], [0.36, 0.22]], jump: [[0.36, 0.22], [0.385, 0.27]] } } },
}));
import { getRouteOverride } from '../wardRouteOverrides';

describe('getRouteOverride', () => {
  it('収録済み (mapKey,plot) を返す', () => {
    const o = getRouteOverride('mist', '8')!;
    expect(o.road[0]).toEqual([0.44, 0.18]);
    expect(o.jump![1]).toEqual([0.385, 0.27]);
  });
  it('未収録は null', () => {
    expect(getRouteOverride('mist', '9')).toBeNull();
    expect(getRouteOverride('goblet', '8')).toBeNull();
  });
});
