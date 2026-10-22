// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { HousingPullToRefresh } from '../HousingPullToRefresh';

function setStandalone(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('standalone'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
}

function touch(target: Element, type: string, y: number, x = 100, count = 1) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const pts = Array.from({ length: count }, () => ({ clientX: x, clientY: y }));
  Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : pts });
  target.dispatchEvent(ev);
  return ev;
}

/** target 上で startY から endY まで引いて離す */
function drag(target: Element, endY: number, startY = 100) {
  touch(target, 'touchstart', startY);
  touch(target, 'touchmove', startY + 10);
  touch(target, 'touchmove', endY);
  touch(target, 'touchend', endY);
}

describe('HousingPullToRefresh', () => {
  const onRefresh = vi.fn();
  let host: HTMLElement;
  let inner: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    onRefresh.mockReset();
    document.body.innerHTML = '<div class="housing-shell"><div id="host"><div id="inner"></div></div></div>';
    host = document.getElementById('host')!;
    inner = document.getElementById('inner')!;
    setStandalone(true);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('standalone でない時は何もしない', () => {
    setStandalone(false);
    render(<HousingPullToRefresh onRefresh={onRefresh} />);
    drag(inner, 100 + 150);
    vi.advanceTimersByTime(1000);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('一番上で 80px 相当(抵抗後)引いて離すと更新される(最短 300ms 後)', () => {
    render(<HousingPullToRefresh onRefresh={onRefresh} />);
    drag(inner, 100 + 150); // 150 * 0.55 = 82.5 >= 70
    vi.advanceTimersByTime(299);
    expect(onRefresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('しきい値未満で離しても更新されない', () => {
    render(<HousingPullToRefresh onRefresh={onRefresh} />);
    drag(inner, 100 + 100); // 100 * 0.55 = 55 < 70
    vi.advanceTimersByTime(1000);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('スクロール途中 (scrollTop>0) では始まらない', () => {
    render(<HousingPullToRefresh onRefresh={onRefresh} />);
    Object.defineProperty(host, 'scrollTop', { value: 40, configurable: true });
    drag(inner, 100 + 150);
    vi.advanceTimersByTime(1000);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('data-no-pull-refresh の中では始まらない', () => {
    render(<HousingPullToRefresh onRefresh={onRefresh} />);
    host.setAttribute('data-no-pull-refresh', '');
    drag(inner, 100 + 150);
    vi.advanceTimersByTime(1000);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('role=dialog の中では始まらない', () => {
    render(<HousingPullToRefresh onRefresh={onRefresh} />);
    host.setAttribute('role', 'dialog');
    drag(inner, 100 + 150);
    vi.advanceTimersByTime(1000);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('地図の中では始まらない', () => {
    render(<HousingPullToRefresh onRefresh={onRefresh} />);
    host.className = 'housing-bmap-wrap';
    drag(inner, 100 + 150);
    vi.advanceTimersByTime(1000);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('横方向の動きが大きい時・上方向の時は始まらず、標準動作を止めない', () => {
    render(<HousingPullToRefresh onRefresh={onRefresh} />);
    touch(inner, 'touchstart', 100);
    const ev = touch(inner, 'touchmove', 120, 160);
    expect(ev.defaultPrevented).toBe(false);
    touch(inner, 'touchmove', 300, 160);
    touch(inner, 'touchend', 300);
    const up = touch(inner, 'touchstart', 300);
    expect(up.defaultPrevented).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('引っ張り中と判定した時だけ preventDefault する', () => {
    render(<HousingPullToRefresh onRefresh={onRefresh} />);
    touch(inner, 'touchstart', 100);
    expect(touch(inner, 'touchmove', 103).defaultPrevented).toBe(false); // 遊びの範囲
    expect(touch(inner, 'touchmove', 130).defaultPrevented).toBe(true);
  });
});
