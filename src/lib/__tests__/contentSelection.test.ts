import { describe, it, expect } from 'vitest';
import { hasContentRegistry, getFilteredBosses, deriveContentId } from '../contentSelection';
import type { ContentDefinition } from '../../types';

const mkBoss = (id: string): ContentDefinition => ({ id } as ContentDefinition);

describe('hasContentRegistry', () => {
  it('savage / ultimate は true', () => {
    expect(hasContentRegistry('savage')).toBe(true);
    expect(hasContentRegistry('ultimate')).toBe(true);
  });
  it('dungeon / raid / custom / null は false', () => {
    expect(hasContentRegistry('dungeon')).toBe(false);
    expect(hasContentRegistry('raid')).toBe(false);
    expect(hasContentRegistry('custom')).toBe(false);
    expect(hasContentRegistry(null)).toBe(false);
  });
});

describe('getFilteredBosses', () => {
  it('level が null なら空配列', () => {
    expect(getFilteredBosses(null, 'savage')).toEqual([]);
  });
  it('非Registry系（dungeon）なら空配列', () => {
    expect(getFilteredBosses(100, 'dungeon')).toEqual([]);
  });
  it('非Registry系（null）なら空配列', () => {
    expect(getFilteredBosses(100, null)).toEqual([]);
  });
  it('Registry系 + level 指定で配列を返す（型は ContentDefinition[]）', () => {
    const result = getFilteredBosses(100, 'savage');
    expect(Array.isArray(result)).toBe(true);
    expect(result.every((c) => typeof c.id === 'string')).toBe(true);
  });
});

describe('deriveContentId', () => {
  it('boss があれば boss.id', () => {
    expect(deriveContentId(mkBoss('fru'), 'ultimate', '無視される')).toBe('fru');
  });
  it('Registry系で boss 無しなら null', () => {
    expect(deriveContentId(null, 'savage', 'なにか')).toBeNull();
  });
  it('非Registry系は title.trim()', () => {
    expect(deriveContentId(null, 'dungeon', '  AAC ライトヘビー  ')).toBe('AAC ライトヘビー');
  });
  it('非Registry系で title 空なら null', () => {
    expect(deriveContentId(null, 'dungeon', '   ')).toBeNull();
  });
});
