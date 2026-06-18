import { describe, it, expect, beforeEach } from 'vitest';
import { useProgressRecording } from '../useProgressRecording';
import { useMitigationStore } from '../../../store/useMitigationStore';

function setupTimeline() {
  // total=200 になるよう timelineEvents をセット
  useMitigationStore.setState({
    timelineEvents: [{ id: 'e', time: 200, name: '', damage: 0, type: 'physical', target: 'MT' } as any],
    progress: { points: [], cleared: false },
    _collabReadonly: false, _collabActive: false,
  } as any);
}

describe('useProgressRecording commit/undo/toast', () => {
  beforeEach(() => {
    setupTimeline();
    useProgressRecording.setState({ panelOpen: true, recordMode: true, toast: null, lastRecordedTs: null });
  });

  it('初回記録で update トースト + pct + lastRecordedTs を立てる', () => {
    useProgressRecording.getState().commitReachedPos(100); // 100/200 = 50%
    const t = useProgressRecording.getState().toast;
    expect(t?.kind).toBe('update');
    expect(t?.pct).toBe(50);
    expect(useProgressRecording.getState().lastRecordedTs).not.toBeNull();
    // 記録されている
    expect(useMitigationStore.getState().progress.points.length).toBe(1);
  });

  it('過去最高より手前は nice・pct は最高基準で減らない', () => {
    useProgressRecording.getState().commitReachedPos(160); // 80% update
    useProgressRecording.getState().commitReachedPos(40);  // 手前 → nice, pct=80
    const t = useProgressRecording.getState().toast;
    expect(t?.kind).toBe('nice');
    expect(t?.pct).toBe(80);
  });

  it('undoLastRecord は直前の点だけ消す', () => {
    useProgressRecording.getState().commitReachedPos(100);
    expect(useMitigationStore.getState().progress.points.length).toBe(1);
    useProgressRecording.getState().undoLastRecord();
    expect(useMitigationStore.getState().progress.points.length).toBe(0);
    expect(useProgressRecording.getState().lastRecordedTs).toBeNull();
  });

  it('clearToast で toast=null', () => {
    useProgressRecording.getState().commitReachedPos(100);
    useProgressRecording.getState().clearToast();
    expect(useProgressRecording.getState().toast).toBeNull();
  });
});
