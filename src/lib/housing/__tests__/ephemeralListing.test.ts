import { describe, it, expect } from 'vitest';
import {
  EPHEMERAL_ID_PREFIX,
  isEphemeralListingId,
  validateEphemeralInput,
  createEphemeralListing,
  type EphemeralInput,
} from '../ephemeralListing';
import { buildAddressKey } from '../../../utils/housingDuplicate';
import type { HousingArea } from '../../../store/useHousingFilterStore';

const baseHouse: EphemeralInput = {
  area: 'Mist',
  ward: 5,
  buildingType: 'house',
  plot: 12,
  size: 'M',
};

const baseApartment: EphemeralInput = {
  area: 'Shirogane',
  ward: 10,
  buildingType: 'apartment',
  apartmentBuilding: 2,
  roomNumber: 45,
};

describe('isEphemeralListingId', () => {
  it('ephemeral- prefix は true', () => {
    expect(isEphemeralListingId('ephemeral-12345-1')).toBe(true);
  });

  it('mock- 等の他 prefix は false', () => {
    expect(isEphemeralListingId('mock-001')).toBe(false);
  });

  it('factory が生成した id は true と判定される (一時判定の唯一の根拠)', () => {
    expect(isEphemeralListingId(createEphemeralListing(baseHouse).id)).toBe(true);
  });
});

describe('validateEphemeralInput', () => {
  // dc/server 必須化 (Task 2) 後もこのブロックの境界値テストは area/ward/plot/room の検証を
  // 見るためのもの。世界 (dc/server) は常に充足させておき、missing_dc/missing_server で
  // 先に弾かれないようにする (ローカル shadow・外側の baseHouse/baseApartment は
  // createEphemeralListing のテスト用に dc/server 未指定のまま維持)。
  const baseHouse: EphemeralInput = {
    area: 'Mist',
    ward: 5,
    buildingType: 'house',
    plot: 12,
    size: 'M',
    dc: 'Mana',
    server: 'Anima',
  };

  const baseApartment: EphemeralInput = {
    area: 'Shirogane',
    ward: 10,
    buildingType: 'apartment',
    apartmentBuilding: 2,
    roomNumber: 45,
    dc: 'Mana',
    server: 'Anima',
  };

  it('正常な house 入力は ok:true', () => {
    expect(validateEphemeralInput(baseHouse)).toEqual({ ok: true });
  });

  it('正常な apartment 入力は ok:true', () => {
    expect(validateEphemeralInput(baseApartment)).toEqual({ ok: true });
  });

  it('area が不正なら invalid_area', () => {
    expect(validateEphemeralInput({ ...baseHouse, area: 'Unknown' as HousingArea })).toEqual({
      ok: false,
      error: 'invalid_area',
    });
  });

  it.each([0, 31])('ward が境界外 (%i) なら invalid_ward', (ward) => {
    expect(validateEphemeralInput({ ...baseHouse, ward })).toEqual({ ok: false, error: 'invalid_ward' });
  });

  it.each([1, 30])('ward が境界内 (%i) なら ok', (ward) => {
    expect(validateEphemeralInput({ ...baseHouse, ward })).toEqual({ ok: true });
  });

  it.each([0, 61])('house: plot が境界外 (%i) なら invalid_plot', (plot) => {
    expect(validateEphemeralInput({ ...baseHouse, plot })).toEqual({ ok: false, error: 'invalid_plot' });
  });

  it.each([1, 60])('house: plot が境界内 (%i) なら ok', (plot) => {
    expect(validateEphemeralInput({ ...baseHouse, plot })).toEqual({ ok: true });
  });

  it('house: plot 未指定は invalid_plot', () => {
    expect(validateEphemeralInput({ ...baseHouse, plot: undefined })).toEqual({
      ok: false,
      error: 'invalid_plot',
    });
  });

  it.each([0, 91])('apartment: roomNumber が境界外 (%i) なら invalid_room', (roomNumber) => {
    expect(validateEphemeralInput({ ...baseApartment, roomNumber })).toEqual({
      ok: false,
      error: 'invalid_room',
    });
  });

  it.each([1, 90])('apartment: roomNumber が境界内 (%i) なら ok', (roomNumber) => {
    expect(validateEphemeralInput({ ...baseApartment, roomNumber })).toEqual({ ok: true });
  });

  it('apartment: roomNumber 未指定は invalid_room', () => {
    expect(validateEphemeralInput({ ...baseApartment, roomNumber: undefined })).toEqual({
      ok: false,
      error: 'invalid_room',
    });
  });
});

describe('validateEphemeralInput: ワールド必須', () => {
  const base = { area: 'Mist' as const, ward: 3, buildingType: 'house' as const, plot: 15 };
  it('dc 未指定は missing_dc', () => {
    expect(validateEphemeralInput({ ...base, server: 'Anima' })).toEqual({ ok: false, error: 'missing_dc' });
  });
  it('server 未指定は missing_server', () => {
    expect(validateEphemeralInput({ ...base, dc: 'Mana' })).toEqual({ ok: false, error: 'missing_server' });
  });
  it('dc+server 揃えば ok', () => {
    expect(validateEphemeralInput({ ...base, dc: 'Mana', server: 'Anima' })).toEqual({ ok: true });
  });
});

describe('createEphemeralListing', () => {
  it('house 入力から MockListing 必須フィールドを全て埋める', () => {
    const listing = createEphemeralListing(baseHouse);

    expect(listing.id.startsWith(EPHEMERAL_ID_PREFIX)).toBe(true);
    expect(listing.ownerUid).toBe('__ephemeral__');
    expect(listing.dc).toBe('');
    expect(listing.server).toBe('');
    expect(['JP', 'NA', 'EU', 'OCE']).toContain(listing.region);
    expect(listing.area).toBe('Mist');
    expect(listing.ward).toBe(5);
    expect(listing.buildingType).toBe('house');
    expect(listing.plot).toBe(12);
    expect(listing.size).toBe('M');
    expect(listing.apartmentBuilding).toBeUndefined();
    expect(listing.roomNumber).toBeUndefined();
    expect(listing.imageMode).toBe('none');
    expect(listing.tags).toEqual([]);
    expect(listing.visibility).toBe('public');
    expect(typeof listing.createdAt).toBe('number');
    expect(listing.createdAt).toBe(listing.lastConfirmedAt);
    expect(typeof listing.addressKey).toBe('string');
    expect(listing.addressKey.length).toBeGreaterThan(0);
  });

  it('apartment 入力: apartmentBuilding 未指定は 1 既定・roomNumber を保持・plot/size は undefined', () => {
    const listing = createEphemeralListing({ ...baseApartment, apartmentBuilding: undefined });

    expect(listing.buildingType).toBe('apartment');
    expect(listing.apartmentBuilding).toBe(1);
    expect(listing.roomNumber).toBe(45);
    expect(listing.plot).toBeUndefined();
    expect(listing.size).toBeUndefined();
  });

  it('apartmentBuilding 指定時はそのまま使う', () => {
    const listing = createEphemeralListing(baseApartment);
    expect(listing.apartmentBuilding).toBe(2);
  });

  it('ogImageUrl があれば imageMode=sns、なければ none', () => {
    expect(createEphemeralListing(baseHouse).imageMode).toBe('none');
    expect(
      createEphemeralListing({ ...baseHouse, ogImageUrl: 'https://pbs.twimg.com/x.jpg' }).imageMode,
    ).toBe('sns');
  });

  it('dc が dcServerMap に存在すれば region を解決する', () => {
    const listing = createEphemeralListing({ ...baseHouse, dc: 'Mana', server: 'Anima' });
    expect(listing.region).toBe('JP');
    expect(listing.dc).toBe('Mana');
    expect(listing.server).toBe('Anima');
  });

  it('dc が未知/未指定なら Region 型の既定値にフォールバックする (プレースホルダーではない実在の値)', () => {
    const noDc = createEphemeralListing(baseHouse);
    const unknownDc = createEphemeralListing({ ...baseHouse, dc: 'NoSuchDC' });
    expect(['JP', 'NA', 'EU', 'OCE']).toContain(noDc.region);
    expect(['JP', 'NA', 'EU', 'OCE']).toContain(unknownDc.region);
  });

  it('addressKey は既存 buildAddressKey (housingDuplicate.ts) と同一ロジックで生成される', () => {
    const listing = createEphemeralListing({ ...baseHouse, dc: 'Mana', server: 'Anima' });
    expect(listing.addressKey).toBe(
      buildAddressKey({
        dc: 'Mana',
        server: 'Anima',
        area: 'Mist',
        ward: 5,
        buildingType: 'house',
        plot: 12,
      }),
    );
  });

  it('addressKey は apartment でも既存 buildAddressKey と同一ロジックで生成される', () => {
    const listing = createEphemeralListing(baseApartment);
    expect(listing.addressKey).toBe(
      buildAddressKey({
        dc: '',
        server: '',
        area: 'Shirogane',
        ward: 10,
        buildingType: 'apartment',
        apartmentBuilding: 2,
        roomNumber: 45,
      }),
    );
  });

  it('同一 tick で連続生成しても id は重複しない', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(createEphemeralListing(baseHouse).id);
    }
    expect(ids.size).toBe(50);
  });
});
