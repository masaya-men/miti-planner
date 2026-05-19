import { describe, it, expect } from 'vitest';
import { validateAddress, type AddressInput } from '../../utils/housingValidation';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
};

describe('validateAddress: 3 パターン正常系', () => {
  it('家全体 (本街、 plot 12)', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'M' });
    expect(r.ok).toBe(true);
  });

  it('家全体 (拡張街、 plot 45)', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 45, size: 'L' });
    expect(r.ok).toBe(true);
  });

  it('FC 個室 (親 plot 12、 個室 5)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(true);
  });

  it('アパート部屋 (部屋 42)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(true);
  });
});

describe('validateAddress: 境界値', () => {
  it('plot 31 (拡張街最初) は正常', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 31, size: 'S' });
    expect(r.ok).toBe(true);
  });

  it('plot 60 (拡張街最後) は正常', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 60, size: 'L' });
    expect(r.ok).toBe(true);
  });

  it('plot 61 は範囲外', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 61, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });

  it('plot 0 は範囲外', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 0, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });
});

describe('validateAddress: 不正組合せ reject', () => {
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

  it('FC 個室の roomNumber 範囲外 (513) は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 513,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('アパ部屋 roomNumber 範囲外 (91) は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 91,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('house なのに size 未指定は不可', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12 } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBeDefined();
  });

  it('FC 個室で size 未指定は不可 (親 plot のサイズが必要)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      roomKind: 'private_chamber',
      roomNumber: 5,
    } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBeDefined();
  });
});
