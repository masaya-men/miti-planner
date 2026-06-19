import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';

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
