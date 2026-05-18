import { describe, it, expect } from 'vitest';
import { buildAddressKey, isSameAddress } from '../../utils/housingDuplicate';
import type { AddressInput } from '../../utils/housingValidation';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward' | 'subdivision'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
  subdivision: 'main',
};

describe('buildAddressKey', () => {
  it('個人宅 (家全体) のキーを生成', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'personal',
      plot: 12,
      size: 'M',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Smain|H12');
  });

  it('FC ハウス (家全体) のキーを生成', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'L',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Smain|H12');
  });

  it('FC 個室のキーを生成 (親 plot + 個室番号)', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 5,
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Smain|H12|C5');
  });

  it('アパート部屋のキーを生成 (plot なし、 アパ番号)', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 42,
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Smain|A42');
  });

  it('subdivision の sub は S sub になる', () => {
    const addr: AddressInput = {
      ...baseAddr,
      subdivision: 'sub',
      buildingType: 'house',
      ownerType: 'personal',
      plot: 1,
      size: 'S',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Ssub|H1');
  });

  it('個人宅 と FC ハウス全体は同 plot なら同キー (ownerType は key 不参加)', () => {
    const personal: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'personal', plot: 12, size: 'M' };
    const fc: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    expect(buildAddressKey(personal)).toBe(buildAddressKey(fc));
  });
});

describe('isSameAddress', () => {
  it('完全一致なら true', () => {
    const a: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    const b: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    expect(isSameAddress(a, b)).toBe(true);
  });

  it('plot 違いなら false', () => {
    const a: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    const b: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 13, size: 'M' };
    expect(isSameAddress(a, b)).toBe(false);
  });

  it('家全体 vs 個室は別アドレス (ソフト重複)', () => {
    const house: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    const chamber: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'M',
      roomKind: 'private_chamber',
      roomNumber: 5,
    };
    expect(isSameAddress(house, chamber)).toBe(false);
  });
});
