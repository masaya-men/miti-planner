import { describe, it, expect } from 'vitest';
import { MITIGATIONS } from '../../../data/mockData';
import type { Mitigation, AppliedMitigation } from '../../../types';
import { resolveSheetTap, buildAppliedMitigation } from '../sheet/sheetTap';

const t = (_k: string, o?: any) => (typeof o === 'string' ? o : o?.defaultValue ?? _k);
const def = (id: string): Mitigation => {
  const m = MITIGATIONS.find(x => x.id === id);
  if (!m) throw new Error(`no def ${id}`);
  return m;
};
const placed = (m: Mitigation, time: number, ownerId: string, id = `p_${m.id}_${time}`): AppliedMitigation => ({
  id, mitigationId: m.id, time, duration: m.duration, ownerId,
});

describe('resolveSheetTap', () => {
  const reprisal = def('reprisal_pld');
  const benison = def('divine_benison');

  it('同じ技が同じ秒にあれば remove', () => {
    const own = [placed(reprisal, 10, 'MT', 'x1')];
    expect(resolveSheetTap(reprisal, 10, own, [], t)).toEqual({ kind: 'remove', id: 'x1' });
  });

  it('リキャスト中は blocked(conflictOverride でも置かない)', () => {
    const r = resolveSheetTap(reprisal, 20, [placed(reprisal, 10, 'MT')], [], t);
    expect(r.kind).toBe('blocked');
    expect((r as any).message).toBeTruthy();
  });

  it('後ろの配置と被る(警告)なら place + warning', () => {
    const r = resolveSheetTap(reprisal, 10, [placed(reprisal, 40, 'MT')], [], t);
    expect(r.kind).toBe('place');
    expect((r as any).warning).toBeTruthy();
  });

  it('警告なしの通常配置は warning なし', () => {
    const r = resolveSheetTap(reprisal, 10, [], [], t);
    expect(r).toEqual({ kind: 'place' });
  });

  it('2 チャージ技は 1 回目のあと blocked にならず(対象技なので selectTarget)、2 回目のあと blocked', () => {
    expect(resolveSheetTap(benison, 5, [placed(benison, 0, 'H1')], [], t).kind).toBe(benison.scope === 'target' ? 'selectTarget' : 'place');
    expect(resolveSheetTap(benison, 5, [placed(benison, 0, 'H1'), placed(benison, 1, 'H1')], [], t).kind).toBe('blocked');
  });

  it('scope target は selectTarget', () => {
    const m = { ...reprisal, id: 'zz_target', scope: 'target' } as Mitigation;
    expect(resolveSheetTap(m, 10, [], [], t)).toEqual({ kind: 'selectTarget' });
  });

  it('copiesShield: 1 枚なら place+linked / 0 枚なら selectShield', () => {
    const m = { ...reprisal, id: 'zz_copy', copiesShield: 'adloquium' } as Mitigation;
    const sh = [{ id: 's1', mitigationId: 'adloquium', time: 0, duration: 30, ownerId: 'H1' } as AppliedMitigation];
    expect(resolveSheetTap(m, 10, [], sh, t)).toEqual({ kind: 'place', linkedMitigationId: 's1' });
    expect(resolveSheetTap(m, 10, [], [], t)).toEqual({ kind: 'selectShield', shields: [] });
  });
});

describe('buildAppliedMitigation', () => {
  it('handleMitigationSelect と同じ形', () => {
    const reprisal = def('reprisal_pld');
    const a = buildAppliedMitigation(reprisal, 10, 'MT', { targetId: 'ST' });
    expect(a).toMatchObject({ mitigationId: reprisal.id, time: 10, duration: reprisal.duration, ownerId: 'MT', targetId: 'ST' });
    expect(typeof a.id).toBe('string');
    expect(a.linkedMitigationId).toBeUndefined();
  });
});
