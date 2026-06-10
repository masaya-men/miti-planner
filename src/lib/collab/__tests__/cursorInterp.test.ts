import { describe, it, expect } from 'vitest';
import { lerp, isFresher, type CursorPos } from '../cursorInterp';

describe('lerp', () => {
  it('alpha=0 は現在値、alpha=1 は目標値', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });
  it('alpha=0.5 は中点', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it('alpha は [0,1] にクランプ', () => {
    expect(lerp(0, 10, 2)).toBe(10);
    expect(lerp(0, 10, -1)).toBe(0);
  });
});

describe('isFresher', () => {
  it('新しい t のみ true', () => {
    expect(isFresher(100, 50)).toBe(true);
    expect(isFresher(50, 100)).toBe(false);
    expect(isFresher(50, 50)).toBe(false);
  });
  it('last が null(初回)は常に true', () => {
    expect(isFresher(1, null)).toBe(true);
  });
});

describe('CursorPos 型', () => {
  it('null は非表示を表す(型の存在確認)', () => {
    const pos: CursorPos = null;
    expect(pos).toBeNull();
  });
});
