import { describe, it, expect } from 'vitest';
import {
  formatHousingAddress,
  formatFullHousingAddress,
  type FullAddressViewModel,
} from '../formatHousingAddress';

// N: ツアーステップ・カードに DC込みの完全住所を出すための合成 util。
// リージョン(locale対応) / DC / ワールド + 既存の area+ward+plot を ` / ` 区切りで並べる。
// dc / server は生文字列 (ローカライズ対象外)。area 部分は既存 formatHousingAddress に委譲。

const jpHouse: FullAddressViewModel = {
  region: 'JP',
  dc: 'Mana',
  server: 'Anima',
  area: 'Shirogane',
  ward: 3,
  buildingType: 'house',
  plot: 12,
};

const oceHouse: FullAddressViewModel = {
  region: 'OCE',
  dc: 'Materia',
  server: 'Bismarck',
  area: 'Mist',
  ward: 6,
  buildingType: 'house',
  plot: 6,
};

const jpApartment: FullAddressViewModel = {
  region: 'JP',
  dc: 'Mana',
  server: 'Anima',
  area: 'Mist',
  ward: 23,
  buildingType: 'apartment',
  apartmentBuilding: 1,
  roomNumber: 15,
};

describe('formatFullHousingAddress', () => {
  it('JP house (ja): リージョン日本 / DC / ワールド / area+ward+plot を合成', () => {
    expect(formatFullHousingAddress(jpHouse, 'ja')).toBe('日本 / Mana / Anima / シロガネ 3-12');
  });

  it('JP house (en): リージョンのみ英語化、dc/server は生文字列のまま', () => {
    expect(formatFullHousingAddress(jpHouse, 'en')).toBe('Japan / Mana / Anima / Shirogane 3-12');
  });

  it('OCE Materia/Bismarck (ja): リージョンはオセアニア', () => {
    expect(formatFullHousingAddress(oceHouse, 'ja')).toBe('オセアニア / Materia / Bismarck / ミスト・ヴィレッジ 6-6');
  });

  it('OCE (en): リージョンは Oceania', () => {
    expect(formatFullHousingAddress(oceHouse, 'en')).toBe('Oceania / Materia / Bismarck / Mist 6-6');
  });

  it('ko / zh でもリージョン名が locale 化される', () => {
    expect(formatFullHousingAddress(oceHouse, 'ko')).toContain('오세아니아 / Materia / Bismarck / ');
    expect(formatFullHousingAddress(oceHouse, 'zh')).toContain('大洋洲 / Materia / Bismarck / ');
  });

  it('apartment: area 部分は既存 formatHousingAddress のアパート表記に委譲される', () => {
    // 前置き(リージョン/DC/ワールド)だけを合成し、末尾は既存関数と一致することを検証。
    expect(formatFullHousingAddress(jpApartment, 'ja')).toBe(
      `日本 / Mana / Anima / ${formatHousingAddress(jpApartment, 'ja')}`,
    );
    // アパート特有の号棟/部屋番号が末尾に含まれる。
    expect(formatFullHousingAddress(jpApartment, 'ja')).toContain('1号棟 #15');
  });

  it('lang が null/undefined でも ja にフォールバックしてクラッシュしない', () => {
    expect(formatFullHousingAddress(jpHouse, null)).toBe('日本 / Mana / Anima / シロガネ 3-12');
    expect(formatFullHousingAddress(jpHouse, undefined)).toBe('日本 / Mana / Anima / シロガネ 3-12');
  });
});

/**
 * region null ガード (2026-07-13 round2 A-2・②)。
 *
 * `DC_SERVER_MAP` に無い新 DC (Shadow 等) では `regionForDC(dc)` が null を返す。
 * これをそのまま `formatFullHousingAddress` に渡しても `regionLabel(null, …)` で
 * クラッシュせず、従来の `formatHousingAddress` (街区住所のみ) にフォールバックする。
 */
describe('formatFullHousingAddress - region null ガード (2026-07-13 round2 A-2)', () => {
  it('region が null (未知 DC 等) のとき、従来の formatHousingAddress と同じ街区住所を返す (クラッシュしない)', () => {
    const withUnknownRegion = { ...jpHouse, region: null };
    expect(() => formatFullHousingAddress(withUnknownRegion, 'ja')).not.toThrow();
    expect(formatFullHousingAddress(withUnknownRegion, 'ja')).toBe(formatHousingAddress(jpHouse, 'ja'));
    expect(formatFullHousingAddress(withUnknownRegion, 'ja')).toBe('シロガネ 3-12');
  });

  it('apartment でも region null ならクラッシュせずフォールバックする', () => {
    const withUnknownRegion = { ...jpApartment, region: null };
    expect(() => formatFullHousingAddress(withUnknownRegion, 'ja')).not.toThrow();
    expect(formatFullHousingAddress(withUnknownRegion, 'ja')).toBe(formatHousingAddress(jpApartment, 'ja'));
  });

  it('lang 未指定でも region null フォールバックがクラッシュしない', () => {
    const withUnknownRegion = { ...jpHouse, region: null };
    expect(() => formatFullHousingAddress(withUnknownRegion, undefined)).not.toThrow();
  });
});

describe('formatHousingAddress (既存挙動が変わっていないことの回帰確認)', () => {
  it('house はリージョン/DC を含まない短縮住所のまま', () => {
    expect(formatHousingAddress(jpHouse, 'ja')).toBe('シロガネ 3-12');
    expect(formatHousingAddress(jpHouse, 'en')).toBe('Shirogane 3-12');
  });
});
