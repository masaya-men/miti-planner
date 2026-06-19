import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { AppliedMitigation, TimelineEvent, Phase, Label, PartyMember } from '../../types';

const seed = (points: { id?: string; ts: number; reachedPos: number; note?: string }[], extra = {}) =>
  useMitigationStore.setState({
    progress: { points: points.map((p, i) => ({ id: p.id ?? `pt_seed_${i}`, ...p })), cleared: false, ...extra },
    _collabReadonly: false, _collabActive: false,
  } as any);

describe('useMitigationStore progress detail actions', () => {
  beforeEach(() => {
    useMitigationStore.getState().resetForTutorial();
    seed([]);
  });

  it('setProgressPointNote: 指定点に note を付ける', () => {
    seed([{ id: 'pt_a', ts: 1, reachedPos: 10 }, { id: 'pt_b', ts: 2, reachedPos: 20 }]);
    useMitigationStore.getState().setProgressPointNote('pt_b', '  初到達  ');
    const pts = useMitigationStore.getState().progress.points;
    expect(pts[1].note).toBe('初到達'); // trim される
    expect(pts[0].note).toBeUndefined();
  });

  it('setProgressPointNote: 空文字は note を削除（undefined化）', () => {
    seed([{ id: 'pt_a', ts: 1, reachedPos: 10, note: 'x' }]);
    useMitigationStore.getState().setProgressPointNote('pt_a', '   ');
    expect(useMitigationStore.getState().progress.points[0].note).toBeUndefined();
  });

  it('setProgressPointNote: 存在しない id は無変化', () => {
    seed([{ id: 'pt_a', ts: 1, reachedPos: 10 }]);
    useMitigationStore.getState().setProgressPointNote('pt_nonexistent', 'x');
    expect(useMitigationStore.getState().progress.points[0].note).toBeUndefined();
  });

  it('clearAllProgressPoints: points だけ空に（cleared/活動は不変）', () => {
    seed([{ ts: 1, reachedPos: 10 }], { cleared: true, activeDays: 3, activeHours: 5 });
    useMitigationStore.getState().clearAllProgressPoints();
    const p = useMitigationStore.getState().progress;
    expect(p.points).toEqual([]);
    expect(p.cleared).toBe(true);
    expect(p.activeDays).toBe(3);
    expect(p.activeHours).toBe(5);
  });

  it('insertProgressPointAt: 元の位置に復元できる', () => {
    seed([{ ts: 1, reachedPos: 10 }, { ts: 3, reachedPos: 30 }]);
    useMitigationStore.getState().insertProgressPointAt(1, { id: 'pt_undo', ts: 2, reachedPos: 20 });
    expect(useMitigationStore.getState().progress.points.map(p => p.ts)).toEqual([1, 2, 3]);
  });

  it('collab 閲覧者(readonly)は書き換えをブロック', () => {
    seed([{ ts: 1, reachedPos: 10 }]);
    useMitigationStore.setState({ _collabReadonly: true, _collabActive: false } as any);
    useMitigationStore.getState().clearAllProgressPoints();
    expect(useMitigationStore.getState().progress.points).toHaveLength(1);
  });

  // --- Task 2: id ベース ---

  it('recordReachedPoint は id 付きの点を追加する', () => {
    const store = useMitigationStore.getState();
    store.clearAllProgressPoints();
    store.recordReachedPoint(30);
    const pts = useMitigationStore.getState().progress.points;
    expect(pts).toHaveLength(1);
    expect(pts[0].id).toMatch(/^pt_/);
    expect(pts[0].reachedPos).toBe(30);
  });

  it('removeProgressPoint(id) は id 一致だけ消す', () => {
    const store = useMitigationStore.getState();
    store.clearAllProgressPoints();
    store.recordReachedPoint(10);
    store.recordReachedPoint(20);
    const first = useMitigationStore.getState().progress.points[0];
    store.removeProgressPoint(first.id);
    const pts = useMitigationStore.getState().progress.points;
    expect(pts).toHaveLength(1);
    expect(pts[0].reachedPos).toBe(20);
  });

  it('setProgressPointNote(id, note) は id 一致の note を設定する', () => {
    const store = useMitigationStore.getState();
    store.clearAllProgressPoints();
    store.recordReachedPoint(10);
    const id = useMitigationStore.getState().progress.points[0].id;
    store.setProgressPointNote(id, 'memo');
    expect(useMitigationStore.getState().progress.points[0].note).toBe('memo');
  });
});

// ─────────────────────────────────────────────
// データ安全回帰: 進捗操作は表データを一切変更しない
// ─────────────────────────────────────────────
// 「進捗をいじっても表(軽減配置)が消えない」という絶対要件を
// 参照レベルで永久に固定するためのテスト群。
// 各 assert は toBe(同一参照) でストアが表フィールドのオブジェクトを
// 作り直していないことを確認する。
// ─────────────────────────────────────────────

const tableAm = (): AppliedMitigation => ({
  id: 'reg_m1', mitigationId: 'rampart', time: 10, duration: 20, ownerId: 'MT',
});
const tableEv = (): TimelineEvent => ({
  id: 'reg_e1', time: 30, name: { ja: '全体攻撃', en: 'AoE' }, damageType: 'magical',
});
const tablePh = (): Phase => ({
  id: 'reg_p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 120,
});
const tableLb = (): Label => ({
  id: 'reg_l1', name: { ja: 'バーン', en: 'Burn' }, startTime: 0, endTime: 60,
});
const tablePm = (): PartyMember => ({
  id: 'MT', jobId: 'pld', role: 'tank',
  stats: { hp: 100000, mainStat: 3000, det: 2000, crt: 2000, ten: 2000, ss: 800, wd: 100 },
  computedValues: { Rampart: 20 },
});

/** 表データを仕込み、非 collab モードに設定するヘルパ */
function seedTableData() {
  useMitigationStore.setState({
    timelineMitigations: [tableAm()],
    timelineEvents: [tableEv()],
    phases: [tablePh()],
    labels: [tableLb()],
    partyMembers: [tablePm()],
    progress: { points: [], cleared: false },
    _collabReadonly: false,
    _collabActive: false,
    _collabHandlers: null,
  } as any);
}

describe('データ安全: 進捗操作は表データを変更しない', () => {
  beforeEach(() => {
    useMitigationStore.getState().resetForTutorial();
    seedTableData();
  });

  it('recordReachedPoint は表データ5フィールドを変えない', () => {
    const s = useMitigationStore.getState();
    const beforeMit = s.timelineMitigations;
    const beforeEv  = s.timelineEvents;
    const beforePh  = s.phases;
    const beforeLb  = s.labels;
    const beforePm  = s.partyMembers;
    s.recordReachedPoint(50);
    const after = useMitigationStore.getState();
    expect(after.timelineMitigations).toBe(beforeMit);
    expect(after.timelineEvents).toBe(beforeEv);
    expect(after.phases).toBe(beforePh);
    expect(after.labels).toBe(beforeLb);
    expect(after.partyMembers).toBe(beforePm);
  });

  it('removeProgressPoint は表データ5フィールドを変えない', () => {
    // 先に1点記録して id を取得
    useMitigationStore.getState().recordReachedPoint(30);
    const ptId = useMitigationStore.getState().progress.points[0].id;
    const s = useMitigationStore.getState();
    const beforeMit = s.timelineMitigations;
    const beforeEv  = s.timelineEvents;
    const beforePh  = s.phases;
    const beforeLb  = s.labels;
    const beforePm  = s.partyMembers;
    s.removeProgressPoint(ptId);
    const after = useMitigationStore.getState();
    expect(after.timelineMitigations).toBe(beforeMit);
    expect(after.timelineEvents).toBe(beforeEv);
    expect(after.phases).toBe(beforePh);
    expect(after.labels).toBe(beforeLb);
    expect(after.partyMembers).toBe(beforePm);
  });

  it('clearAllProgressPoints は表データ5フィールドを変えない', () => {
    useMitigationStore.getState().recordReachedPoint(10);
    const s = useMitigationStore.getState();
    const beforeMit = s.timelineMitigations;
    const beforeEv  = s.timelineEvents;
    const beforePh  = s.phases;
    const beforeLb  = s.labels;
    const beforePm  = s.partyMembers;
    s.clearAllProgressPoints();
    const after = useMitigationStore.getState();
    expect(after.timelineMitigations).toBe(beforeMit);
    expect(after.timelineEvents).toBe(beforeEv);
    expect(after.phases).toBe(beforePh);
    expect(after.labels).toBe(beforeLb);
    expect(after.partyMembers).toBe(beforePm);
  });

  it('setCleared(true) は表データ5フィールドを変えない', () => {
    const s = useMitigationStore.getState();
    const beforeMit = s.timelineMitigations;
    const beforeEv  = s.timelineEvents;
    const beforePh  = s.phases;
    const beforeLb  = s.labels;
    const beforePm  = s.partyMembers;
    s.setCleared(true);
    const after = useMitigationStore.getState();
    expect(after.timelineMitigations).toBe(beforeMit);
    expect(after.timelineEvents).toBe(beforeEv);
    expect(after.phases).toBe(beforePh);
    expect(after.labels).toBe(beforeLb);
    expect(after.partyMembers).toBe(beforePm);
  });

  it('setActiveDays(3) は表データ5フィールドを変えない', () => {
    const s = useMitigationStore.getState();
    const beforeMit = s.timelineMitigations;
    const beforeEv  = s.timelineEvents;
    const beforePh  = s.phases;
    const beforeLb  = s.labels;
    const beforePm  = s.partyMembers;
    s.setActiveDays(3);
    const after = useMitigationStore.getState();
    expect(after.timelineMitigations).toBe(beforeMit);
    expect(after.timelineEvents).toBe(beforeEv);
    expect(after.phases).toBe(beforePh);
    expect(after.labels).toBe(beforeLb);
    expect(after.partyMembers).toBe(beforePm);
  });

  it('setActiveHours(2) は表データ5フィールドを変えない', () => {
    const s = useMitigationStore.getState();
    const beforeMit = s.timelineMitigations;
    const beforeEv  = s.timelineEvents;
    const beforePh  = s.phases;
    const beforeLb  = s.labels;
    const beforePm  = s.partyMembers;
    s.setActiveHours(2);
    const after = useMitigationStore.getState();
    expect(after.timelineMitigations).toBe(beforeMit);
    expect(after.timelineEvents).toBe(beforeEv);
    expect(after.phases).toBe(beforePh);
    expect(after.labels).toBe(beforeLb);
    expect(after.partyMembers).toBe(beforePm);
  });

  it('setProgressPointNote は表データ5フィールドを変えない', () => {
    useMitigationStore.getState().recordReachedPoint(20);
    const ptId = useMitigationStore.getState().progress.points[0].id;
    const s = useMitigationStore.getState();
    const beforeMit = s.timelineMitigations;
    const beforeEv  = s.timelineEvents;
    const beforePh  = s.phases;
    const beforeLb  = s.labels;
    const beforePm  = s.partyMembers;
    s.setProgressPointNote(ptId, 'x');
    const after = useMitigationStore.getState();
    expect(after.timelineMitigations).toBe(beforeMit);
    expect(after.timelineEvents).toBe(beforeEv);
    expect(after.phases).toBe(beforePh);
    expect(after.labels).toBe(beforeLb);
    expect(after.partyMembers).toBe(beforePm);
  });
});
