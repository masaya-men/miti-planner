import { describe, it, expect } from 'vitest';
import { buildAddressKey, isSameAddress } from '../../utils/housingDuplicate';
import type { AddressInput } from '../../utils/housingValidation';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
};

describe('buildAddressKey', () => {
  it('家全体 (本街、 plot 12) のキーを生成', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'M',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|H12');
  });

  it('家全体 (拡張街、 plot 45) のキーを生成', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      plot: 45,
      size: 'L',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|H45');
  });

  it('FC 個室のキーを生成 (親 plot + 個室番号)', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 5,
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|H12|C5');
  });

  it('アパート部屋のキーを生成 (plot なし、 アパ番号)', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 42,
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|A42');
  });

  it('plot 31 (拡張街最初) と plot 30 (本街最後) は別キー', () => {
    const p30: AddressInput = { ...baseAddr, buildingType: 'house', plot: 30, size: 'S' };
    const p31: AddressInput = { ...baseAddr, buildingType: 'house', plot: 31, size: 'S' };
    expect(buildAddressKey(p30)).not.toBe(buildAddressKey(p31));
  });
});

describe('isSameAddress', () => {
  it('完全一致なら true', () => {
    const a: AddressInput = { ...baseAddr, buildingType: 'house', plot: 12, size: 'M' };
    const b: AddressInput = { ...baseAddr, buildingType: 'house', plot: 12, size: 'M' };
    expect(isSameAddress(a, b)).toBe(true);
  });

  it('plot 違いなら false', () => {
    const a: AddressInput = { ...baseAddr, buildingType: 'house', plot: 12, size: 'M' };
    const b: AddressInput = { ...baseAddr, buildingType: 'house', plot: 13, size: 'M' };
    expect(isSameAddress(a, b)).toBe(false);
  });

  it('家全体 vs 個室は別アドレス (ソフト重複)', () => {
    const house: AddressInput = { ...baseAddr, buildingType: 'house', plot: 12, size: 'M' };
    const chamber: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'M',
      roomKind: 'private_chamber',
      roomNumber: 5,
    };
    expect(isSameAddress(house, chamber)).toBe(false);
  });
});
