import { describe, it, expect } from 'vitest';
import { housingExtractResultToAddressPatch } from '../housingExtractResultToAddressPatch';
import type { HousingExtractResult } from '../parseHousingFromText';

function result(overrides: Partial<HousingExtractResult>): HousingExtractResult {
  return { ambiguity: [], ...overrides };
}

describe('housingExtractResultToAddressPatch (2026-08-19 Allmarksまとめてインポート用に抽出)', () => {
  it('house: area/ward/plot/size/dc/serverをpatchへ変換する', () => {
    const r = result({ area: 'Mist', ward: 12, plot: 34, size: 'M', dc: 'Elemental', server: 'Carbuncle' });
    expect(housingExtractResultToAddressPatch(r)).toEqual({
      area: 'Mist',
      ward: 12,
      dc: 'Elemental',
      server: 'Carbuncle',
      buildingType: 'house',
      plot: 34,
      size: 'M',
    });
  });

  it('apartment: size=Apartmentならbuilding/roomKindを組み立てる (plot/sizeは載せない)', () => {
    const r = result({ area: 'Mist', ward: 5, size: 'Apartment' });
    expect(housingExtractResultToAddressPatch(r)).toEqual({
      area: 'Mist',
      ward: 5,
      buildingType: 'apartment',
      apartmentBuilding: 1,
      roomKind: 'apartment_room',
    });
  });

  it('apartment: パーサーがroomNumber/apartmentBuildingを検出済みならpatchへコピーする (実ツイート例: Mist|17|Topmast 1-25|Apartment)', () => {
    const r = result({ area: 'Mist', ward: 17, size: 'Apartment', apartmentBuilding: 1, roomNumber: 25 });
    expect(housingExtractResultToAddressPatch(r)).toEqual({
      area: 'Mist',
      ward: 17,
      buildingType: 'apartment',
      apartmentBuilding: 1,
      roomKind: 'apartment_room',
      roomNumber: 25,
    });
  });

  it('apartment: 拡張街(号棟2)を検出したらapartmentBuilding=1に固定せずそのまま使う', () => {
    const r = result({ area: 'Mist', ward: 17, size: 'Apartment', apartmentBuilding: 2, roomNumber: 40 });
    const patch = housingExtractResultToAddressPatch(r);
    expect(patch?.apartmentBuilding).toBe(2);
    expect(patch?.roomNumber).toBe(40);
  });

  it('曖昧 (ambiguity.length > 0) ならnull (推測で埋めない)', () => {
    const r = result({ area: 'Mist', ward: 5, ambiguity: ['area'] });
    expect(housingExtractResultToAddressPatch(r)).toBeNull();
  });

  it('何も取れなければnull', () => {
    const r = result({});
    expect(housingExtractResultToAddressPatch(r)).toBeNull();
  });

  it('無効なareaは含めない (isValidHousingArea)', () => {
    const r = result({ area: 'not-a-real-area', ward: 5 });
    const patch = housingExtractResultToAddressPatch(r);
    expect(patch?.area).toBeUndefined();
    expect(patch?.ward).toBe(5);
  });
});
