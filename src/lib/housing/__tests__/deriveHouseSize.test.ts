import { describe, it, expect } from 'vitest';
import { deriveHouseSize } from '../deriveHouseSize';

describe('deriveHouseSize', () => {
  it('apartment は常に null (area/plot が揃っていても)', () => {
    expect(deriveHouseSize({ buildingType: 'apartment', area: 'Shirogane', plot: 12 })).toBeNull();
  });

  it('area 未確定なら null', () => {
    expect(deriveHouseSize({ buildingType: 'house', plot: 12 })).toBeNull();
  });

  it('plot 未確定なら null', () => {
    expect(deriveHouseSize({ buildingType: 'house', area: 'Shirogane' })).toBeNull();
  });

  it('house + area + plot で正しい S/M/L を返す (Shirogane)', () => {
    // wardPlotSizes 表で検証済み: Shirogane plot 12=S / 13=M / 16=L
    expect(deriveHouseSize({ buildingType: 'house', area: 'Shirogane', plot: 12 })).toBe('S');
    expect(deriveHouseSize({ buildingType: 'house', area: 'Shirogane', plot: 13 })).toBe('M');
    expect(deriveHouseSize({ buildingType: 'house', area: 'Shirogane', plot: 16 })).toBe('L');
  });

  it('拡張街 (plot 31-60) も本街のコピーとして正しく引ける (Shirogane plot 60=L)', () => {
    expect(deriveHouseSize({ buildingType: 'house', area: 'Shirogane', plot: 60 })).toBe('L');
  });

  it('FC個室相当 (roomKind は引数に無い / buildingType=house のまま) でも親 plot のサイズが返る', () => {
    // deriveHouseSize は roomKind を受け取らない。個室でも buildingType='house' なので
    // 同じ (area, plot) で親 plot のサイズ (Shirogane plot 16=L) を返す。
    expect(deriveHouseSize({ buildingType: 'house', area: 'Shirogane', plot: 16 })).toBe('L');
  });

  it('範囲外 plot は null (61 / 0)', () => {
    expect(deriveHouseSize({ buildingType: 'house', area: 'Shirogane', plot: 61 })).toBeNull();
    expect(deriveHouseSize({ buildingType: 'house', area: 'Shirogane', plot: 0 })).toBeNull();
  });

  it('area が不正なら null', () => {
    expect(deriveHouseSize({ buildingType: 'house', area: 'NotAnArea', plot: 12 })).toBeNull();
  });

  it('buildingType 未選択は null (タイプを選ぶまでサイズを導出しない・isHouse === "house" に合わせる)', () => {
    expect(deriveHouseSize({ area: 'Shirogane', plot: 12 })).toBeNull();
  });
});
