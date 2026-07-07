import { describe, it, expect, vi } from 'vitest';

// mock は旧 {road,jump} 形式のまま置き、getRouteOverride が segments に正規化することを検証する(後方互換)。
vi.mock('../../../data/housing/wardRouteOverrides.generated.json', () => ({
  default: { mist: { '8': { road: [[0.44, 0.18], [0.36, 0.22]], jump: [[0.36, 0.22], [0.385, 0.27]] } } },
}));
import { getRouteOverride } from '../wardRouteOverrides';

describe('getRouteOverride', () => {
  it('旧 {road,jump} を segments に正規化して返す', () => {
    const segs = getRouteOverride('mist', '8')!;
    expect(segs[0]).toEqual({ kind: 'road', points: [[0.44, 0.18], [0.36, 0.22]] });
    expect(segs[1].kind).toBe('jump');
    expect(segs[1].points[1]).toEqual([0.385, 0.27]);
  });
  it('未収録は null', () => {
    expect(getRouteOverride('mist', '9')).toBeNull();
    expect(getRouteOverride('goblet', '8')).toBeNull();
  });
});
