import { DC_SERVER_MAP } from '../../../data/housing/dcServerMap';
import terms from '../../../data/housing/housingTerms.generated.json';
import { termLabel, displayWorldName, displayDcName } from '../housingTerms';

const LOCALES = ['ja', 'en', 'ko', 'zh'] as const;

describe('housingTerms 完全性', () => {
  it('全 DC / 全ワールドに 4 言語名がある', () => {
    for (const [dc, { servers }] of Object.entries(DC_SERVER_MAP)) {
      for (const l of LOCALES) expect((terms as any).dc[dc]?.[l], `dc ${dc} ${l}`).toBeTruthy();
      for (const s of servers) for (const l of LOCALES) expect((terms as any).world[s]?.[l], `world ${s} ${l}`).toBeTruthy();
    }
  });
  it('KR/CN は辞書名、グローバルはキーのまま表示', () => {
    expect(displayWorldName('Korea', 'Carbuncle', 'ko')).toBe('카벙클');
    expect(displayWorldName('ChocoboCN', 'RubySea', 'ja')).toBe('紅玉海');
    expect(displayDcName('MameshibaCN', 'zh')).toBe('豆豆柴');
    expect(displayWorldName('Elemental', 'Carbuncle', 'ko')).toBe('Carbuncle'); // グローバル現状維持
    expect(displayDcName('Elemental', 'ja')).toBe('Elemental');
  });
  it('エーテライト名は ja キーで引ける', () => {
    expect(termLabel('aetheryte', 'ミストゲート・スクエア', 'zh')).toBe('雾门广场');
    expect(termLabel('aetheryte', '未知の名前', 'zh')).toBe('未知の名前'); // フォールバック
  });
});
