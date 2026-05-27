import { describe, it, expect } from 'vitest';
import { computeSeekSeconds } from '../extractVideoFrames';

describe('computeSeekSeconds', () => {
  it('maps standard 0/25/50% fractions to seconds', () => {
    expect(computeSeekSeconds(100, [0, 0.25, 0.5])).toEqual([0, 25, 50]);
  });

  it('clamps fractions > 0.99 so we never land on the last frame', () => {
    // 1 and 1.5 both clamp to 0.99 → both become 9.9; deduped.
    expect(computeSeekSeconds(10, [0.99, 1, 1.5])).toEqual([9.9]);
  });

  it('clamps negative fractions to 0', () => {
    expect(computeSeekSeconds(10, [-1, 0, 0.5])).toEqual([0, 5]);
  });

  it('dedups identical seconds on very short clips', () => {
    // 0.5s clip: 0% = 0, 25% = 0.13s, 50% = 0.25s
    expect(computeSeekSeconds(0.5, [0, 0.25, 0.5])).toEqual([0, 0.13, 0.25]);
  });

  it('returns sorted ascending regardless of input order', () => {
    expect(computeSeekSeconds(20, [0.5, 0, 0.25])).toEqual([0, 5, 10]);
  });

  it('returns [] for invalid duration', () => {
    expect(computeSeekSeconds(0, [0, 0.25])).toEqual([]);
    expect(computeSeekSeconds(-5, [0, 0.25])).toEqual([]);
    expect(computeSeekSeconds(NaN, [0, 0.25])).toEqual([]);
    expect(computeSeekSeconds(Infinity, [0, 0.25])).toEqual([]);
  });

  it('skips non-finite fractions', () => {
    expect(computeSeekSeconds(10, [0, NaN, 0.5, Infinity])).toEqual([0, 5]);
  });

  it('returns [] when fractions is empty', () => {
    expect(computeSeekSeconds(10, [])).toEqual([]);
  });
});
