import { describe, it, expect } from 'vitest';
import { pxToTimeSec, timeSecToPx, pxToXRatio, xRatioToPx, clampMemoCoords } from '../coords';

describe('Memo coords 変換', () => {
  describe('pxToTimeSec / timeSecToPx', () => {
    it('px = 0 → timeSec = offsetTime (= 0 or -10 in preStart)', () => {
      expect(pxToTimeSec(0, 50, 0)).toBe(0);
      expect(pxToTimeSec(0, 50, -10)).toBe(-10);
    });
    it('px = pixelsPerSecond → timeSec = offsetTime + 1', () => {
      expect(pxToTimeSec(50, 50, 0)).toBe(1);
      expect(pxToTimeSec(50, 50, -10)).toBe(-9);
    });
    it('timeSec round-trip', () => {
      const sec = 12.5;
      expect(pxToTimeSec(timeSecToPx(sec, 50, 0), 50, 0)).toBeCloseTo(sec);
    });
    it('pixelsPerSecond <= 0 のとき offsetTime を返す (ガード)', () => {
      expect(pxToTimeSec(50, 0, 0)).toBe(0);
      expect(pxToTimeSec(50, -1, -10)).toBe(-10);
    });
  });

  describe('pxToXRatio / xRatioToPx', () => {
    it('px = 0 → xRatio = 0', () => {
      expect(pxToXRatio(0, 800)).toBe(0);
    });
    it('px = width → xRatio = 1', () => {
      expect(pxToXRatio(800, 800)).toBe(1);
    });
    it('px = width / 2 → xRatio = 0.5', () => {
      expect(pxToXRatio(400, 800)).toBe(0.5);
    });
    it('xRatio round-trip', () => {
      const r = 0.37;
      expect(pxToXRatio(xRatioToPx(r, 800), 800)).toBeCloseTo(r);
    });
  });

  describe('clampMemoCoords', () => {
    it('timeSec を [0, maxTime] にクランプ', () => {
      expect(clampMemoCoords({ timeSec: -5, xRatio: 0.5 }, 60).timeSec).toBe(0);
      expect(clampMemoCoords({ timeSec: 999, xRatio: 0.5 }, 60).timeSec).toBe(60);
      expect(clampMemoCoords({ timeSec: 30, xRatio: 0.5 }, 60).timeSec).toBe(30);
    });
    it('xRatio を [0, 1] にクランプ', () => {
      expect(clampMemoCoords({ timeSec: 10, xRatio: -0.2 }, 60).xRatio).toBe(0);
      expect(clampMemoCoords({ timeSec: 10, xRatio: 1.5 }, 60).xRatio).toBe(1);
      expect(clampMemoCoords({ timeSec: 10, xRatio: 0.7 }, 60).xRatio).toBe(0.7);
    });
  });
});
