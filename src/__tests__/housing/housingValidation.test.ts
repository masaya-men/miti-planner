import { describe, it, expect } from 'vitest';
import { validateAddress } from '../../utils/housingValidation';
import type { AddressInput } from '../../utils/housingRegistrationTypes';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
};

describe('validateAddress: 3 パターン正常系', () => {
  it('家全体 (本街、 plot 12)', () => {
    // Shirogane plot 12 の区画サイズは S (wardPlotSizes 表で確定)。
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'S' });
    expect(r.ok).toBe(true);
  });

  it('家全体 (拡張街、 plot 45)', () => {
    // Shirogane plot 45 (=本街 plot 15) の区画サイズは M。
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 45, size: 'M' });
    expect(r.ok).toBe(true);
  });

  it('FC 個室 (親 plot 12、 個室 5)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'S', // 親 plot 12 (Shirogane) のサイズ = S
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(true);
  });

  it('アパート部屋 (号棟 1 + 部屋 42)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      apartmentBuilding: 1,
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(true);
  });

  it('アパート 号棟 1/2 以外は out_of_range', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      // @ts-expect-error 検証目的で意図的に範囲外の値を渡す
      apartmentBuilding: 3,
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.apartmentBuilding).toBe('out_of_range');
  });

  it('アパート 号棟未指定は out_of_range', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.apartmentBuilding).toBe('out_of_range');
  });
});

describe('validateAddress: 境界値', () => {
  it('plot 31 (拡張街最初) は正常', () => {
    // Shirogane plot 31 (=本街 plot 1) の区画サイズは M。
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 31, size: 'M' });
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
      size: 'S', // 親 plot 12 (Shirogane) のサイズ = S (roomNumber エラーを単独で検証)
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

describe('validateAddress: size と区画サイズの整合 (mismatch_with_plot)', () => {
  it('size が区画から決まるサイズと食い違うと mismatch_with_plot', () => {
    // Shirogane plot 12 の正しいサイズは S。M を渡すと不一致。
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBe('mismatch_with_plot');
  });

  it('size が区画から決まるサイズと一致すれば ok', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'S' });
    expect(r.ok).toBe(true);
  });

  it('FC個室でも親 plot のサイズと食い違えば mismatch_with_plot', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 16, // Shirogane plot 16 = L
      size: 'M',
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBe('mismatch_with_plot');
  });

  it('plot が範囲外のときは mismatch を出さず plot エラーのみ (二重エラー回避)', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 61, size: 'M' });
    expect(r.errors.plot).toBeDefined();
    expect(r.errors.size).not.toBe('mismatch_with_plot');
  });

  it('size 未指定のときは invalid のまま (mismatch で上書きしない)', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12 } as AddressInput);
    expect(r.errors.size).toBe('invalid');
  });

  it('apartment は size 整合チェック対象外 (従来どおり ok)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      apartmentBuilding: 1,
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(true);
  });
});

describe('validateAddress: DC/ワールド実在検証 (中韓対応)', () => {
  // Mist plot 1 の実サイズは M (wardPlotSizes.ts PLOT_SIZE_BY_AREA.Mist[0])。
  // size を S にすると mismatch_with_plot が別途発生し「正しい組は通る」テストが成立しないため M を使う。
  const base = { area: 'Mist', ward: 1, buildingType: 'house', plot: 1, size: 'M' } as const;

  it('実在しない DC を弾く', () => {
    const r = validateAddress({ ...base, dc: 'Nonexistent', server: 'Aegis' });
    expect(r.ok).toBe(false);
    expect(r.errors.dc).toBe('unknown');
  });

  it('DC 配下に無いワールドを弾く (KR の Carbuncle を JP DC で名乗る等)', () => {
    const r = validateAddress({ ...base, dc: 'Korea', server: 'Aegis' });
    expect(r.ok).toBe(false);
    expect(r.errors.server).toBe('unknown');
  });

  it('KR/CN の正しい組は通る', () => {
    expect(validateAddress({ ...base, dc: 'Korea', server: 'Carbuncle' }).ok).toBe(true);
    expect(validateAddress({ ...base, dc: 'ChocoboCN', server: 'RubySea' }).ok).toBe(true);
  });
});
