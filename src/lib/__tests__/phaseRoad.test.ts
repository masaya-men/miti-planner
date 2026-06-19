import { describe, it, expect } from 'vitest';
import { phaseRoadPositions, roadTimeFromClick, clampActivity } from '../progressLogic';

describe('phaseRoadPositions', () => {
  it('開始時間に比例して leftPct を返す（4〜96 にクランプ）', () => {
    const phases = [
      { id: 'a', name: { ja: 'P1' } as any, startTime: 0 },
      { id: 'b', name: { ja: 'P2' } as any, startTime: 210 },
      { id: 'c', name: { ja: 'P3' } as any, startTime: 420 },
    ];
    const r = phaseRoadPositions(phases, 420);
    expect(r[0].leftPct).toBe(4);     // 0% → 下限4
    expect(r[1].leftPct).toBe(50);    // 210/420
    expect(r[2].leftPct).toBe(96);    // 100% → 上限96
    expect(r[1].time).toBe(210);
  });
  it('total<=0 は空配列', () => {
    expect(phaseRoadPositions([{ id: 'a', name: {} as any, startTime: 0 }], 0)).toEqual([]);
  });
});

describe('roadTimeFromClick', () => {
  it('fraction×total を四捨五入', () => {
    expect(roadTimeFromClick(0.5, 200)).toBe(100);
    expect(roadTimeFromClick(0.25, 201)).toBe(50);
  });
  it('0〜total にクランプ', () => {
    expect(roadTimeFromClick(-0.1, 200)).toBe(0);
    expect(roadTimeFromClick(1.5, 200)).toBe(200);
  });
});

describe('clampActivity', () => {
  it('0未満は0・整数化', () => {
    expect(clampActivity(-3)).toBe(0);
    expect(clampActivity(2.7)).toBe(3);
    expect(clampActivity(0)).toBe(0);
  });
});
