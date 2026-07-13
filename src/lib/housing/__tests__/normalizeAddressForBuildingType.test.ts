import { describe, it, expect } from 'vitest';
import { normalizeAddressForBuildingType } from '../normalizeAddressForBuildingType';
import { validateAddress, type AddressInput } from '../../../utils/housingValidation';

const baseApartment = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Mist',
  ward: 17,
  buildingType: 'apartment' as const,
  apartmentBuilding: 1 as const,
  roomKind: 'apartment_room' as const,
  roomNumber: 13,
};

describe('normalizeAddressForBuildingType', () => {
  it('アパート選択中の不可視 plot/size 残留 (B5: 復元→SNS再取得の注入) を落とし、validateAddress を通す', () => {
    const stale = { ...baseApartment, plot: 56, size: 'S' };
    // 残留したままだと not_allowed_for_apartment で不合格 (バグの再現)
    expect(validateAddress(stale as AddressInput).ok).toBe(false);

    const normalized = normalizeAddressForBuildingType(stale);
    expect(normalized.plot).toBeUndefined();
    expect(normalized.size).toBeUndefined();
    expect(validateAddress(normalized as AddressInput).ok).toBe(true);
  });

  it('house (家全体) 選択中のアパート専用フィールド残留を対称に落とす', () => {
    const stale = {
      dc: 'Mana', server: 'Pandaemonium', area: 'Mist', ward: 17,
      buildingType: 'house' as const, plot: 56, size: 'S',
      apartmentBuilding: 1 as const, roomKind: 'apartment_room' as const, roomNumber: 13,
    };
    const normalized = normalizeAddressForBuildingType(stale);
    expect(normalized.apartmentBuilding).toBeUndefined();
    expect(normalized.roomKind).toBeUndefined();
    expect(normalized.roomNumber).toBeUndefined();
    expect(validateAddress(normalized as AddressInput).ok).toBe(true);
  });

  it('house + FC個室は roomKind/roomNumber を保持する', () => {
    const chamber = {
      dc: 'Mana', server: 'Pandaemonium', area: 'Mist', ward: 17,
      buildingType: 'house' as const, plot: 56, size: 'S',
      roomKind: 'private_chamber' as const, roomNumber: 100,
    };
    const normalized = normalizeAddressForBuildingType(chamber);
    expect(normalized.roomKind).toBe('private_chamber');
    expect(normalized.roomNumber).toBe(100);
    expect(validateAddress(normalized as AddressInput).ok).toBe(true);
  });

  it('buildingType 未選択は素通し', () => {
    const untyped = { dc: '', server: '', area: '', ward: Number.NaN };
    expect(normalizeAddressForBuildingType(untyped)).toEqual(untyped);
  });

  it('アパート判定だが apartmentBuilding 未設定 (SNS自動判定の穴) を既定1で補完し validateAddress を通す (G恒久ブロッカー根治)', () => {
    // SNS 自動判定は buildingType='apartment' + roomKind='apartment_room' は入れるが、
    // 号棟 (apartmentBuilding) は本文から復元しないため undefined のまま残る。号棟 select が
    // value={apartmentBuilding ?? 1} で「1号棟」を表示して未設定を隠蔽し、validateAddress が
    // apartmentBuilding out_of_range で永遠に不合格→canSubmit=false で登録不可になっていた。
    const autoApartment = {
      dc: 'Mana',
      server: 'Pandaemonium',
      area: 'Mist',
      ward: 17,
      buildingType: 'apartment' as const,
      roomKind: 'apartment_room' as const,
      roomNumber: 13,
      // apartmentBuilding は意図的に未設定 (自動判定の穴を再現)
    };
    // 未設定のままだと apartmentBuilding out_of_range で不合格 (バグ再現)
    expect(validateAddress(autoApartment as AddressInput).ok).toBe(false);

    const normalized = normalizeAddressForBuildingType(autoApartment);
    expect(normalized.apartmentBuilding).toBe(1);
    expect(validateAddress(normalized as AddressInput).ok).toBe(true);
  });

  it('apartmentBuilding=2 (拡張街アパート) は既定1で潰さず保持する', () => {
    const sub = {
      dc: 'Mana',
      server: 'Pandaemonium',
      area: 'Mist',
      ward: 17,
      buildingType: 'apartment' as const,
      apartmentBuilding: 2 as const,
      roomKind: 'apartment_room' as const,
      roomNumber: 13,
    };
    const normalized = normalizeAddressForBuildingType(sub);
    expect(normalized.apartmentBuilding).toBe(2);
    expect(validateAddress(normalized as AddressInput).ok).toBe(true);
  });
});
