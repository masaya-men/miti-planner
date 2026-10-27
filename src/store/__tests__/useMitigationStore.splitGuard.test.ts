import { describe, it, expect, beforeAll, vi } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import { registerTutorialBridge } from '../tutorialBridge';
import type { AppliedMitigation, TimelineEvent } from '../../types';
import type { CollabHandlers } from '../../lib/collab/collabTypes';

/**
 * 一時検査(整頓④ useMitigationStore 分割の前後比較)。分割前に snapshot を記録し、
 * 分割後に完全一致することを確かめたら削除する。
 */

const records: unknown[] = [];
const bridgeEvents: string[] = [];
let tutorialActive = false;
const calls: unknown[] = [];

const clean = (v: unknown) => JSON.parse(JSON.stringify(v, (k, x) => (k === '_collabHandlers' ? (x ? 'handlers' : null) : x)));

const recordingHandlers = (): CollabHandlers => {
  const h = {} as Record<string, unknown>;
  for (const name of ['add', 'remove', 'updateTime', 'upsertItems', 'removeItems', 'insertItemAt', 'setMeta', 'importBulk', 'batch', 'undo', 'redo']) {
    h[name] = (...args: unknown[]) => { calls.push(clean([name, args])); };
  }
  return h as unknown as CollabHandlers;
};

const S = () => useMitigationStore.getState();

const ev = (id: string, time: number): TimelineEvent => ({
  id, time, name: { ja: id, en: id }, damageType: 'magical', damageAmount: 100000, target: 'AoE',
} as unknown as TimelineEvent);
const mit = (id: string, mitigationId: string, time: number, ownerId: string, extra: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id, mitigationId, time, duration: 20, ownerId, ...extra,
});

function step(label: string, fn: () => unknown) {
  calls.length = 0;
  bridgeEvents.length = 0;
  let ret: unknown;
  let error: string | null = null;
  try { ret = fn(); } catch (e) { error = String(e); }
  const { _history, _future, ...rest } = S() as unknown as Record<string, unknown>;
  records.push(clean({
    label, ret: typeof ret === 'function' ? 'fn' : ret ?? null, error,
    state: rest, historyLen: (_history as unknown[]).length, futureLen: (_future as unknown[]).length,
    calls: [...calls], bridgeEvents: [...bridgeEvents],
    stored: localStorage.getItem('mitigation-storage'),
  }));
}

function scenario() {
  step('init', () => S().initializeParty());
  step('setLoadedPlanId', () => S().setLoadedPlanId('plan_1'));
  step('setCurrentLevel', () => S().setCurrentLevel(90));
  step('setCurrentLevel back', () => S().setCurrentLevel(100));
  step('applyDefaultStats', () => S().applyDefaultStats(100));
  step('updateMemberStats', () => S().updateMemberStats('MT', { hp: 300000 } as never));
  step('setMemberJob MT', () => S().setMemberJob('MT', 'pld'));
  step('setMemberJob H1', () => S().setMemberJob('H1', 'sch'));
  step('setMemberJob H2', () => S().setMemberJob('H2', 'ast'));
  step('changeMemberJobWithMitigations', () => S().changeMemberJobWithMitigations('ST', 'war', [mit('w1', 'rampart', 40, 'ST')]));
  step('updatePartyBulk', () => S().updatePartyBulk([{ memberId: 'D1', jobId: 'drg' }, { memberId: 'D2', jobId: 'brd', mitigations: [] }]));
  step('setAaSettings', () => S().setAaSettings({ damage: 5000, type: 'physical', target: 'ST' }));
  step('setSchAetherflowPattern', () => S().setSchAetherflowPattern('H1', 2));
  step('setSchAetherflowPattern 1', () => S().setSchAetherflowPattern('H1', 1));
  step('addEvent', () => S().addEvent(ev('e1', 10)));
  step('addEvent 2', () => S().addEvent(ev('e2', 60)));
  step('updateEvent', () => S().updateEvent('e2', { time: 70 }));
  step('importTimelineEvents', () => S().importTimelineEvents([ev('i1', 5), ev('i2', 120)], [{ id: 1, startTimeSec: 0, name: { ja: 'P1', en: 'P1' } }, { id: 2, startTimeSec: 100, name: { ja: 'P2', en: 'P2' } }], [{ id: 'l1', name: { ja: 'L', en: 'L' }, startTime: 20, endTime: 50 } as never], 'replace' as never));
  step('addPhase', () => S().addPhase(150, { ja: 'P3', en: 'P3' }));
  const ph = () => S().phases;
  step('updatePhase', () => S().updatePhase(ph()[0].id, { ja: 'P1x', en: 'P1x' }));
  step('updatePhaseEndTime', () => S().updatePhaseEndTime(ph()[0].id, 90));
  step('updatePhaseStartTime', () => S().updatePhaseStartTime(ph()[1].id, 95));
  step('removePhase', () => S().removePhase(ph()[ph().length - 1].id));
  step('addLabel', () => S().addLabel(80, { ja: 'L2', en: 'L2' }));
  const lb = () => S().labels;
  step('updateLabel', () => S().updateLabel(lb()[0].id, { ja: 'Lx', en: 'Lx' }));
  step('updateLabelEndTime', () => S().updateLabelEndTime(lb()[0].id, 60));
  step('updateLabelStartTime', () => S().updateLabelStartTime(lb()[lb().length - 1].id, 85));
  step('removeLabel', () => S().removeLabel(lb()[lb().length - 1].id));
  step('addMitigation rampart', () => S().addMitigation(mit('m1', 'rampart_pld', 30, 'MT')));
  step('addMitigation adlo', () => S().addMitigation(mit('m2', 'adloquium', 50, 'H1', { targetId: 'MT' })));
  step('addMitigation deploy', () => S().addMitigation(mit('m3', 'deployment_tactics', 55, 'H1')));
  step('addMitigation aetherflow', () => S().addMitigation(mit('m4', 'aetherflow', 0, 'H1')));
  step('confirmAetherflowChain', () => S().confirmAetherflowChain());
  step('addMitigation aetherflow 2', () => S().addMitigation(mit('m5', 'aetherflow', 200, 'H1')));
  step('dismissAetherflowChainPrompt', () => S().dismissAetherflowChainPrompt());
  step('addMitigation astral', () => S().addMitigation(mit('m6', 'astral_draw', 0, 'H2')));
  step('confirmAstrologianDrawChain', () => S().confirmAstrologianDrawChain());
  step('addMitigation umbral', () => S().addMitigation(mit('m7', 'umbral_draw', 300, 'H2')));
  step('dismissAstrologianDrawChainPrompt', () => S().dismissAstrologianDrawChainPrompt());
  step('updateMitigationTime', () => S().updateMitigationTime('m2', 52));
  step('removeMitigation', () => S().removeMitigation('m2'));
  step('undo', () => S().undo());
  step('undo 2', () => S().undo());
  step('redo', () => S().redo());
  step('removeEvent', () => S().removeEvent('e1'));
  step('clearMitigationsByMember', () => S().clearMitigationsByMember('H2'));
  step('applyAutoPlan', () => S().applyAutoPlan({ mitigations: [mit('a1', 'rampart_pld', 12, 'MT')], warnings: ['w'] }));
  step('setMyMemberId', () => S().setMyMemberId('H1'));
  step('setMyJobHighlight', () => S().setMyJobHighlight(true));
  step('setHideEmptyRows', () => S().setHideEmptyRows(false));
  step('setShowRowBorders', () => S().setShowRowBorders(true));
  step('setSheetRowBorders', () => S().setSheetRowBorders(false));
  step('setClipboardEvent', () => S().setClipboardEvent(ev('c1', 3)));
  step('setTimelineSortOrder', () => S().setTimelineSortOrder('role'));
  step('toggleHiddenPartyMember', () => S().toggleHiddenPartyMember('D3'));
  step('toggleHiddenPartyMember 2', () => S().toggleHiddenPartyMember('D3'));
  step('setHiddenPartyMemberIds', () => S().setHiddenPartyMemberIds(['D4']));
  step('setToolMode', () => S().setToolMode('memo'));
  step('addMemo', () => S().addMemo({ text: 'hello', timeSec: 30, xRatio: 0.5 }));
  step('addMemo empty', () => S().addMemo({ text: '', timeSec: 30, xRatio: 0.5 }));
  step('updateMemo', () => S().updateMemo(S().memos[0].id, { text: 'bye' }));
  step('addMemo 2', () => S().addMemo({ text: 'x', timeSec: 40, xRatio: 0.1 }));
  step('deleteMemo', () => S().deleteMemo(S().memos[0].id));
  step('deleteAllMemos', () => S().deleteAllMemos());
  step('recordReachedPoint', () => S().recordReachedPoint(120));
  step('recordReachedPoint 2', () => S().recordReachedPoint(200));
  step('setProgressPointNote', () => S().setProgressPointNote(S().progress.points[0].id, 'note'));
  step('insertProgressPointAt', () => S().insertProgressPointAt(1, { id: 'pt_x', ts: 1, reachedPos: 150 } as never));
  step('removeProgressPoint', () => S().removeProgressPoint(S().progress.points[0].id));
  step('setCleared', () => S().setCleared(true));
  step('setActiveDays', () => S().setActiveDays(3));
  step('setActiveHours', () => S().setActiveHours(5));
  step('clearAllProgressPoints', () => S().clearAllProgressPoints());
  step('getSnapshot', () => S().getSnapshot());
  step('loadSnapshot', () => S().loadSnapshot({ ...S().getSnapshot(), timelineEvents: [ev('s1', 7)] }, 'plan_2'));
  step('clearAllMitigations', () => S().clearAllMitigations());
  step('tutorial reset', () => { tutorialActive = true; S().resetForTutorial(); });
  step('tutorial addEvent', () => S().addEvent(ev('t1', 9)));
  step('tutorial restore', () => {
    S().restoreFromSnapshot({ timelineEvents: [ev('r1', 1)], timelineMitigations: [], phases: [], labels: [], partyMembers: S().partyMembers, myMemberId: 'MT', myJobHighlight: false, hideEmptyRows: true });
    tutorialActive = false;
  });
  step('setCollabReadonly', () => S().setCollabReadonly(true));
  step('readonly write', () => S().setMyJobHighlight(false));
  step('setCollabReadonly off', () => S().setCollabReadonly(false));

  // ── 共同編集 ──
  step('enterCollabMode', () => S().enterCollabMode(recordingHandlers()));
  step('_setCollabUndoRedo', () => S()._setCollabUndoRedo(true, false));
  step('c addMitigation', () => S().addMitigation(mit('cm1', 'rampart_pld', 30, 'MT')));
  step('c addMitigation aetherflow', () => S().addMitigation(mit('cm2', 'aetherflow', 0, 'H1')));
  step('c confirmAetherflowChain', () => S().confirmAetherflowChain());
  step('c addMitigation astral', () => S().addMitigation(mit('cm3', 'astral_draw', 0, 'H2')));
  step('c confirmAstrologianDrawChain', () => S().confirmAstrologianDrawChain());
  step('c removeMitigation', () => S().removeMitigation('cm1'));
  step('c updateMitigationTime', () => S().updateMitigationTime('cm1', 33));
  step('c clearMitigationsByMember', () => S().clearMitigationsByMember('MT'));
  step('c clearAllMitigations', () => S().clearAllMitigations());
  step('c applyAutoPlan', () => S().applyAutoPlan({ mitigations: [mit('a2', 'rampart_pld', 12, 'MT')], warnings: [] }));
  step('c setCurrentLevel', () => S().setCurrentLevel(90));
  step('c applyDefaultStats', () => S().applyDefaultStats(90));
  step('c updateMemberStats', () => S().updateMemberStats('MT', { hp: 1 } as never));
  step('c setMemberJob', () => S().setMemberJob('D3', 'mnk'));
  step('c changeMemberJobWithMitigations', () => S().changeMemberJobWithMitigations('D4', 'blm', []));
  step('c updatePartyBulk', () => S().updatePartyBulk([{ memberId: 'D1', jobId: 'sam' }]));
  step('c setAaSettings', () => S().setAaSettings({ damage: 1, type: 'magical', target: 'MT' }));
  step('c setSchAetherflowPattern', () => S().setSchAetherflowPattern('H1', 2));
  step('c addEvent', () => S().addEvent(ev('ce1', 11)));
  step('c updateEvent', () => S().updateEvent('ce1', { time: 12 }));
  step('c removeEvent', () => S().removeEvent('ce1'));
  step('c importTimelineEvents', () => S().importTimelineEvents([ev('ci1', 5)], undefined, undefined, 'replace' as never));
  step('c addPhase', () => S().addPhase(30, { ja: 'CP', en: 'CP' }));
  step('c updatePhase', () => S().updatePhase('nope', { ja: 'x', en: 'x' }));
  step('c updatePhaseEndTime', () => S().updatePhaseEndTime('nope', 1));
  step('c updatePhaseStartTime', () => S().updatePhaseStartTime('nope', 1));
  step('c removePhase', () => S().removePhase('nope'));
  step('c addLabel', () => S().addLabel(30, { ja: 'CL', en: 'CL' }));
  step('c updateLabel', () => S().updateLabel('nope', { ja: 'x', en: 'x' }));
  step('c updateLabelEndTime', () => S().updateLabelEndTime('nope', 1));
  step('c updateLabelStartTime', () => S().updateLabelStartTime('nope', 1));
  step('c removeLabel', () => S().removeLabel('nope'));
  step('c addMemo', () => S().addMemo({ text: 'c', timeSec: 1, xRatio: 0 }));
  step('c updateMemo', () => S().updateMemo('nope', { text: 'y' }));
  step('c deleteMemo', () => S().deleteMemo('nope'));
  step('c deleteAllMemos', () => S().deleteAllMemos());
  step('c recordReachedPoint', () => S().recordReachedPoint(10));
  step('c removeProgressPoint', () => S().removeProgressPoint('nope'));
  step('c setCleared', () => S().setCleared(false));
  step('c setActiveDays', () => S().setActiveDays(1));
  step('c setActiveHours', () => S().setActiveHours(undefined));
  step('c setProgressPointNote', () => S().setProgressPointNote('nope', 'n'));
  step('c clearAllProgressPoints', () => S().clearAllProgressPoints());
  step('c insertProgressPointAt', () => S().insertProgressPointAt(0, { id: 'pt_c', ts: 2, reachedPos: 5 } as never));
  step('c undo', () => S().undo());
  step('c redo', () => S().redo());
  step('c _applyMitigationsFromCollab', () => S()._applyMitigationsFromCollab([mit('y1', 'adloquium', 10, 'H1', { targetId: 'MT' }), mit('y2', 'deployment_tactics', 15, 'H1')]));
  step('c _applyEventsFromCollab', () => S()._applyEventsFromCollab([ev('y2', 50), ev('y1', 5)]));
  step('c _applyPhasesFromCollab', () => S()._applyPhasesFromCollab([{ id: 'p2', name: { ja: 'b', en: 'b' }, startTime: 50, endTime: 99 }, { id: 'p1', name: { ja: 'a', en: 'a' }, startTime: 0, endTime: 50 }] as never));
  step('c _applyLabelsFromCollab', () => S()._applyLabelsFromCollab([{ id: 'lb', name: { ja: 'b', en: 'b' }, startTime: 9, endTime: 20 }] as never));
  step('c _applyMemosFromCollab', () => S()._applyMemosFromCollab([{ id: 'mm', text: 't', timeSec: 1, xRatio: 0, createdAt: 1, updatedAt: 1 }] as never));
  step('c _applyProgressPointsFromCollab', () => S()._applyProgressPointsFromCollab([{ id: 'pp2', ts: 5, reachedPos: 3 }, { id: 'pp1', ts: 1, reachedPos: 9 }] as never));
  step('c _applyPartyMembersFromCollab', () => S()._applyPartyMembersFromCollab(S().partyMembers.slice().reverse()));
  step('c _applyMetaFromCollab', () => S()._applyMetaFromCollab({ currentLevel: 100, aaSettings: { damage: 2, type: 'physical', target: 'MT' }, schAetherflowPatterns: { H1: 1 }, progressCleared: true, progressActiveDays: 2, progressActiveHours: 4 }));
  step('exitCollabMode', () => S().exitCollabMode());
}

describe('一時検査: useMitigationStore 分割の前後比較', () => {
  beforeAll(() => {
    let n = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`);
    let r = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => ((r = (r * 9301 + 49297) % 233280) / 233280));
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    registerTutorialBridge({ completeEvent: (e) => { bridgeEvents.push(e); }, isActive: () => tutorialActive });
    localStorage.clear();
  });

  it('操作一覧(関数 key)が同じ', () => {
    const fnKeys = Object.entries(S()).filter(([, v]) => typeof v === 'function').map(([k]) => k).sort();
    expect(fnKeys).toMatchSnapshot();
  });

  it('全操作の結果(state・委譲先の呼び出し・チュートリアル通知・保存内容)が同じ', () => {
    scenario();
    expect(records).toMatchSnapshot();
  });
});
