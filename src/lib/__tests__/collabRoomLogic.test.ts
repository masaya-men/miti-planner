import { describe, it, expect } from 'vitest';
import {
  resolveRoom,
  clampMaxParticipants,
  isCollabDisabled,
  DEFAULT_MAX_PARTICIPANTS,
  SYSTEM_MAX_PARTICIPANTS,
} from '../../../api/collab/_roomLogic';

describe('resolveRoom', () => {
  it('不存在(null) → not-found', () => {
    expect(resolveRoom(null)).toEqual({ ok: false, reason: 'not-found' });
  });
  it('planId 欠落 → not-found', () => {
    expect(resolveRoom({ ownerId: 'u1' })).toEqual({ ok: false, reason: 'not-found' });
  });
  it('失効 → revoked', () => {
    expect(resolveRoom({ planId: 'p1', revoked: true })).toEqual({ ok: false, reason: 'revoked' });
  });
  it('有効 → ok + planId + 丸めた maxParticipants', () => {
    expect(resolveRoom({ planId: 'p1', maxParticipants: 8 }))
      .toEqual({ ok: true, planId: 'p1', maxParticipants: 8 });
  });
  it('maxParticipants 未指定は既定 8', () => {
    expect(resolveRoom({ planId: 'p1' }))
      .toEqual({ ok: true, planId: 'p1', maxParticipants: DEFAULT_MAX_PARTICIPANTS });
  });
});

describe('clampMaxParticipants', () => {
  it('未指定・非数 → 既定 8', () => {
    expect(clampMaxParticipants(undefined)).toBe(DEFAULT_MAX_PARTICIPANTS);
    expect(clampMaxParticipants(NaN)).toBe(DEFAULT_MAX_PARTICIPANTS);
  });
  it('下限 1 未満は 1 に丸め', () => {
    expect(clampMaxParticipants(0)).toBe(1);
    expect(clampMaxParticipants(-5)).toBe(1);
  });
  it('システム上限超過は上限に丸め', () => {
    expect(clampMaxParticipants(999)).toBe(SYSTEM_MAX_PARTICIPANTS);
  });
  it('小数は切り捨て', () => {
    expect(clampMaxParticipants(8.9)).toBe(8);
  });
});

describe('isCollabDisabled', () => {
  it("COLLAB_DISABLED==='1' で true", () => {
    expect(isCollabDisabled({ COLLAB_DISABLED: '1' })).toBe(true);
  });
  it('未設定・他値は false', () => {
    expect(isCollabDisabled({})).toBe(false);
    expect(isCollabDisabled({ COLLAB_DISABLED: '0' })).toBe(false);
    expect(isCollabDisabled({ COLLAB_DISABLED: 'true' })).toBe(false);
  });
});
