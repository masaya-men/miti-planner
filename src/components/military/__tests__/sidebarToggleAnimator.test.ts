import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickSidebarSetter, useSidebarToggleAnimator } from '../sidebarToggleAnimator';

describe('pickSidebarSetter', () => {
  afterEach(() => useSidebarToggleAnimator.getState().set(null));
  it('未登録なら元の setter を返す', () => {
    const orig = vi.fn();
    expect(pickSidebarSetter(orig)).toBe(orig);
  });
  it('登録されていればそれを返す', () => {
    const orig = vi.fn(), anim = vi.fn();
    useSidebarToggleAnimator.getState().set(anim);
    pickSidebarSetter(orig)(false);
    expect(anim).toHaveBeenCalledWith(false);
    expect(orig).not.toHaveBeenCalled();
  });
});
