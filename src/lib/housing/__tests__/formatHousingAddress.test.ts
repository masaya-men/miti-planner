import { describe, it, expect } from 'vitest';
import { housingSizeDisplayLabel } from '../formatHousingAddress';

/**
 * ⑨ サイズ表記の統一 (2026-07-13 round2 A-1)。
 * 生 'S'/'M'/'L' でなくスペルアウト英語 ('Small'/'Medium'/'Large') に統一する
 * (ユーザー明示要望・全言語共通)。'Apartment'/'PrivateRoom' 等それ以外・未指定は空文字。
 */
describe('housingSizeDisplayLabel', () => {
  it("'S' → 'Small'", () => {
    expect(housingSizeDisplayLabel('S')).toBe('Small');
  });

  it("'M' → 'Medium'", () => {
    expect(housingSizeDisplayLabel('M')).toBe('Medium');
  });

  it("'L' → 'Large'", () => {
    expect(housingSizeDisplayLabel('L')).toBe('Large');
  });

  it('undefined → 空文字', () => {
    expect(housingSizeDisplayLabel(undefined)).toBe('');
  });

  it('引数省略でも空文字 (クラッシュしない)', () => {
    expect(housingSizeDisplayLabel()).toBe('');
  });
});
