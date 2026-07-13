import { describe, it, expect } from 'vitest';
import { computeStepperScroll } from '../stepperScroll';

describe('computeStepperScroll', () => {
  it('progress=0 は 0', () => {
    expect(computeStepperScroll(0, 300, 150)).toBe(0);
  });
  it('progress=1 は overflow 全量 (contentH-viewportH)', () => {
    expect(computeStepperScroll(1, 300, 150)).toBe(150);
  });
  it('中間は overflow に比例', () => {
    expect(computeStepperScroll(0.5, 300, 150)).toBe(75);
  });
  it('収まる (contentH<=viewportH) は 0', () => {
    expect(computeStepperScroll(0.5, 100, 150)).toBe(0);
    expect(computeStepperScroll(1, 150, 150)).toBe(0);
  });
  it('progress は 0..1 にクランプ', () => {
    expect(computeStepperScroll(-1, 300, 150)).toBe(0);
    expect(computeStepperScroll(2, 300, 150)).toBe(150);
  });
  it('負値・NaN は安全に 0 として扱う', () => {
    expect(computeStepperScroll(NaN, 300, 150)).toBe(0);
    expect(computeStepperScroll(0.5, NaN, 150)).toBe(0);
    expect(computeStepperScroll(0.5, 300, NaN)).toBe(0);
    expect(computeStepperScroll(0.5, -10, -20)).toBe(0);
  });
});
