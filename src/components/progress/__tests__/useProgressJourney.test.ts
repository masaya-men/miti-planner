// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProgressJourney } from '../useProgressJourney';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { useProgressRecording } from '../useProgressRecording';

const ev = (time: number) => ({ id: `e${time}`, time, name: '', damage: 0, type: 'physical', target: 'MT' } as any);
const pt = (reachedPos: number) => ({ id: `p${reachedPos}`, reachedPos, ts: 0 } as any);

describe('useProgressJourney', () => {
  beforeEach(() => {
    useMitigationStore.setState({ timelineEvents: [ev(200)], progress: { points: [], cleared: false } } as any);
    useProgressRecording.setState({ panelOpen: false } as any);
  });

  it('打点ゼロ・未クリアは empty で pct は null', () => {
    const { result } = renderHook(() => useProgressJourney());
    expect(result.current.empty).toBe(true);
    expect(result.current.pct).toBeNull();
    expect(result.current.points).toEqual([]);
  });

  it('打点を全長比の % に正規化し、pct は最高到達点基準', () => {
    useMitigationStore.setState({ progress: { points: [pt(50), pt(150), pt(100)], cleared: false } } as any);
    const { result } = renderHook(() => useProgressJourney());
    expect(result.current.empty).toBe(false);
    expect(result.current.percents).toEqual([25, 75, 50]);
    expect(result.current.points).toEqual([{ x: 0, y: 25 }, { x: 50, y: 75 }, { x: 100, y: 50 }]);
    expect(result.current.pct).toBe(75);
  });

  it('1 点なら x は 100', () => {
    useMitigationStore.setState({ progress: { points: [pt(100)], cleared: false } } as any);
    expect(renderHook(() => useProgressJourney()).result.current.points).toEqual([{ x: 100, y: 50 }]);
  });

  it('クリア済みは打点ゼロでも empty でなく pct=100', () => {
    useMitigationStore.setState({ progress: { points: [], cleared: true, activeDays: 5, activeHours: 12 } } as any);
    const r = renderHook(() => useProgressJourney()).result.current;
    expect(r.empty).toBe(false);
    expect(r.cleared).toBe(true);
    expect(r.pct).toBe(100);
    expect([r.hasActivity, r.activeDays, r.activeHours]).toEqual([true, 5, 12]);
  });

  it('活動日数・時間が未設定なら hasActivity=false・0', () => {
    const r = renderHook(() => useProgressJourney()).result.current;
    expect([r.hasActivity, r.activeDays, r.activeHours]).toEqual([false, 0, 0]);
  });

  it('openPanel は閉じている時だけ開く', () => {
    const { result } = renderHook(() => useProgressJourney());
    result.current.openPanel();
    expect(useProgressRecording.getState().panelOpen).toBe(true);
  });
});
