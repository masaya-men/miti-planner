import { describe, it, expect } from 'vitest';
import {
  emptyAssignment, assignSlot, groupByRole, autoFillSingles,
  isAssignmentComplete, buildPartyOverride, isSlotRequired, pruneAssignment, seedAssignment,
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

  describe('seedAssignment', () => {
    const J = (id: string, role: 'tank' | 'healer' | 'dps') =>
      ({ id, name: { ja: id, en: id }, role, icon: '' } as import('../../../types').Job);
    const JOBS = [
      J('pld', 'tank'), J('war', 'tank'), J('whm', 'healer'), J('sch', 'healer'),
      J('ast', 'healer'),
      J('mnk', 'dps'), J('drg', 'dps'), J('brd', 'dps'), J('blm', 'dps'),
    ];

    it('フル8人を空 assignment から全枠 resolveImportParty 既定で埋める', () => {
      const a = seedAssignment(
        emptyAssignment(),
        ['pld', 'war', 'whm', 'sch', 'mnk', 'drg', 'brd', 'blm'],
        JOBS,
      );
      expect(a).toEqual({
        MT: 'pld', ST: 'war', H1: 'whm', H2: 'sch',
        D1: 'mnk', D2: 'drg', D3: 'brd', D4: 'blm',
      });
    });

    it('手動で割り当てた枠は保持し、空き枠だけ埋める', () => {
      // 手動で war を MT に置いた(既定なら pld=MT)。pld は空きタンク枠 ST へ回る。
      const prev = assignSlot(emptyAssignment(), 'MT', 'war');
      const a = seedAssignment(prev, ['pld', 'war'], JOBS);
      expect(a.MT).toBe('war'); // 手動を保持
      expect(a.ST).toBe('pld'); // 既定枠(MT)が埋まっていたので空きの ST へ
    });

    it('検出から消えたジョブの枠は外す', () => {
      // war を ST に置いていたが、war が検出から消えた → ST は空く。
      const prev = assignSlot(assignSlot(emptyAssignment(), 'MT', 'pld'), 'ST', 'war');
      const a = seedAssignment(prev, ['pld'], JOBS);
      expect(a.MT).toBe('pld');
      expect(a.ST).toBeNull();
    });

    it('元の assignment を破壊しない(pure)', () => {
      const prev = emptyAssignment();
      seedAssignment(prev, ['pld'], JOBS);
      expect(prev.MT).toBeNull();
    });

    it('DPS 複数ジョブ: 既定枠が手動で埋まっていても同ロールの空き枠へ詰める', () => {
      // D1 に手動で blm を置く(既定なら近接 mnk が D1)。残り mnk/drg/brd は空き D2..D4 へ。
      const prev = assignSlot(emptyAssignment(), 'D1', 'blm');
      const a = seedAssignment(prev, ['mnk', 'drg', 'brd', 'blm'], JOBS);
      expect(a.D1).toBe('blm');                 // 手動保持
      // mnk/drg/brd は D2..D4 のいずれかに座る(捨てられない)
      const dpsSeated = [a.D2, a.D3, a.D4].filter((v) => v !== null).sort();
      expect(dpsSeated).toEqual(['brd', 'drg', 'mnk'].sort());
    });

    it('空き枠が無ければ捨てる(タンク3人目)', () => {
      const a = seedAssignment(emptyAssignment(), ['pld', 'war', 'drk'], [...JOBS, J('drk', 'tank')]);
      // pld=MT, war=ST、drk は座れない(枠なし)
      const seated = Object.values(a).filter((v) => v !== null);
      expect(seated).toContain('pld');
      expect(seated).toContain('war');
      expect(seated).not.toContain('drk');
    });
  });
});
