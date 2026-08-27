import { describe, it, expect } from 'vitest';
import {
  stepShieldAbsorption,
  shieldCoverageContext,
  resolveContextShields,
  type ContextShieldState,
} from '../../utils/barrierStacking';
import { buildContextShieldEntries } from '../../utils/contextShieldEntries';
import { MITIGATIONS } from '../../data/mockData';
import type { AppliedMitigation, PartyMember } from '../../types';

describe('stepShieldAbsorption (バリア1インスタンスの被弾遷移)', () => {
  describe('スタック非対応バリア(ディヴァインヴェール等)', () => {
    const base = { stacksRemaining: undefined, maxVal: 1000, reapplyOnAbsorption: undefined };

    it('吸収量に届かない被弾: 残バリアが減るだけ、尽きていない', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 1000, incomingDamage: 300 });
      expect(r.absorbed).toBe(300);
      expect(r.finalShield).toBe(700);
      expect(r.exhausted).toBe(false);
    });

    it('残量ちょうどの被弾: 尽きる', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 700, incomingDamage: 700 });
      expect(r.absorbed).toBe(700);
      expect(r.finalShield).toBe(0);
      expect(r.exhausted).toBe(true);
    });

    it('残量を超える被弾: 残量分だけ吸収して尽きる', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 500, incomingDamage: 9999 });
      expect(r.absorbed).toBe(500);
      expect(r.finalShield).toBe(0);
      expect(r.exhausted).toBe(true);
    });
  });

  describe('スタック制バリア(ハイマ/パンハイマ, reapplyOnAbsorption)', () => {
    const base = { maxVal: 1000, reapplyOnAbsorption: true };

    it('スタックが残っている状態で壊れても: 貼り直されて尽きていない(棒を切らない)', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 400, incomingDamage: 9999, stacksRemaining: 3 });
      expect(r.absorbed).toBe(400);
      expect(r.finalStacks).toBe(2);       // 1スタック消費
      expect(r.finalShield).toBe(1000);    // maxVal に貼り直し
      expect(r.exhausted).toBe(false);     // ← まだ効いている
    });

    it('最後の1スタックを消費した直後: まだ新品バリアがあるので尽きていない', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 100, incomingDamage: 9999, stacksRemaining: 1 });
      expect(r.finalStacks).toBe(0);
      expect(r.finalShield).toBe(1000);
      expect(r.exhausted).toBe(false);
    });

    it('スタック0で貼り直された新品バリアを壊しきったとき: ついに尽きる', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 1000, incomingDamage: 9999, stacksRemaining: 0 });
      expect(r.finalStacks).toBe(0);
      expect(r.finalShield).toBe(0);
      expect(r.exhausted).toBe(true);      // ← ここで初めて棒を切ってよい
    });

    it('1スタック消費は1被弾につき1回だけ(大ダメージでも複数スタックを飛ばさない)', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 1000, incomingDamage: 999999, stacksRemaining: 5 });
      expect(r.finalStacks).toBe(4);
      expect(r.finalShield).toBe(1000);
      expect(r.exhausted).toBe(false);
    });
  });
});

describe('shieldCoverageContext (バリアの実効カバー範囲)', () => {
  it('対象指定バリア(鼓舞激励の策等 targetId あり)→ その対象 context', () => {
    expect(shieldCoverageContext('MT', 'target', 'H1')).toBe('MT');
    expect(shieldCoverageContext('ST', 'target', 'H2')).toBe('ST');
  });

  it('自分バリア(scope:self)→ 使用者本人の context', () => {
    expect(shieldCoverageContext(undefined, 'self', 'MT')).toBe('MT');
  });

  it('全体バリア(意気軒高の策 = scope 未指定・targetId なし)→ Party', () => {
    expect(shieldCoverageContext(undefined, undefined, 'H1')).toBe('Party');
  });

  it('scope:party の全体バリア(タンクのヴェール等)→ Party', () => {
    expect(shieldCoverageContext(undefined, 'party', 'MT')).toBe('Party');
  });

  it('targetId は scope より優先(対象指定されていればその context)', () => {
    expect(shieldCoverageContext('ST', 'party', 'MT')).toBe('ST');
  });

  // 回帰: 全体バリアはタンク単体攻撃(displayContext=MT)で MT バケツが枯れても
  // coverageCtx='Party' ≠ 'MT' なのでエフェクト棒の早期終了は記録されない。
  // 全体攻撃(displayContext=Party)で Party バケツが尽きたときだけ棒が止まる。
  it('回帰: 全体バリアの coverageCtx は Party なので単体攻撃の MT context とは一致しない', () => {
    const coverage = shieldCoverageContext(undefined, undefined, 'H1');
    expect(coverage).toBe('Party');
    expect(coverage).not.toBe('MT');
    expect(coverage).not.toBe('ST');
  });
});

// ---------------------------------------------------------------------------
// buildContextShieldEntries: damageMapResult のフェーズ1(entry 組み立て)
// ---------------------------------------------------------------------------

const mkMember = (id: string, computedValues: Record<string, number>): PartyMember => ({
  id,
  jobId: 'sch',
  role: 'healer',
  stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
  computedValues,
});

const mkMit = (
  o: Partial<AppliedMitigation> & { id: string; mitigationId: string },
): AppliedMitigation => ({ time: 0, duration: 30, ownerId: 'H1', ...o });

/** H1(学者) の鼓舞 40,000 / 意気軒高 20,000 という素直な構成。 */
const scholarMembers = () => [
  mkMember('H1', { 鼓舞激励の策: 40000, 意気軒高の策: 20000 }),
  mkMember('MT', {}),
  mkMember('ST', {}),
];

const build = (args: {
  mitigations: AppliedMitigation[];
  displayContext: string;
  affectedContexts: string[];
  partyMembers?: PartyMember[];
}) =>
  buildContextShieldEntries({
    activeMitigations: args.mitigations,
    timelineMitigations: args.mitigations,
    partyMembers: args.partyMembers ?? scholarMembers(),
    mitigationDefs: MITIGATIONS,
    event: { damageType: 'magical' },
    displayContext: args.displayContext,
    affectedContexts: args.affectedContexts,
  });

const idsIn = (r: ReturnType<typeof build>, ctx: string) =>
  (r.entriesByCtx.get(ctx) ?? []).map(e => e.appMitId).sort();

describe('buildContextShieldEntries (context ごとのバリア entry 組み立て)', () => {
  it('タンク単体攻撃(displayContext=MT): 鼓舞激励の策(MT対象) と 意気軒高の策(全体) の 2 entry が MT ctx に載る', () => {
    const adlo = mkMit({ id: 'a1', mitigationId: 'adloquium', ownerId: 'H1', targetId: 'MT' });
    const conc = mkMit({ id: 'c1', mitigationId: 'concitation', ownerId: 'H1' });

    const r = build({ mitigations: [adlo, conc], displayContext: 'MT', affectedContexts: ['MT'] });

    expect(idsIn(r, 'MT')).toEqual(['a1', 'c1']);
    const byId = new Map(r.entriesByCtx.get('MT')!.map(e => [e.appMitId, e]));
    expect(byId.get('a1')!.maxVal).toBe(40000);
    expect(byId.get('c1')!.maxVal).toBe(20000);
    // 鼓舞系はどちらも galvanize / 消費優先度 25(最後に割れる)
    expect(byId.get('a1')!.group).toBe('galvanize');
    expect(byId.get('c1')!.group).toBe('galvanize');
    expect(byId.get('a1')!.priority).toBe(25);
  });

  it('coverageCtx: 対象指定バリアは対象 context、全体バリアは Party', () => {
    const adlo = mkMit({ id: 'a1', mitigationId: 'adloquium', ownerId: 'H1', targetId: 'MT' });
    const conc = mkMit({ id: 'c1', mitigationId: 'concitation', ownerId: 'H1' });

    const r = build({ mitigations: [adlo, conc], displayContext: 'MT', affectedContexts: ['MT'] });

    expect(r.coverageCtxByAppMit.get('a1')).toBe('MT');
    expect(r.coverageCtxByAppMit.get('c1')).toBe('Party');
  });

  it('全体攻撃(displayContext=Party): Party ctx の entry は意気軒高の策だけ(MT 対象の鼓舞は displayContext フィルタで落ちる)', () => {
    const adlo = mkMit({ id: 'a1', mitigationId: 'adloquium', ownerId: 'H1', targetId: 'MT' });
    const conc = mkMit({ id: 'c1', mitigationId: 'concitation', ownerId: 'H1' });

    const r = build({
      mitigations: [adlo, conc],
      displayContext: 'Party',
      affectedContexts: ['Party', 'MT', 'ST'],
    });

    expect(idsIn(r, 'Party')).toEqual(['c1']);
    expect(idsIn(r, 'MT')).toEqual(['c1']);
    expect(idsIn(r, 'ST')).toEqual(['c1']);
    expect(r.coverageCtxByAppMit.has('a1')).toBe(false);
  });

  it('copiesShield(展開戦術): コピー分の entry はコピー元の鼓舞対象 ctx には出ない', () => {
    const adlo = mkMit({ id: 'a1', mitigationId: 'adloquium', ownerId: 'H1', targetId: 'MT' });
    const dep = mkMit({
      id: 'd1',
      mitigationId: 'deployment_tactics',
      ownerId: 'H1',
      linkedMitigationId: 'a1',
    });

    const r = build({
      mitigations: [adlo, dep],
      displayContext: 'Party',
      affectedContexts: ['Party', 'MT', 'ST'],
    });

    expect(idsIn(r, 'Party')).toEqual(['d1']);
    expect(idsIn(r, 'ST')).toEqual(['d1']);
    expect(idsIn(r, 'MT')).toEqual([]); // 鼓舞本体が効いている MT にはコピーが載らない
    expect(r.entriesByCtx.get('Party')![0].maxVal).toBe(40000); // コピー元の鼓舞値
  });

  it('リンク先が無い展開戦術は entry を作らない', () => {
    const dep = mkMit({ id: 'd1', mitigationId: 'deployment_tactics', ownerId: 'H1' });

    const r = build({ mitigations: [dep], displayContext: 'MT', affectedContexts: ['MT'] });

    expect(idsIn(r, 'MT')).toEqual([]);
    expect(r.coverageCtxByAppMit.has('d1')).toBe(false);
  });

  // 旧実装の `if (shieldRemaining > 0)` ゲートの回帰。値 0 のバリアが entry になると
  // 非スタック解決(値を見ない後勝ちルール)で実バリアを負かしてしまうため、entry にしない。
  it('maxVal が 0 のバリア(computedValues にキーが無い)は entry を作らない', () => {
    const adlo = mkMit({ id: 'a1', mitigationId: 'adloquium', ownerId: 'H1', targetId: 'MT' });
    const emptyMembers = [mkMember('H1', {}), mkMember('MT', {})];

    const r = build({
      mitigations: [adlo],
      displayContext: 'MT',
      affectedContexts: ['MT'],
      partyMembers: emptyMembers,
    });

    expect(idsIn(r, 'MT')).toEqual([]);
    expect(r.entriesByCtx.has('MT')).toBe(false);
    expect(r.coverageCtxByAppMit.has('a1')).toBe(false);
  });

  it('コピー元の鼓舞値が 0 の展開戦術も entry を作らない', () => {
    const adlo = mkMit({ id: 'a1', mitigationId: 'adloquium', ownerId: 'H1', targetId: 'MT' });
    const dep = mkMit({
      id: 'd1',
      mitigationId: 'deployment_tactics',
      ownerId: 'H1',
      linkedMitigationId: 'a1',
    });
    const emptyMembers = [mkMember('H1', {}), mkMember('MT', {}), mkMember('ST', {})];

    const r = build({
      mitigations: [adlo, dep],
      displayContext: 'Party',
      affectedContexts: ['Party', 'MT', 'ST'],
      partyMembers: emptyMembers,
    });

    expect(idsIn(r, 'Party')).toEqual([]);
    expect(idsIn(r, 'ST')).toEqual([]);
    expect(r.coverageCtxByAppMit.has('d1')).toBe(false);
  });
});

describe('統合: buildContextShieldEntries + resolveContextShields', () => {
  const newState = (): ContextShieldState => ({
    remaining: new Map(),
    stacks: new Map(),
    overwritten: new Set(),
  });

  it('鼓舞激励の策(40,000) + 意気軒高の策(20,000) は重ならない: 吸収合計は大きい方だけ(60,000 でなく 40,000)', () => {
    const adlo = mkMit({ id: 'a1', mitigationId: 'adloquium', ownerId: 'H1', targetId: 'MT' });
    const conc = mkMit({ id: 'c1', mitigationId: 'concitation', ownerId: 'H1' });

    const r = build({ mitigations: [adlo, conc], displayContext: 'MT', affectedContexts: ['MT'] });
    const res = resolveContextShields(r.entriesByCtx.get('MT')!, 100000, newState());

    expect(res.totalAbsorbed).toBe(40000);
    expect(res.newlyOverwritten).toEqual(['c1']); // 小さい意気軒高が上書き負け
  });

  it('二重削り修正: 100,000 被弾を 2 枚で分担しても 1 枚目が吸った残りだけが 2 枚目に渡る', () => {
    // 鼓舞(40,000・優先度25) と ディヴァインヴェール(HP割合・優先度20) は別グループなので重なる
    const adlo = mkMit({ id: 'a1', mitigationId: 'adloquium', ownerId: 'H1', targetId: 'MT' });
    const veil = mkMit({ id: 'v1', mitigationId: 'divine_veil', ownerId: 'MT' });
    const members = scholarMembers();
    members.find(m => m.id === 'MT')!.computedValues = { ディヴァインヴェール: 30000 };

    const r = build({
      mitigations: [adlo, veil],
      displayContext: 'MT',
      affectedContexts: ['MT'],
      partyMembers: members,
    });
    const state = newState();
    const res = resolveContextShields(r.entriesByCtx.get('MT')!, 50000, state);

    // ヴェール(優先度20)が先に 30,000 吸い、鼓舞は残り 20,000 だけ吸う → 20,000 残る
    expect(res.totalAbsorbed).toBe(50000);
    expect(state.remaining.get('v1')).toBe(0);
    expect(state.remaining.get('a1')).toBe(20000);
    expect(res.newlyExhausted).toEqual(['v1']); // 尽きたのはヴェールだけ(鼓舞の棒は止めない)
  });

  it('イベントをまたいで state が永続する: 2 発目は 1 発目の残量だけ吸って尽きる', () => {
    const veil = mkMit({ id: 'v1', mitigationId: 'divine_veil', ownerId: 'MT' });
    const members = scholarMembers();
    members.find(m => m.id === 'MT')!.computedValues = { ディヴァインヴェール: 30000 };

    const r = build({
      mitigations: [veil],
      displayContext: 'MT',
      affectedContexts: ['MT'],
      partyMembers: members,
    });
    const entries = r.entriesByCtx.get('MT')!;
    // damageMapResult と同じく、context ごとの state を被弾をまたいで使い回す
    const state = newState();

    const first = resolveContextShields(entries, 20000, state);
    expect(first.totalAbsorbed).toBe(20000);
    expect(state.remaining.get('v1')).toBe(10000);
    expect(first.newlyExhausted).toEqual([]);

    const second = resolveContextShields(entries, 15000, state);
    expect(second.totalAbsorbed).toBe(10000); // 満タンの 30,000 ではなく 1 発目の残り
    expect(state.remaining.get('v1')).toBe(0);
    expect(second.newlyExhausted).toEqual(['v1']);
  });
});
