import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { hasContentRegistry, getFilteredBosses, deriveContentId, resolveInitialSelection } from '../contentSelection';
import { getContentById } from '../../data/contentRegistry';
import type { ContentDefinition } from '../../types';

// getContentById のみモック（getSeriesByLevel/getContentBySeries は real のまま＝getFilteredBosses テスト維持）
vi.mock('../../data/contentRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/contentRegistry')>();
  return { ...actual, getContentById: vi.fn(actual.getContentById) };
});

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

describe('resolveInitialSelection', () => {
  beforeEach(() => {
    (getContentById as Mock).mockReset();
  });

  it('登録系(零式/絶): contentId からボス定義を引いて level/category/boss を復元（plan に category/level が無くても効く=症状A回帰）', () => {
    const fru: ContentDefinition = { id: 'fru', level: 100, category: 'ultimate' } as ContentDefinition;
    (getContentById as Mock).mockReturnValue(fru);
    const r = resolveInitialSelection({ contentId: 'fru', level: null, category: null, title: '無視される' });
    expect(getContentById).toHaveBeenCalledWith('fru');
    expect(r).toEqual({ level: 100, category: 'ultimate', boss: fru, title: '' });
  });

  it('contentId が null なら plan 由来の level/category にフォールバック・boss は null', () => {
    (getContentById as Mock).mockReturnValue(undefined);
    const r = resolveInitialSelection({ contentId: null, level: 90, category: 'savage', title: 'x' });
    expect(getContentById).not.toHaveBeenCalled();
    expect(r).toEqual({ level: 90, category: 'savage', boss: null, title: '' });
  });

  it('登録外(ダンジョン等): getContentById が undefined → category は plan 由来・title に contentId を流す', () => {
    (getContentById as Mock).mockReturnValue(undefined);
    const r = resolveInitialSelection({ contentId: 'AAC ライトヘビー級', level: 100, category: 'dungeon', title: 'マイ表' });
    expect(r).toEqual({ level: 100, category: 'dungeon', boss: null, title: 'AAC ライトヘビー級' });
  });

  it('登録外で contentId も null・category も null なら全て空', () => {
    (getContentById as Mock).mockReturnValue(undefined);
    const r = resolveInitialSelection({ contentId: null, level: null, category: null, title: 'x' });
    expect(r).toEqual({ level: null, category: null, boss: null, title: '' });
  });
});
