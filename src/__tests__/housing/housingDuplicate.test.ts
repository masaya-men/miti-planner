import { describe, it, expect } from 'vitest';
import { buildAddressKey, isSameAddress } from '../../utils/housingDuplicate';

describe('buildAddressKey', () => {
  it('住所フィールドを連結した文字列を返す', () => {
    const key = buildAddressKey({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'M',
    });
    expect(key).toBe('Mana|Pandaemonium|Shirogane|W3|P12|M');
  });
  it('Apartment は room 番号を含む', () => {
    const key = buildAddressKey({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'Apartment', apartmentRoom: 45,
    });
    expect(key).toBe('Mana|Pandaemonium|Shirogane|W3|P12|Apartment|R45');
  });
  it('PrivateRoom は room を含まない', () => {
    const key = buildAddressKey({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'PrivateRoom',
    });
    expect(key).toBe('Mana|Pandaemonium|Shirogane|W3|P12|PrivateRoom');
  });
});

describe('isSameAddress', () => {
  const a = { dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane' as const, ward: 3, plot: 12, size: 'M' as const };
  it('全フィールド一致なら true', () => {
    expect(isSameAddress(a, { ...a })).toBe(true);
  });
  it('plot が違うと false', () => {
    expect(isSameAddress(a, { ...a, plot: 13 })).toBe(false);
  });
  it('Apartment 同士で room が違うと false', () => {
    const ap1 = { ...a, size: 'Apartment' as const, apartmentRoom: 45 };
    const ap2 = { ...a, size: 'Apartment' as const, apartmentRoom: 46 };
    expect(isSameAddress(ap1, ap2)).toBe(false);
  });
});
