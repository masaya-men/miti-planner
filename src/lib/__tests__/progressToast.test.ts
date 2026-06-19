import { describe, it, expect } from 'vitest';
import { classifyRecord } from '../progressLogic';
import type { PlanProgress } from '../../types';

const P = (reached: number[]): PlanProgress => ({ points: reached.map((r, i) => ({ id: `pt_${i}`, ts: i + 1, reachedPos: r })), cleared: false });

describe('classifyRecord', () => {
  it('記録ゼロからの初回は update', () => {
    expect(classifyRecord({ points: [], cleared: false }, 50)).toBe('update');
  });
  it('過去最高より奥 → update', () => {
    expect(classifyRecord(P([30, 80]), 120)).toBe('update');
  });
  it('過去最高と同じ → nice（更新ならず）', () => {
    expect(classifyRecord(P([30, 80]), 80)).toBe('nice');
  });
  it('過去最高より手前 → nice', () => {
    expect(classifyRecord(P([30, 80]), 50)).toBe('nice');
  });
  it('reachedPos=0 で points 空 → nice（0は更新でない）', () => {
    expect(classifyRecord({ points: [], cleared: false }, 0)).toBe('nice');
  });
});
