import { describe, it, expect } from 'vitest';
import {
  HOUSING_TAGS,
  HOUSING_TAG_KINDS,
  STATIC_HOUSING_TAG_KINDS,
  getTagsByKind,
  getTagById,
  isValidTagId,
  isStaticTagId,
  isPersonalTagIdFormat,
} from '../../data/housingTags';
import { PERSONAL_TAG_ID_PREFIX, PERSONAL_TAG_LIMIT_PER_USER } from '../../constants/housing';

describe('housingTags', () => {
  it('kind は 公式/季節/テーマ/個人 の 4 種 (この順序)', () => {
    expect(HOUSING_TAG_KINDS).toEqual(['official', 'season', 'theme', 'personal']);
  });

  it('静的レジストリを持つ kind は 公式/季節/テーマ の 3 種 (個人は Firestore 動的管理)', () => {
    expect(STATIC_HOUSING_TAG_KINDS).toEqual(['official', 'season', 'theme']);
  });

  it('全タグの id がユニーク', () => {
    const ids = HOUSING_TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全タグの kind が定義済み kind のいずれか', () => {
    for (const tag of HOUSING_TAGS) {
      expect(HOUSING_TAG_KINDS).toContain(tag.kind);
    }
  });

  it('全タグの i18nKey が housing.tag. で始まる', () => {
    for (const tag of HOUSING_TAGS) {
      expect(tag.i18nKey).toMatch(/^housing\.tag\./);
    }
  });

  it('id は kind ごとの prefix で統一されている (official_ / season_ / theme_)', () => {
    for (const tag of HOUSING_TAGS) {
      expect(tag.id).toMatch(new RegExp(`^${tag.kind}_`));
    }
  });

  it('総数は 47 (公式23 + 季節12 + テーマ12)', () => {
    expect(HOUSING_TAGS.length).toBe(47);
  });

  it('公式タグは 23 件', () => {
    expect(getTagsByKind('official').length).toBe(23);
  });

  it('季節タグは 12 件', () => {
    expect(getTagsByKind('season').length).toBe(12);
  });

  it('テーマタグは 12 件', () => {
    expect(getTagsByKind('theme').length).toBe(12);
  });

  it('季節タグの id が確定リストと一致 (旧イベント名は含まない)', () => {
    const ids = getTagsByKind('season').map((t) => t.id).sort();
    expect(ids).toEqual(
      [
        'season_spring', 'season_summer', 'season_autumn', 'season_winter',
        'season_new_year', 'season_valentine', 'season_hinamatsuri', 'season_easter',
        'season_tanabata', 'season_summer_festival', 'season_halloween', 'season_christmas',
      ].sort(),
    );
  });

  it('テーマタグの id が確定リストと一致 (botanical を含む)', () => {
    const ids = getTagsByKind('theme').map((t) => t.id).sort();
    expect(ids).toEqual(
      [
        'theme_wafu', 'theme_wamodern', 'theme_modern', 'theme_natural', 'theme_antique',
        'theme_gothic', 'theme_marchen', 'theme_cyberpunk', 'theme_fantasy', 'theme_gimmick',
        'theme_ruins', 'theme_botanical',
      ].sort(),
    );
  });

  it('getTagById は存在する id でタグを返す', () => {
    const modern = getTagById('theme_modern');
    expect(modern).toBeDefined();
    expect(modern?.kind).toBe('theme');
  });

  it('getTagById は存在しない (旧) id で undefined を返す (クラッシュしない)', () => {
    expect(getTagById('modern')).toBeUndefined();
    expect(getTagById('cherry_blossom')).toBeUndefined();
    expect(getTagById('not-a-tag')).toBeUndefined();
  });

  describe('isStaticTagId', () => {
    it('静的レジストリに存在する id で true を返す', () => {
      expect(isStaticTagId('official_cafe')).toBe(true);
    });

    it('個人タグ id (personal_) では false を返す (静的レジストリには無い)', () => {
      expect(isStaticTagId('personal_yuura')).toBe(false);
    });

    it('存在しない id で false を返す', () => {
      expect(isStaticTagId('not-a-tag')).toBe(false);
    });
  });

  describe('isPersonalTagIdFormat', () => {
    it('personal_ prefix + slug 形式で true を返す', () => {
      expect(isPersonalTagIdFormat('personal_yuura')).toBe(true);
      expect(isPersonalTagIdFormat(`${PERSONAL_TAG_ID_PREFIX}yuura_2`)).toBe(true);
    });

    it('prefix が無ければ false', () => {
      expect(isPersonalTagIdFormat('yuura')).toBe(false);
    });

    it('大文字や記号を含む場合は false', () => {
      expect(isPersonalTagIdFormat('personal_Yuura')).toBe(false);
      expect(isPersonalTagIdFormat('personal_yuura!')).toBe(false);
    });
  });

  describe('isValidTagId', () => {
    it('静的タグ id で true を返す', () => {
      expect(isValidTagId('theme_modern')).toBe(true);
    });

    it('personal_ 形式の id で true を返す (実在確認はサーバー側の別レイヤー)', () => {
      expect(isValidTagId('personal_yuura')).toBe(true);
    });

    it('旧 (prefix なし) id で false を返す', () => {
      expect(isValidTagId('modern')).toBe(false);
    });

    it('存在しない id で false を返す', () => {
      expect(isValidTagId('not-a-tag')).toBe(false);
    });

    it('空文字列で false を返す', () => {
      expect(isValidTagId('')).toBe(false);
    });
  });

  it('PERSONAL_TAG_LIMIT_PER_USER は 1 (1 ユーザー 1 個)', () => {
    expect(PERSONAL_TAG_LIMIT_PER_USER).toBe(1);
  });
});
