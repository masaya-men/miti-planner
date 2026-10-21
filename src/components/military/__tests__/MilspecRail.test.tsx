// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MilspecRail } from '../MilspecRail';

describe('MilspecRail', () => {
  it('取っ手が aria-expanded を持ち、クリックで onToggleSidebar が呼ばれる', () => {
    const onToggleSidebar = vi.fn();
    const { container, rerender } = render(<MilspecRail isSidebarOpen onToggleSidebar={onToggleSidebar} />);
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBeTruthy();
    fireEvent.click(btn);
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    rerender(<MilspecRail isSidebarOpen={false} onToggleSidebar={onToggleSidebar} />);
    expect(container.querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
  });
});
