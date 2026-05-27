import { describe, it, expect } from 'vitest';
import {
  pickNextStepMs,
  SLIDESHOW_MIN_STEP_MS,
  SLIDESHOW_MAX_STEP_MS,
} from '../slideshowCycle';

describe('pickNextStepMs', () => {
  it('returns MIN when rng() returns 0', () => {
    expect(pickNextStepMs(() => 0)).toBe(SLIDESHOW_MIN_STEP_MS);
  });
  it('returns near MAX when rng() returns close to 1', () => {
    expect(pickNextStepMs(() => 0.999)).toBeCloseTo(SLIDESHOW_MAX_STEP_MS, -1);
  });
  it('falls within [MIN, MAX]', () => {
    for (let i = 0; i < 100; i++) {
      const ms = pickNextStepMs();
      expect(ms).toBeGreaterThanOrEqual(SLIDESHOW_MIN_STEP_MS);
      expect(ms).toBeLessThan(SLIDESHOW_MAX_STEP_MS);
    }
  });
});
