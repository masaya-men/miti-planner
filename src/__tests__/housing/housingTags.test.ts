import { describe, it, expect } from 'vitest';
import { HOUSING_TAGS, HOUSING_TAG_CATEGORIES, getTagsByCategory, getTagById } from '../../data/housingTags';

describe('housingTags', () => {
  it('全 6 カテゴリが定義されている', () => {
    expect(HOUSING_TAG_CATEGORIES).toEqual(['taste', 'scene', 'season', 'environment', 'structure', 'other']);
  });

  it('全タグの id がユニーク', () => {
    const ids = HOUSING_TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全タグの category が定義済みカテゴリのいずれか', () => {
    for (const tag of HOUSING_TAGS) {
      expect(HOUSING_TAG_CATEGORIES).toContain(tag.category);
    }
  });

  it('全タグの i18nKey が housing.tag. で始まる', () => {
    for (const tag of HOUSING_TAGS) {
      expect(tag.i18nKey).toMatch(/^housing\.tag\./);
    }
  });

  it('カテゴリ別件数が設計書 §12.5 と一致 (許容 ±2)', () => {
    expect(getTagsByCategory('taste').length).toBeGreaterThanOrEqual(43);
    expect(getTagsByCategory('taste').length).toBeLessThanOrEqual(47);
    expect(getTagsByCategory('scene').length).toBeGreaterThanOrEqual(38);
    expect(getTagsByCategory('scene').length).toBeLessThanOrEqual(42);
    expect(getTagsByCategory('season').length).toBeGreaterThanOrEqual(18);
    expect(getTagsByCategory('season').length).toBeLessThanOrEqual(22);
    expect(getTagsByCategory('environment').length).toBeGreaterThanOrEqual(10);
    expect(getTagsByCategory('environment').length).toBeLessThanOrEqual(14);
    expect(getTagsByCategory('structure').length).toBeGreaterThanOrEqual(13);
    expect(getTagsByCategory('structure').length).toBeLessThanOrEqual(17);
    expect(getTagsByCategory('other').length).toBeGreaterThanOrEqual(13);
    expect(getTagsByCategory('other').length).toBeLessThanOrEqual(17);
  });

  it('getTagById は存在する id でタグを返す', () => {
    const modern = getTagById('modern');
    expect(modern).toBeDefined();
    expect(modern?.category).toBe('taste');
  });

  it('getTagById は存在しない id で undefined を返す', () => {
    expect(getTagById('not-a-tag')).toBeUndefined();
  });
});
