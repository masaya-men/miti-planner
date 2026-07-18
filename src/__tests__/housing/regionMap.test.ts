import { describe, it, expect } from 'vitest';
import { pickRegionLocale } from '../../data/housing/regionMap';
import { DC_SERVER_MAP, regionForDC, ALL_REGIONS } from '../../data/housing/dcServerMap';
import { REGION_LABELS } from '../../data/housing/regionMap';

describe('pickRegionLocale', () => {
  it('maps ja / en / ko / zh heads', () => {
    expect(pickRegionLocale('ja')).toBe('ja');
    expect(pickRegionLocale('en-US')).toBe('en');
    expect(pickRegionLocale('ko')).toBe('ko');
    expect(pickRegionLocale('zh-CN')).toBe('zh');
  });
  it('falls back to ja for unknown / empty', () => {
    expect(pickRegionLocale('fr')).toBe('ja');
    expect(pickRegionLocale('')).toBe('ja');
  });
});

describe('KR/CN マスター', () => {
  it('Shadow は EU、Dynamis は 8 ワールド', () => {
    expect(regionForDC('Shadow')).toBe('EU');
    expect(DC_SERVER_MAP['Dynamis'].servers).toHaveLength(8);
  });
  it('Korea は KR で 5 ワールド、CN は 4DC 計 28 ワールド', () => {
    expect(regionForDC('Korea')).toBe('KR');
    expect(DC_SERVER_MAP['Korea'].servers).toHaveLength(5);
    const cnDcs = ['ChocoboCN', 'MoogleCN', 'FatCatCN', 'MameshibaCN'];
    expect(cnDcs.every((d) => regionForDC(d) === 'CN')).toBe(true);
    expect(cnDcs.reduce((n, d) => n + DC_SERVER_MAP[d].servers.length, 0)).toBe(28);
  });
  it('全リージョンに 4 言語ラベルがある', () => {
    for (const r of ALL_REGIONS) {
      for (const l of ['ja', 'en', 'ko', 'zh'] as const) {
        expect(REGION_LABELS[r][l]).toBeTruthy();
      }
    }
  });
});
