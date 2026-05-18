/**
 * 同住所判定キー生成 (純粋関数)
 *
 * 設計書 docs/superpowers/specs/2026-05-18-housing-room-types-design.md §3.3 準拠。
 *
 * - 個人宅 / FC 全体: `${dc}|${server}|${area}|W${ward}|S${sub}|H${plot}`
 * - FC 個室:        `...|H${plot}|C${roomNumber}`
 * - アパート部屋:    `...|S${sub}|A${roomNumber}`
 *
 * `ownerType` (personal/fc) は key に含めない。 同 plot は属性確定なので、
 * 含めると重複検知が失敗する (e.g. FC を個人として誤登録 → 別 key 扱い)。
 */
import type { AddressInput } from './housingValidation.js';

export function buildAddressKey(addr: AddressInput): string {
  const base = `${addr.dc}|${addr.server}|${addr.area}|W${addr.ward}|S${addr.subdivision}`;

  if (addr.buildingType === 'house') {
    if (addr.roomKind === 'private_chamber') {
      return `${base}|H${addr.plot}|C${addr.roomNumber}`;
    }
    return `${base}|H${addr.plot}`;
  }

  if (addr.buildingType === 'apartment') {
    return `${base}|A${addr.roomNumber}`;
  }

  throw new Error(`Invalid buildingType: ${String(addr.buildingType)}`);
}

export function isSameAddress(a: AddressInput, b: AddressInput): boolean {
  return buildAddressKey(a) === buildAddressKey(b);
}
