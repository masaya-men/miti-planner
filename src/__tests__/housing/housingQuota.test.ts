import { describe, it, expect } from 'vitest';
import {
  evaluateCanRegister,
  applyRegistrationSuccess,
  applySameDayDelete,
  initialUserMeta,
  isNewDayUTC,
  registrationTicketsRemaining,
} from '../../utils/housingQuota';
import type { HousingUserMeta } from '../../types/housing';

const NOW = Date.UTC(2026, 4, 8, 12, 0, 0); // 2026-05-08 12:00 UTC

describe('initialUserMeta', () => {
  it('count=0, remaining=5, lastReset=now', () => {
    const m = initialUserMeta(NOW);
    expect(m.registrationCount).toBe(0);
    expect(m.dailyQuota.remaining).toBe(5);
    expect(m.dailyQuota.lastReset).toBe(NOW);
  });
});

describe('isNewDayUTC', () => {
  it('同じ日は false', () => {
    expect(isNewDayUTC(NOW, NOW + 60_000)).toBe(false);
  });
  it('翌日 0:00 UTC は true', () => {
    const next = Date.UTC(2026, 4, 9, 0, 0, 1);
    expect(isNewDayUTC(NOW, next)).toBe(true);
  });
});

describe('evaluateCanRegister', () => {
  it('count<30 なら無条件 OK', () => {
    const meta: HousingUserMeta = { registrationCount: 10, dailyQuota: { remaining: 0, lastReset: NOW } };
    const r = evaluateCanRegister(meta, NOW);
    expect(r.allowed).toBe(true);
  });
  it('count=30, 同日, remaining>0 なら OK', () => {
    const meta: HousingUserMeta = { registrationCount: 30, dailyQuota: { remaining: 3, lastReset: NOW } };
    expect(evaluateCanRegister(meta, NOW).allowed).toBe(true);
  });
  it('count=30, 同日, remaining=0 はエラー', () => {
    const meta: HousingUserMeta = { registrationCount: 30, dailyQuota: { remaining: 0, lastReset: NOW } };
    const r = evaluateCanRegister(meta, NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('quota_exhausted');
  });
  it('count=30, 翌日, remaining=0 でも quota リセットで OK', () => {
    const meta: HousingUserMeta = { registrationCount: 30, dailyQuota: { remaining: 0, lastReset: NOW } };
    const next = Date.UTC(2026, 4, 9, 0, 0, 1);
    const r = evaluateCanRegister(meta, next);
    expect(r.allowed).toBe(true);
    expect(r.metaAfterReset?.dailyQuota.remaining).toBe(5);
  });
});

describe('applyRegistrationSuccess', () => {
  it('count=29 → count=30, remaining 変化なし', () => {
    const meta: HousingUserMeta = { registrationCount: 29, dailyQuota: { remaining: 5, lastReset: NOW } };
    const after = applyRegistrationSuccess(meta);
    expect(after.registrationCount).toBe(30);
    expect(after.dailyQuota.remaining).toBe(5);
  });
  it('count=30 → count=31, remaining -1', () => {
    const meta: HousingUserMeta = { registrationCount: 30, dailyQuota: { remaining: 5, lastReset: NOW } };
    const after = applyRegistrationSuccess(meta);
    expect(after.registrationCount).toBe(31);
    expect(after.dailyQuota.remaining).toBe(4);
  });
});

describe('applySameDayDelete', () => {
  it('同日削除で count -1', () => {
    const meta: HousingUserMeta = { registrationCount: 31, dailyQuota: { remaining: 4, lastReset: NOW } };
    const after = applySameDayDelete(meta, NOW, NOW + 1000);
    expect(after.registrationCount).toBe(30);
    expect(after.dailyQuota.remaining).toBe(5); // 30 に戻ったので remaining +1
  });
  it('翌日以降の削除は変化なし', () => {
    const meta: HousingUserMeta = { registrationCount: 31, dailyQuota: { remaining: 4, lastReset: NOW } };
    const next = Date.UTC(2026, 4, 9, 0, 0, 1);
    const after = applySameDayDelete(meta, NOW, next);
    expect(after.registrationCount).toBe(31);
    expect(after.dailyQuota.remaining).toBe(4);
  });
});

describe('registrationTicketsRemaining', () => {
  it('登録数に応じて 30 から減り、使い切ると 0 (マイナスにならない)', () => {
    expect(registrationTicketsRemaining(0)).toBe(30);
    expect(registrationTicketsRemaining(29)).toBe(1);
    expect(registrationTicketsRemaining(30)).toBe(0);
    expect(registrationTicketsRemaining(50)).toBe(0);
  });
});
