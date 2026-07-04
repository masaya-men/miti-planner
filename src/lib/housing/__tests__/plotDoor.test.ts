import { describe, it, expect } from 'vitest';
import mist from '../../../data/housing/mistWard.generated.json';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { computePlotDoor } from '../plotDoor';
import { plotToPlacementIn } from '../wardRoute';

const json = mist as unknown as WardMapJson;

describe('computePlotDoor', () => {
  it('凸型の家は箱の縁(中心ではない)で交点を返す', () => {
    const door = computePlotDoor(json, 6, 'plot')!;
    expect(door).not.toBeNull();
    const p = plotToPlacementIn(json, 6, 'plot')!;
    // 交点は箱中心とは異なる(手前で止まる)
    expect(Math.hypot(door.x - p.x, door.y - p.y)).toBeGreaterThan(1);
  });

  it('存在しない区画は null', () => {
    expect(computePlotDoor(json, 999, 'plot')).toBeNull();
  });
});
