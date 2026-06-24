import { describe, it, expect } from 'vitest';
import { mmssToSec } from '../time';

describe('mmssToSec', () => {
  it('M:SS を秒へ', () => {
    expect(mmssToSec('0:00')).toBe(0);
    expect(mmssToSec('1:30')).toBe(90);
    expect(mmssToSec('10:05')).toBe(605);
  });
  it('負値(戦闘前)を扱う', () => {
    expect(mmssToSec('-0:20')).toBe(-20);
  });
  it('前後空白を許容', () => {
    expect(mmssToSec(' 1:00 ')).toBe(60);
  });
  it('不正値は null', () => {
    expect(mmssToSec('あ')).toBeNull();
    expect(mmssToSec('')).toBeNull();
    expect(mmssToSec(undefined)).toBeNull();
    expect(mmssToSec('1:60')).toBeNull(); // 秒は 0-59
  });
});
