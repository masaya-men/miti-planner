/**
 * ハウジング登録枠 (D 案) ロジック
 *
 * 設計書 §6.4 準拠。純粋関数のみ。Firestore I/O は呼び出し側 (API ハンドラ) で行う。
 *
 * - 累計 30 件まで無制限
 * - 30 件超過後は 1 日 5 件まで (UTC 日付ベース)
 * - 同日削除なら count を戻す (registrationCount が 30 を境に remaining も連動復活)
 */
import type { HousingUserMeta } from '../types/housing.js';
import { REGISTRATION_INITIAL_BONUS, REGISTRATION_DAILY_QUOTA } from '../constants/housing.js';

export function initialUserMeta(now: number): HousingUserMeta {
  return {
    registrationCount: 0,
    dailyQuota: { remaining: REGISTRATION_DAILY_QUOTA, lastReset: now },
  };
}

export function isNewDayUTC(prev: number, now: number): boolean {
  const a = new Date(prev);
  const b = new Date(now);
  return (
    a.getUTCFullYear() !== b.getUTCFullYear() ||
    a.getUTCMonth() !== b.getUTCMonth() ||
    a.getUTCDate() !== b.getUTCDate()
  );
}

export interface CanRegisterResult {
  allowed: boolean;
  reason?: 'quota_exhausted';
  metaAfterReset?: HousingUserMeta;
}

export function evaluateCanRegister(meta: HousingUserMeta, now: number): CanRegisterResult {
  if (meta.registrationCount < REGISTRATION_INITIAL_BONUS) {
    return { allowed: true };
  }
  let current = meta;
  if (isNewDayUTC(meta.dailyQuota.lastReset, now)) {
    current = {
      ...meta,
      dailyQuota: { remaining: REGISTRATION_DAILY_QUOTA, lastReset: now },
    };
  }
  if (current.dailyQuota.remaining > 0) {
    return { allowed: true, metaAfterReset: current };
  }
  return { allowed: false, reason: 'quota_exhausted' };
}

export function applyRegistrationSuccess(meta: HousingUserMeta): HousingUserMeta {
  const newCount = meta.registrationCount + 1;
  const consumeQuota = newCount > REGISTRATION_INITIAL_BONUS;
  return {
    ...meta,
    registrationCount: newCount,
    dailyQuota: consumeQuota
      ? { ...meta.dailyQuota, remaining: meta.dailyQuota.remaining - 1 }
      : meta.dailyQuota,
  };
}

export function applySameDayDelete(
  meta: HousingUserMeta,
  listingCreatedAt: number,
  now: number,
): HousingUserMeta {
  if (isNewDayUTC(listingCreatedAt, now)) return meta;
  const newCount = Math.max(0, meta.registrationCount - 1);
  // 30 を境に remaining が連動復活する (count > 30 から count <= 30 に戻ったら +1)
  const restoreQuota = meta.registrationCount > REGISTRATION_INITIAL_BONUS;
  return {
    ...meta,
    registrationCount: newCount,
    dailyQuota: restoreQuota
      ? {
          ...meta.dailyQuota,
          remaining: Math.min(REGISTRATION_DAILY_QUOTA, meta.dailyQuota.remaining + 1),
        }
      : meta.dailyQuota,
  };
}

/** 初回登録チケットの残り枚数 (使い切ると 0)。表示用の純粋関数。 */
export function registrationTicketsRemaining(registrationCount: number): number {
  return Math.max(0, REGISTRATION_INITIAL_BONUS - registrationCount);
}
