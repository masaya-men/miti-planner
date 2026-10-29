import { describe, it, expect } from 'vitest';
import { MITIGATIONS } from '../../../data/mockData';
import type { Mitigation, AppliedMitigation } from '../../../types';
import { resolveSheetTap, buildAppliedMitigation } from '../sheet/sheetTap';
import { useMitigationStore } from '../../../store/useMitigationStore';

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

  it('2 回分ためて相手を選ぶ技は、同じ秒にあっても消さずに相手選び(別の人へ重ねる・使った人を押すと消える)', () => {
    useMitigationStore.setState({ currentLevel: 100 });
    const own = [{ ...placed(benison, 10, 'H1', 'b1'), targetId: 'MT' }];
    expect(resolveSheetTap(benison, 10, own, [], t)).toEqual({ kind: 'selectTarget' });
  });

  it('リキャスト中でもレーン表示と同じく置ける(place + warning・重なりはシェブロンが知らせる)', () => {
    const r = resolveSheetTap(reprisal, 20, [placed(reprisal, 10, 'MT')], [], t);
    expect(r.kind).toBe('place');
    expect((r as any).warning).toBeTruthy();
  });

  it('本当に置けない(2 チャージ技の全消費)は blocked + message', () => {
    const twoCharge = { ...benison, scope: 'self' } as Mitigation;
    const r = resolveSheetTap(twoCharge, 5, [placed(twoCharge, 0, 'H1'), placed(twoCharge, 1, 'H1')], [], t);
    expect(r.kind).toBe('blocked');
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
    // scope を固定した 2 チャージの対象技で、判定を確定的に見る
    const twoCharge = { ...benison, scope: 'target' } as Mitigation;
    expect(twoCharge.maxCharges).toBe(2);
    expect(resolveSheetTap(twoCharge, 5, [placed(twoCharge, 0, 'H1')], [], t)).toEqual({ kind: 'selectTarget' });
    expect(resolveSheetTap(twoCharge, 5, [placed(twoCharge, 0, 'H1'), placed(twoCharge, 1, 'H1')], [], t).kind).toBe('blocked');
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
