// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { MilspecVent } from '../MilspecVent';
import * as engine from '../fx/engine';

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const setup = (collapsed = false) => {
  const onToggle = vi.fn();
  const view = render(<MilspecVent isHeaderCollapsed={collapsed} onToggleHeader={onToggle} />);
  return { onToggle, ...view };
};

describe('MilspecVent', () => {
  it('取っ手を押すと 260ms 後に onToggleHeader・200ms 後に溝へ光(tug が付く)', () => {
    const burst = vi.spyOn(engine, 'burst').mockImplementation(() => {});
    const { onToggle, container } = setup();
    const pull = container.querySelector('button.milspec-pull') as HTMLButtonElement;
    fireEvent.click(pull);
    expect(pull.classList.contains('tug')).toBe(true);
    expect(onToggle).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(259); });
    expect(onToggle).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2); });
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(burst).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(burst).toHaveBeenCalledWith('ventL:', { stagger: 25 });
    expect(burst).toHaveBeenCalledWith('ventR:', { stagger: 25 });
  });

  it('aria-expanded と aria-label が開閉で変わる / 閉じていても取っ手は押せる', () => {
    const a = setup(false);
    const b = setup(true);
    const pa = a.container.querySelector('button.milspec-pull')!;
    const pb = b.container.querySelector('button.milspec-pull')!;
    expect(pa.getAttribute('aria-expanded')).toBe('true');
    expect(pb.getAttribute('aria-expanded')).toBe('false');
    expect(pa.getAttribute('aria-label')).not.toBe(pb.getAttribute('aria-label'));
    expect((pb as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(pb);
    act(() => { vi.advanceTimersByTime(300); });
    expect(b.onToggle).toHaveBeenCalledTimes(1);
  });

  it('光の玉の列(11 個・消灯レンズ)・クリックで scanBall・ホバーで nudgeBall', () => {
    const scan = vi.spyOn(engine, 'scanBall').mockImplementation(() => {});
    const nudge = vi.spyOn(engine, 'nudgeBall').mockImplementation(() => {});
    const { container } = setup();
    const row = container.querySelector('.milspec-lb-row') as HTMLElement;
    expect(row.querySelectorAll('.milspec-led').length).toBe(11);
    expect(row.querySelectorAll('.milspec-led.is-dng').length).toBe(0);
    fireEvent.click(row);
    expect(scan).toHaveBeenCalledWith(row);
    fireEvent.pointerEnter(row);
    expect(nudge).toHaveBeenCalledWith(row);
  });

  it('7 秒ごとに scanBall・アンマウントで止まる', () => {
    const scan = vi.spyOn(engine, 'scanBall').mockImplementation(() => {});
    const { unmount } = setup();
    act(() => { vi.advanceTimersByTime(7000); });
    expect(scan).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(7000); });
    expect(scan).toHaveBeenCalledTimes(2);
    unmount();
    act(() => { vi.advanceTimersByTime(30000); });
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it('溝の経路名(ventL:0..4 / ventR:0..4)・漏れ光・記録パネルのアンカーが DOM にある', () => {
    const { container } = setup();
    for (const side of ['L', 'R']) for (let k = 0; k < 5; k++) {
      expect(container.querySelector(`path[data-trace="vent${side}:${k}"]`)).not.toBeNull();
    }
    expect(container.querySelector('path[data-trace="lk:hdr"]')?.getAttribute('d')).toBe('M 0 -1.2 H 1189');
    expect(container.querySelector('[data-progress-drawer-anchor]')).not.toBeNull();
    expect(container.textContent).toContain('HDR PNL 1A · DO NOT STEP');
    expect(container.textContent).toContain('P/N 7A-2213-0418');
  });
  it('台車(data-vent-carriage)の中に光の玉の列と取っ手があり、レール(data-vent-rail)がある', () => {
    const { container } = setup();
    const car = container.querySelector('[data-vent-carriage]') as HTMLElement;
    expect(car.classList.contains('milspec-carriage')).toBe(true);
    expect(car.querySelector('.milspec-lb-row')).not.toBeNull();
    expect(car.querySelector('button.milspec-pull')).not.toBeNull();
    expect(container.querySelector('[data-vent-rail]')).not.toBeNull();
  });
});
