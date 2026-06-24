import { describe, it, expect } from 'vitest';
import {
  emptyAssignment, assignSlot, groupByRole, autoFillSingles,
  isAssignmentComplete, buildPartyOverride, isSlotRequired, pruneAssignment,
} from '../partyAssignment';

const roleOf = (id: string): 'tank' | 'healer' | 'dps' | undefined =>
  ({ pld: 'tank', war: 'tank', whm: 'healer', ast: 'healer',
     drg: 'dps', mnk: 'dps', blm: 'dps', dnc: 'dps' } as const)[id as 'pld'];

describe('partyAssignment', () => {
  it('emptyAssignment は全枠 null', () => {
    expect(emptyAssignment()).toEqual({ MT: null, ST: null, H1: null, H2: null, D1: null, D2: null, D3: null, D4: null });
  });

  it('assignSlot は 1ジョブ1枠（同ジョブが他枠にあれば外して入替）', () => {
    let a = emptyAssignment();
    a = assignSlot(a, 'MT', 'pld');
    a = assignSlot(a, 'ST', 'pld'); // pld を ST へ→ MT から外れる
    expect(a.MT).toBeNull();
    expect(a.ST).toBe('pld');
  });

  it('assignSlot は jobId=null で枠を空にする', () => {
    let a = assignSlot(emptyAssignment(), 'MT', 'pld');
    a = assignSlot(a, 'MT', null);
    expect(a.MT).toBeNull();
  });

  it('groupByRole は検出ジョブをロール別に（未知ロールは捨てる・順序保持）', () => {
    expect(groupByRole(['pld', 'whm', 'war', 'zzz'], roleOf)).toEqual({
      tank: ['pld', 'war'], healer: ['whm'], dps: [],
    });
  });

  it('autoFillSingles はロール内「未割当1人×空き1枠」を自動で埋める', () => {
    const byRole = { tank: ['pld', 'war'], healer: [] as string[], dps: [] as string[] };
    let a = assignSlot(emptyAssignment(), 'MT', 'pld'); // ST が空・war 未割当→ST に war
    a = autoFillSingles(a, byRole);
    expect(a.ST).toBe('war');
    expect(a.MT).toBe('pld');
  });

  it('autoFillSingles は2人以上未割当なら自動補完しない', () => {
    const byRole = { tank: [] as string[], healer: [] as string[], dps: ['drg', 'mnk', 'blm', 'dnc'] };
    const a = autoFillSingles(emptyAssignment(), byRole);
    expect([a.D1, a.D2, a.D3, a.D4]).toEqual([null, null, null, null]);
  });

  it('isAssignmentComplete は検出ジョブ全員が座れば true', () => {
    const byRole = { tank: ['pld', 'war'], healer: ['whm'], dps: [] as string[] };
    let a = emptyAssignment();
    a = assignSlot(a, 'MT', 'pld');
    a = assignSlot(a, 'ST', 'war');
    expect(isAssignmentComplete(a, byRole)).toBe(false); // whm 未割当
    a = assignSlot(a, 'H1', 'whm');
    expect(isAssignmentComplete(a, byRole)).toBe(true);
  });

  it('isAssignmentComplete はロール枠超過分を capacity 上限でカウント（詰み防止）', () => {
    const byRole = { tank: ['pld', 'war', 'drk'], healer: [] as string[], dps: [] as string[] }; // 3 タンク
    let a = assignSlot(emptyAssignment(), 'MT', 'pld');
    a = assignSlot(a, 'ST', 'war'); // 2枠埋め＝capacity 上限→完了扱い（drk は座れない）
    expect(isAssignmentComplete(a, byRole)).toBe(true);
  });

  it('isSlotRequired はロールに未割当検出ジョブが残る空き枠だけ true', () => {
    const byRole = { tank: ['pld', 'war'], healer: [] as string[], dps: [] as string[] };
    const a = assignSlot(emptyAssignment(), 'MT', 'pld');
    expect(isSlotRequired(a, 'ST', byRole)).toBe(true);   // war 未割当→ST 必須(赤)
    expect(isSlotRequired(a, 'MT', byRole)).toBe(false);  // 埋まっている
    expect(isSlotRequired(a, 'H1', byRole)).toBe(false);  // healer 検出ゼロ→不要
  });

  it('buildPartyOverride は埋まっている枠だけ {slot,jobId}[]（PARTY_SLOTS順）', () => {
    let a = assignSlot(emptyAssignment(), 'H1', 'whm'); // 先に H1
    a = assignSlot(a, 'MT', 'pld');                     // 後から MT
    expect(buildPartyOverride(a)).toEqual([
      { slot: 'MT', jobId: 'pld' },
      { slot: 'H1', jobId: 'whm' },
    ]);
  });

  describe('pruneAssignment', () => {
    it('検出に残っているジョブの割当は保持する', () => {
      const byRole = { tank: ['pld', 'war'], healer: ['whm'], dps: [] as string[] };
      let a = assignSlot(emptyAssignment(), 'MT', 'pld');
      a = assignSlot(a, 'ST', 'war');
      a = assignSlot(a, 'H1', 'whm');
      const pruned = pruneAssignment(a, byRole);
      expect(pruned.MT).toBe('pld');
      expect(pruned.ST).toBe('war');
      expect(pruned.H1).toBe('whm');
    });

    it('検出から消えたジョブの割当は null 化する', () => {
      // war が検出集合から消えた(フェーズ追加/貼り直しで居なくなった)
      const byRole = { tank: ['pld'], healer: ['whm'], dps: [] as string[] };
      let a = assignSlot(emptyAssignment(), 'MT', 'pld');
      a = assignSlot(a, 'ST', 'war'); // war はもう検出に居ない
      a = assignSlot(a, 'H1', 'whm');
      const pruned = pruneAssignment(a, byRole);
      expect(pruned.MT).toBe('pld'); // 残存
      expect(pruned.ST).toBeNull();  // war は消えたので外す
      expect(pruned.H1).toBe('whm'); // 残存
    });

    it('元から null の枠は null のまま', () => {
      const byRole = { tank: ['pld'], healer: [] as string[], dps: [] as string[] };
      const a = assignSlot(emptyAssignment(), 'MT', 'pld');
      const pruned = pruneAssignment(a, byRole);
      expect(pruned.ST).toBeNull();
      expect(pruned.H1).toBeNull();
      expect(pruned.D1).toBeNull();
    });

    it('元の assignment は変更しない(pure function)', () => {
      const byRole = { tank: ['pld'], healer: [] as string[], dps: [] as string[] };
      const a = assignSlot(emptyAssignment(), 'ST', 'war'); // war は検出に居ない
      const pruned = pruneAssignment(a, byRole);
      expect(a.ST).toBe('war');     // 元は不変
      expect(pruned.ST).toBeNull(); // 戻り値だけ null
    });
  });
});
