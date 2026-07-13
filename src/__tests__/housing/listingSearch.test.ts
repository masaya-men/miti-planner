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
  it('includes Japanese katakana readings for JP world/DC', () => {
    const t2 = buildListingSearchText({ ...base, server: 'Pandaemonium', dc: 'Mana' }, tId, 'ja', 'ja');
    expect(t2).toContain('パンデモニウム'); // server カタカナ
    expect(t2).toContain('マナ');           // dc カタカナ
  });
});

describe('katakana search (略称は部分一致で自動対応)', () => {
  it('matches a world by its abbreviation (パンデモ ⊂ パンデモニウム)', () => {
    const text = buildListingSearchText({ ...base, server: 'Pandaemonium' }, tId, 'ja', 'ja');
    expect(matchesKeyword(text, 'パンデモ')).toBe(true);
    expect(matchesKeyword(text, 'パンデモニウム')).toBe(true);
  });
  it('does not add katakana for non-JP worlds (英語のまま)', () => {
    const text = buildListingSearchText(
      { ...base, server: 'Gilgamesh', dc: 'Aether', region: 'NA' },
      tId, 'ja', 'ja',
    );
    expect(text).toContain('gilgamesh'); // 英語で検索可能
    expect(matchesKeyword(text, 'ギルガメッシュ')).toBe(false); // 慣用カタカナは非対象
  });
  it('matches katakana reading via hiragana input (まな / ぱんでも)', () => {
    const text = buildListingSearchText({ ...base, server: 'Pandaemonium', dc: 'Mana' }, tId, 'ja', 'ja');
    expect(matchesKeyword(text, 'まな')).toBe(true);           // ひらがなで DC
    expect(matchesKeyword(text, 'ぱんでもにうむ')).toBe(true); // ひらがなでワールド
    expect(matchesKeyword(text, 'ぱんでも')).toBe(true);       // ひらがな略称
  });
  it('hiragana normalization also applies to title/description (かふぇ ⇄ カフェ)', () => {
    expect(matchesKeyword('静かな隠れ家カフェ', 'かふぇ')).toBe(true);
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
