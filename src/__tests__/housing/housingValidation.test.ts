import { describe, it, expect } from 'vitest';
import { validateAddress, type AddressInput } from '../../utils/housingValidation';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward' | 'subdivision'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
  subdivision: 'main',
};

describe('validateAddress: 4 パターン正常系', () => {
  it('個人宅', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', ownerType: 'personal', plot: 12, size: 'M' });
    expect(r.ok).toBe(true);
  });

  it('FC ハウス全体', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'L' });
    expect(r.ok).toBe(true);
  });

  it('FC 個室', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(true);
  });

  it('アパート部屋', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(true);
  });
});

describe('validateAddress: 不正組合せ reject', () => {
  it('個人宅に個室は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'personal',
      plot: 12,
      size: 'M',
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomKind).toBeDefined();
  });

  it('アパートに plot は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      plot: 12,
      roomKind: 'apartment_room',
      roomNumber: 42,
    } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });

  it('house なのに ownerType 未指定は不可', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'M' } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.ownerType).toBeDefined();
  });

  it('FC 個室の roomNumber 範囲外は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 513,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('アパ部屋 roomNumber 範囲外は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 91,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('plot 範囲外 (31) は不可', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', ownerType: 'personal', plot: 31, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });

  it('subdivision 不正は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      subdivision: 'invalid',
      buildingType: 'house',
      ownerType: 'personal',
      plot: 12,
      size: 'M',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.subdivision).toBeDefined();
  });

  it('FC 個室で size 未指定は不可 (親 plot のサイズが必要)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      roomKind: 'private_chamber',
      roomNumber: 5,
    } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBeDefined();
  });
});
