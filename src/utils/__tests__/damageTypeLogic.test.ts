import { describe, it, expect } from 'vitest';
import { isMitigationBlockedByEvent, nextDamageType } from '../damageTypeLogic';
import type { TimelineEvent, Mitigation } from '../../types';

const ev = (over: Partial<TimelineEvent>): TimelineEvent => ({
  id: 'e', time: 0, name: { ja: '', en: '' }, damageType: 'magical', ...over,
});
const mit = (over: Partial<Mitigation>): Mitigation => ({
  id: 'm', jobId: 'war', name: { ja: '', en: '' }, icon: '', recast: 0, duration: 0,
  type: 'all', value: 10, ...over,
});

describe('isMitigationBlockedByEvent', () => {
  it('フラグON × デバフ軽減 → ブロックする', () => {
    expect(isMitigationBlockedByEvent(ev({ ignoresDebuffMitigation: true }), mit({ appliesAsDebuff: true }))).toBe(true);
  });
  it('フラグON × 通常軽減 → ブロックしない', () => {
    expect(isMitigationBlockedByEvent(ev({ ignoresDebuffMitigation: true }), mit({ appliesAsDebuff: false }))).toBe(false);
  });
  it('フラグOFF × デバフ軽減 → ブロックしない', () => {
    expect(isMitigationBlockedByEvent(ev({ ignoresDebuffMitigation: false }), mit({ appliesAsDebuff: true }))).toBe(false);
  });
  it('未設定(両方undefined) → ブロックしない', () => {
    expect(isMitigationBlockedByEvent(ev({}), mit({}))).toBe(false);
  });
});

describe('nextDamageType', () => {
  it('physical → magical → unavoidable → physical で循環', () => {
    expect(nextDamageType('physical')).toBe('magical');
    expect(nextDamageType('magical')).toBe('unavoidable');
    expect(nextDamageType('unavoidable')).toBe('physical');
  });
  it('循環外(enrage 等)は physical に寄せる', () => {
    expect(nextDamageType('enrage')).toBe('physical');
  });
});
