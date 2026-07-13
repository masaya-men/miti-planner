import { describe, it, expect } from 'vitest';
import { pickRegionLocale } from '../../data/housing/regionMap';

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
