import { describe, it, expect } from 'vitest';
import { normalizeTarget, normalizeDamageType } from '../normalizeFields';

describe('normalizeTarget', () => {
  it('MT/ST を正規化', () => {
    expect(normalizeTarget('MT')).toBe('MT');
    expect(normalizeTarget('mt')).toBe('MT');
    expect(normalizeTarget('メインタンク')).toBe('MT');
    expect(normalizeTarget('ST')).toBe('ST');
    expect(normalizeTarget('サブタンク')).toBe('ST');
  });
  it('全体/AoE を正規化', () => {
    expect(normalizeTarget('全体')).toBe('AoE');
    expect(normalizeTarget('AoE')).toBe('AoE');
    expect(normalizeTarget('raidwide')).toBe('AoE');
    expect(normalizeTarget('전체')).toBe('AoE');
    expect(normalizeTarget('全体攻击')).toBe('AoE');
  });
  it('空/不明は null', () => {
    expect(normalizeTarget('')).toBeNull();
    expect(normalizeTarget('なにか')).toBeNull();
  });
});

describe('normalizeDamageType', () => {
  it('物理を正規化', () => {
    expect(normalizeDamageType('物理')).toBe('physical');
    expect(normalizeDamageType('Physical')).toBe('physical');
    expect(normalizeDamageType('물리')).toBe('physical');
    expect(normalizeDamageType('物理')).toBe('physical');
  });
  it('魔法を正規化', () => {
    expect(normalizeDamageType('魔法')).toBe('magical');
    expect(normalizeDamageType('Magic')).toBe('magical');
    expect(normalizeDamageType('Magical')).toBe('magical');
    expect(normalizeDamageType('마법')).toBe('magical');
    expect(normalizeDamageType('魔法')).toBe('magical');
  });
  it('空/不明は null', () => {
    expect(normalizeDamageType('')).toBeNull();
    expect(normalizeDamageType('不明')).toBeNull();
  });
});
