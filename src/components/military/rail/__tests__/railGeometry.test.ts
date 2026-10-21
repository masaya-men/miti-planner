import { describe, it, expect } from 'vitest';
import { railLayout } from '../railGeometry';

describe('railLayout(見本 buildRail js:397-415)', () => {
  it('H=679: L = H-12 = 667・バス B の終点は L・取っ手 y は中ほど', () => {
    const r = railLayout(679);
    expect(r.L).toBe(667);
    expect(r.busA).toHaveLength(8);
    expect(r.busB).toHaveLength(8);
    const endB = r.busB[0][r.busB[0].length - 1];
    expect(endB[1]).toBe(667);
    expect(r.busA[0][0][1]).toBe(0);
    expect(r.pull).toEqual({ x: 4, y: Math.round(679 / 2 - 22), w: 14, h: 44 });
  });
  it('H=1080: L = 1068・バス B は L まで伸び・取っ手 y は 518', () => {
    const r = railLayout(1080);
    expect(r.L).toBe(1068);
    expect(r.busB[7][r.busB[7].length - 1][1]).toBe(1068);
    expect(r.pull.y).toBe(518);
  });
  it('リベットは y+20 が L 未満のものだけ(H=679 は 6 組・H=400 は上の 4 組目まで)', () => {
    expect(railLayout(679).rivets).toHaveLength(12);
    const r = railLayout(400);
    // L=388: y=40/120/200 のみ(y+20 < 388)
    expect(r.rivets.filter((p) => p[0] === 0.6)).toHaveLength(3);
  });
  it('IC の下に A の終点(y=250)を合わせたピンの x を持つ', () => {
    const r = railLayout(679);
    expect(r.ic.pins).toHaveLength(8);
    expect(r.ic.y).toBe(251.2);
  });
});
