import { describe, it, expect } from 'vitest';
import { buildListingSearchText, matchesKeyword } from '../../lib/housing/listingSearch';
import type { MockListing } from '../../data/housing/mockListings';

// t mock: 静的タグ id をそのまま返す (housing.tag.official_cafe → 'housing.tag.official_cafe')
const tId = (k: string) => k;

const base: MockListing = {
  id: 'l1', ownerUid: 'u1', dc: 'Mana', server: 'Anima', region: 'JP',
  area: 'Mist', ward: 23, buildingType: 'house', plot: 6, size: 'M',
  imageMode: 'none', tags: ['official_cafe', 'personal_alice'],
  description: '静かな隠れ家カフェ', title: 'Cafe LoPo',
  createdAt: 0, lastConfirmedAt: 0, addressKey: 'k',
};

describe('buildListingSearchText', () => {
  const text = buildListingSearchText(base, tId, 'ja', 'ja');
  it('includes title and description (lowercased)', () => {
    expect(text).toContain('cafe lopo');       // title は小文字化
    expect(text).toContain('隠れ家カフェ');
  });
  it('includes static tag i18nKey but not personal tag', () => {
    expect(text).toContain('housing.tag.official_cafe');
    expect(text).not.toContain('personal_alice');
  });
  it('includes address, server, dc, region label', () => {
    expect(text).toContain('ミスト');           // formatHousingAddress の area 名
    expect(text).toContain('anima');            // server (小文字化)
    expect(text).toContain('mana');             // dc
    expect(text).toContain('日本');             // regionLabel(JP, ja)
  });
});

describe('matchesKeyword', () => {
  it('empty keyword always matches', () => {
    expect(matchesKeyword('anything', '')).toBe(true);
    expect(matchesKeyword('anything', '   ')).toBe(true);
  });
  it('single word partial match, case-insensitive', () => {
    expect(matchesKeyword('静かな隠れ家カフェ', 'カフェ')).toBe(true);
    expect(matchesKeyword('cafe lopo', 'CAFE')).toBe(true);
    expect(matchesKeyword('cafe lopo', 'tavern')).toBe(false);
  });
  it('multi-word AND', () => {
    expect(matchesKeyword('cafe wafu house', 'cafe wafu')).toBe(true);
    expect(matchesKeyword('cafe house', 'cafe wafu')).toBe(false);
  });
});
