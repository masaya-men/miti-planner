// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { HousingToast } from '../../components/housing/workspace/HousingToast';

describe('HousingToast', () => {
  it('renders message with default info variant + role=status', () => {
    render(<HousingToast message="hello" onClose={() => {}} />);
    const el = screen.getByText('hello');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('data-variant')).toBe('info');
  });

  it('applies error variant via data attribute', () => {
    render(<HousingToast message="oops" variant="error" onClose={() => {}} />);
    expect(screen.getByText('oops').getAttribute('data-variant')).toBe('error');
  });

  it('calls onClose after duration', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<HousingToast message="x" duration={1000} onClose={onClose} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('clears the timer on unmount so onClose does not fire after destroy', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { unmount } = render(<HousingToast message="x" duration={1000} onClose={onClose} />);
    unmount();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onClose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not reset timer when parent re-renders with a new onClose identity', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    function Harness({ tick }: { tick: number }) {
      // A new arrow each render — identity changes on every `tick` bump
      return <HousingToast message="x" duration={1000} onClose={() => { onClose(); void tick; }} />;
    }
    const { rerender } = render(<Harness tick={0} />);
    act(() => { vi.advanceTimersByTime(500); });
    // Parent re-renders mid-flight with a new onClose reference
    rerender(<Harness tick={1} />);
    act(() => { vi.advanceTimersByTime(500); });
    // Timer should fire on the original schedule, not be reset by the new onClose
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
