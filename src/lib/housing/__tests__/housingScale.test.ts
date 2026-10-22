// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { getHousingScale, hpx, scalePx } from '../housingScale';

describe('housingScale', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--housing-scale');
  });

  it('倍率が未定義なら 1', () => {
    expect(getHousingScale()).toBe(1);
    expect(scalePx(24)).toBe(24);
  });

  it('--housing-scale を読んで px を換算する', () => {
    document.documentElement.style.setProperty('--housing-scale', '0.75');
    expect(getHousingScale()).toBe(0.75);
    expect(scalePx(24)).toBe(18);
  });

  it('不正な値は 1 に戻す', () => {
    document.documentElement.style.setProperty('--housing-scale', 'abc');
    expect(getHousingScale()).toBe(1);
    document.documentElement.style.setProperty('--housing-scale', '0');
    expect(getHousingScale()).toBe(1);
  });

  it('hpx は倍率付き calc 文字列を返す', () => {
    expect(hpx(24)).toBe('calc(24px * var(--housing-scale))');
  });
});
