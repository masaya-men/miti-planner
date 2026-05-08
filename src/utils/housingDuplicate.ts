/**
 * 同住所判定キー生成 (純粋関数)
 *
 * 設計書 §6.5 の重複登録ハンドリングに使用。
 * housing_listings ドキュメントに addressKey フィールドを保存し、
 * `where('addressKey', '==', key)` で一致を検索する。
 */
import type { AddressInput } from './housingValidation.js';

export function buildAddressKey(addr: AddressInput): string {
  const base = `${addr.dc}|${addr.server}|${addr.area}|W${addr.ward}|P${addr.plot}|${addr.size}`;
  if (addr.size === 'Apartment' && addr.apartmentRoom !== undefined) {
    return `${base}|R${addr.apartmentRoom}`;
  }
  return base;
}

export function isSameAddress(a: AddressInput, b: AddressInput): boolean {
  return buildAddressKey(a) === buildAddressKey(b);
}
