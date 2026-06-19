import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';

const seed = (points: { ts: number; reachedPos: number; note?: string }[], extra = {}) =>
  useMitigationStore.setState({
    progress: { points, cleared: false, ...extra },
    _collabReadonly: false, _collabActive: false,
  } as any);

describe('useMitigationStore progress detail actions', () => {
  beforeEach(() => {
    useMitigationStore.getState().resetForTutorial();
    seed([]);
  });

  it('setProgressPointNote: 指定点に note を付ける', () => {
    seed([{ ts: 1, reachedPos: 10 }, { ts: 2, reachedPos: 20 }]);
    useMitigationStore.getState().setProgressPointNote(1, '  初到達  ');
    const pts = useMitigationStore.getState().progress.points;
    expect(pts[1].note).toBe('初到達'); // trim される
    expect(pts[0].note).toBeUndefined();
  });

  it('setProgressPointNote: 空文字は note を削除（undefined化）', () => {
    seed([{ ts: 1, reachedPos: 10, note: 'x' }]);
    useMitigationStore.getState().setProgressPointNote(0, '   ');
    expect(useMitigationStore.getState().progress.points[0].note).toBeUndefined();
  });

  it('setProgressPointNote: 範囲外 index は無変化', () => {
    seed([{ ts: 1, reachedPos: 10 }]);
    useMitigationStore.getState().setProgressPointNote(5, 'x');
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
    useMitigationStore.getState().insertProgressPointAt(1, { ts: 2, reachedPos: 20 });
    expect(useMitigationStore.getState().progress.points.map(p => p.ts)).toEqual([1, 2, 3]);
  });

  it('collab 閲覧者(readonly)は書き換えをブロック', () => {
    seed([{ ts: 1, reachedPos: 10 }]);
    useMitigationStore.setState({ _collabReadonly: true, _collabActive: false } as any);
    useMitigationStore.getState().clearAllProgressPoints();
    useMitigationStore.getState().setProgressPointNote(0, 'x');
    expect(useMitigationStore.getState().progress.points).toHaveLength(1);
    expect(useMitigationStore.getState().progress.points[0].note).toBeUndefined();
  });
});
