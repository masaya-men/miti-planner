import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import { applied, mockHandlers } from './collabStoreTestHelpers';

describe('②-b-2 partyMembers 単純変更の委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT' }), member({ id: 'H1', jobId: 'whm', role: 'healer' })],
    currentLevel: 100, _collabActive: false, _collabHandlers: null,
  }));

  it('updateMemberStats は当該メンバーを partyMembers に upsert し store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updateMemberStats('MT', { hp: 999999 });
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('partyMembers');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('MT');
    expect(items[0].stats.hp).toBe(999999);
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')!.stats.hp).toBe(100000);
  });

  it('applyDefaultStats は全メンバーを partyMembers に upsert し store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().applyDefaultStats(90);
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('partyMembers');
    expect(items.map((m: any) => m.id).sort()).toEqual(['H1', 'MT']);
    expect(useMitigationStore.getState().partyMembers.every((m) => m.computedValues && Object.keys(m.computedValues).length === 0)).toBe(true);
  });
});

describe('②-b-2 setMemberJob 委譲（カスケード batch）', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' })],
    timelineMitigations: [], timelineEvents: [], currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));

  it('setMemberJob は batch に委譲し、partyMembers upsert に新 jobId を含め、store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().setMemberJob('MT', 'war');
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    const pmUpsert = ops.find((o) => o.kind === 'upsert' && o.key === 'partyMembers');
    expect(pmUpsert).toBeTruthy();
    expect(pmUpsert.items.find((m: any) => m.id === 'MT').jobId).toBe('war');
    expect(ops.some((o) => o.key === 'timelineMitigations' && o.kind === 'remove')).toBe(true);
    expect(ops.some((o) => o.key === 'timelineMitigations' && o.kind === 'upsert')).toBe(true);
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')!.jobId).toBe('pld');
  });
});

describe('②-b-2 changeMemberJobWithMitigations 委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' })],
    timelineMitigations: [], timelineEvents: [], currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));

  it('batch に委譲し partyMembers upsert に新 jobId・mitigations upsert に渡した配列を含む', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const mitis = [applied({ id: 'cm1', mitigationId: 'rampart_war', ownerId: 'MT' })];
    useMitigationStore.getState().changeMemberJobWithMitigations('MT', 'war', mitis);
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    expect(ops.find((o) => o.kind === 'upsert' && o.key === 'partyMembers').items[0].jobId).toBe('war');
    const mitUpsert = ops.find((o) => o.kind === 'upsert' && o.key === 'timelineMitigations');
    expect(mitUpsert.items.some((m: any) => m.id === 'cm1')).toBe(true);
    expect(useMitigationStore.getState().partyMembers[0].jobId).toBe('pld');
  });
});

describe('②-b-2 updatePartyBulk 委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' }), member({ id: 'ST', jobId: 'war' })],
    timelineMitigations: [], timelineEvents: [], currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));

  it('batch に委譲し、更新メンバーを partyMembers upsert・mitigations を replace する', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updatePartyBulk([{ memberId: 'MT', jobId: 'drk' }]);
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    const pm = ops.find((o) => o.kind === 'upsert' && o.key === 'partyMembers');
    expect(pm.items.map((m: any) => m.id)).toEqual(['MT']);
    expect(pm.items[0].jobId).toBe('drk');
    expect(ops.some((o) => o.kind === 'replace' && o.key === 'timelineMitigations')).toBe(true);
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')!.jobId).toBe('pld');
  });
});

describe('②-b-2 bulk mitigation 操作の委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' }), member({ id: 'H1', jobId: 'whm', role: 'healer' })],
    timelineMitigations: [applied({ id: 'a1', ownerId: 'MT' }), applied({ id: 'a2', ownerId: 'H1' })],
    timelineEvents: [{ id: 'e1', time: 30, name: { ja: 'x' }, damageType: 'magical' }] as any,
    currentLevel: 100, _collabActive: false, _collabHandlers: null,
  }));

  it('clearMitigationsByMember は当該メンバーの mit id を removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().clearMitigationsByMember('MT');
    expect(h.removeItems).toHaveBeenCalledWith('timelineMitigations', ['a1']);
    expect(useMitigationStore.getState().timelineMitigations).toHaveLength(2);
  });

  it('clearAllMitigations は timelineMitigations を replace [] する', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().clearAllMitigations();
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    expect(ops).toEqual([{ kind: 'replace', key: 'timelineMitigations', items: [] }]);
    expect(useMitigationStore.getState().timelineMitigations).toHaveLength(2);
  });

  it('applyAutoPlan は mitigations replace + events の warning を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const newMits = [applied({ id: 'auto1', ownerId: 'MT' })];
    useMitigationStore.getState().applyAutoPlan({ mitigations: newMits, warnings: ['e1'] });
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    const rep = ops.find((o) => o.kind === 'replace' && o.key === 'timelineMitigations');
    expect(rep.items.some((m: any) => m.id === 'auto1')).toBe(true);
    const evUp = ops.find((o) => o.kind === 'upsert' && o.key === 'timelineEvents');
    expect(evUp.items.find((e: any) => e.id === 'e1').warning).toBe(true);
    expect(useMitigationStore.getState().timelineMitigations.map((m) => m.id)).toEqual(['a1', 'a2']);
  });
});

describe('②-b-2 restoreFromSnapshot ガード', () => {
  it('collab 中は restoreFromSnapshot が状態を変えない（no-op）', () => {
    useMitigationStore.setState({
      partyMembers: [{ id: 'MT', jobId: 'pld', role: 'tank', stats: { hp: 1, mainStat: 1, det: 1, crt: 1, ten: 1, ss: 1, wd: 1 }, computedValues: {} }] as any,
      timelineEvents: [{ id: 'keep', time: 1, name: { ja: 'k' }, damageType: 'magical' }] as any,
      _collabActive: false, _collabHandlers: null,
    });
    useMitigationStore.getState().enterCollabMode(mockHandlers());
    const before = useMitigationStore.getState().timelineEvents;
    useMitigationStore.getState().restoreFromSnapshot({
      currentLevel: 100, timelineEvents: [], timelineMitigations: [], phases: [], labels: [],
      partyMembers: [], myMemberId: null, myJobHighlight: false, hideEmptyRows: true,
    } as any);
    expect(useMitigationStore.getState().timelineEvents).toBe(before);
  });
});

describe('⑤-3b collab readonly persist ガード', () => {
  beforeEach(() => useMitigationStore.setState({ _collabReadonly: false }));
  it('setCollabReadonly が _collabReadonly を切り替える', () => {
    useMitigationStore.getState().setCollabReadonly(true);
    expect(useMitigationStore.getState()._collabReadonly).toBe(true);
    useMitigationStore.getState().setCollabReadonly(false);
    expect(useMitigationStore.getState()._collabReadonly).toBe(false);
  });
});

// トップレベル afterEach: enterCollabMode のリークを vmThreads 下でも防ぐ
afterEach(() => useMitigationStore.getState().exitCollabMode());

describe('②-b collab 中の連鎖確定は upsertItems に委譲する(データ消失根治)', () => {
  beforeEach(() => useMitigationStore.setState({
    timelineMitigations: [], timelineEvents: [],
    aetherflowChainPrompt: null, astrologianDrawChainPrompt: null,
    _collabActive: false, _collabHandlers: null, _collabReadonly: false,
  }));
  it('confirmAetherflowChain は collab 中 upsertItems(timelineMitigations) に委譲し store を直変更しない', () => {
    const h = mockHandlers();
    useMitigationStore.setState({ aetherflowChainPrompt: { memberId: 'H1', startTime: 14 } });
    useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().confirmAetherflowChain();
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    expect((h.upsertItems as any).mock.calls[0][0]).toBe('timelineMitigations');
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]); // store 直変更なし(反映は observeDeep 経由)
    expect(useMitigationStore.getState().aetherflowChainPrompt).toBeNull(); // プロンプトは解除
  });
  it('confirmAstrologianDrawChain は collab 中 upsertItems(timelineMitigations) に委譲し store を直変更しない', () => {
    const h = mockHandlers();
    useMitigationStore.setState({ astrologianDrawChainPrompt: { memberId: 'H1', startTime: 14, startKind: 'astral_draw' } });
    useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().confirmAstrologianDrawChain();
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    expect((h.upsertItems as any).mock.calls[0][0]).toBe('timelineMitigations');
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
    expect(useMitigationStore.getState().astrologianDrawChainPrompt).toBeNull();
  });
});
