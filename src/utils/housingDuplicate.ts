/**
 * 同住所判定キー生成 (純粋関数)
 *
 * 設計書 docs/superpowers/specs/2026-05-18-housing-room-types-design.md §3.3 (2026-05-19 訂正版) 準拠。
 *
 * - 家全体:       `${dc}|${server}|${area}|W${ward}|H${plot}`
 * - FC 個室:      `...|H${plot}|C${roomNumber}`
 * - アパート部屋: `...|W${ward}|A${roomNumber}`
 *
 * subdivision (本街/拡張街) は plot 番号 (1-30 vs 31-60 通し) で判別可能なため key 不参加。
 * ownerType (個人/FC) は schema 削除済み。
 */
import type { AddressInput } from './housingValidation.js';

export function buildAddressKey(addr: AddressInput): string {
  const base = `${addr.dc}|${addr.server}|${addr.area}|W${addr.ward}`;

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
