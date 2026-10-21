// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useTurbineCluster, beatInterval } from '../useTurbineCluster';

let api: ReturnType<typeof useTurbineCluster>;
const beats: number[] = [];
function Harness() {
  api = useTurbineCluster(2, { onBeat: (k) => beats.push(k) });
  return (
    <div>
      <div ref={api.frameRefs[0]}><span ref={api.vaneRefs[0]} /></div>
      <div ref={api.frameRefs[1]}><span ref={api.vaneRefs[1]} /></div>
    </div>
  );
}

const setHidden = (v: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useTurbineCluster', () => {
  beforeEach(() => { vi.useFakeTimers(); beats.length = 0; });
  afterEach(() => { setHidden(false); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('beatInterval は見本 js:1196 の式(k<6 で 640-k*70、以降 280)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(beatInterval)).toEqual([640, 570, 500, 430, 360, 290, 280, 280]);
  });

  it('start すると onBeat が即 0 を呼び、以降は見本の間隔で呼ばれる', () => {
    render(<Harness />);
    act(() => api.start());
    expect(beats).toEqual([0]);
    act(() => { vi.advanceTimersByTime(569); });
    expect(beats).toEqual([0]);
    act(() => { vi.advanceTimersByTime(1); }); // 570ms 目
    expect(beats).toEqual([0, 1]);
    act(() => { vi.advanceTimersByTime(500); }); // +500
    expect(beats).toEqual([0, 1, 2]);
  });

  it('終了(総尺+80ms)で拍が止まり active が戻る・アンマウントでもタイマーが残らない', () => {
    const { unmount } = render(<Harness />);
    act(() => api.start());
    expect(api.active).toBe(true);
    act(() => { vi.advanceTimersByTime(12000); });
    expect(api.active).toBe(false);
    const n = beats.length;
    act(() => { vi.advanceTimersByTime(5000); });
    expect(beats.length).toBe(n);
    act(() => api.start());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('document.hidden の間は rAF を止め、戻ったら再開する', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 7);
    const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    render(<Harness />);
    expect(raf).toHaveBeenCalledTimes(1);
    act(() => setHidden(true));
    expect(caf).toHaveBeenCalledWith(7);
    raf.mockClear();
    act(() => setHidden(false));
    expect(raf).toHaveBeenCalledTimes(1);
  });
});
