// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { MilspecRail } from '../MilspecRail';

describe('MilspecRail', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('取っ手は縦(is-v)・aria-expanded・aria-label を持つ', () => {
    const { container, rerender } = render(<MilspecRail isSidebarOpen onToggleSidebar={vi.fn()} />);
    const btn = container.querySelector('button')!;
    expect(btn.classList.contains('milspec-pull')).toBe(true);
    expect(btn.classList.contains('is-v')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBeTruthy();
    rerender(<MilspecRail isSidebarOpen={false} onToggleSidebar={vi.fn()} />);
    expect(container.querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('取っ手を押すと 260ms 後に onToggleSidebar が 1 回呼ばれる(押下直後は呼ばれない)', () => {
    vi.useFakeTimers();
    const onToggleSidebar = vi.fn();
    const { container } = render(<MilspecRail isSidebarOpen onToggleSidebar={onToggleSidebar} />);
    const btn = container.querySelector('button')!;
    fireEvent.click(btn);
    expect(btn.classList.contains('tug')).toBe(true);
    expect(onToggleSidebar).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(259); });
    expect(onToggleSidebar).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2); });
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('光の経路 rail:a0..7(続きは rail:b)と rail:b0..7 が DOM にある', () => {
    const { container } = render(<MilspecRail isSidebarOpen onToggleSidebar={vi.fn()} />);
    for (let k = 0; k < 8; k++) {
      const a = container.querySelector(`path[data-trace="rail:a${k}"]`);
      expect(a?.getAttribute('data-trace-next')).toBe(`rail:b${k}`);
      expect(container.querySelector(`path[data-trace="rail:b${k}"]`)).not.toBeNull();
    }
  });

  it('基板部品(IC・ビア・SMD・刻印)とリベットがある', () => {
    const { container } = render(<MilspecRail isSidebarOpen onToggleSidebar={vi.fn()} />);
    expect(container.querySelector('svg .ic')).not.toBeNull();
    expect(container.querySelectorAll('svg .via').length).toBeGreaterThan(20);
    expect(container.querySelectorAll('svg .smd')).toHaveLength(4);
    expect(container.textContent).toContain('SIG-A');
    expect(container.textContent).toContain('PULL');
    expect(container.querySelectorAll('.milspec-rivet').length).toBe(12);
  });
});
