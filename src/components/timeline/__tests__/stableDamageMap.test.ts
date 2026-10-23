import { describe, it, expect } from 'vitest';
import { reuseEqualDamages } from '../stableDamageMap';

const d = (mitigated: number, stacks?: number): { unmitigated: number; mitigated: number; mitigationPercent: number; shieldTotal: number; isInvincible: boolean; mitigationStates: Record<string, { stacks?: number }> } => ({
  unmitigated: 60000, mitigated, mitigationPercent: 10, shieldTotal: 0, isInvincible: false,
  mitigationStates: stacks === undefined ? {} : { a: { stacks } },
});

describe('reuseEqualDamages', () => {
  it('中身が同じ行は前回と同じ参照、変わった行だけ新しい参照', () => {
    const prev = new Map([['e1', d(100)], ['e2', d(200)]]);
    const next = new Map([['e1', d(100)], ['e2', d(150)]]);
    const out = reuseEqualDamages(prev, next);
    expect(out.get('e1')).toBe(prev.get('e1'));
    expect(out.get('e2')).toBe(next.get('e2'));
    expect(out.get('e2')!.mitigated).toBe(150);
  });
  it('mitigationStates の stacks が違えば別物', () => {
    const prev = new Map([['e1', d(100, 1)]]);
    const out = reuseEqualDamages(prev, new Map([['e1', d(100, 2)]]));
    expect(out.get('e1')!.mitigationStates!.a.stacks).toBe(2);
  });
  it('前回が無い・新しいイベントはそのまま', () => {
    const next = new Map([['e1', d(1)]]);
    expect(reuseEqualDamages(undefined, next).get('e1')).toBe(next.get('e1'));
  });
});
