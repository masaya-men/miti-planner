import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickCollapseSetter, useHeaderCollapseAnimator } from '../headerCollapseAnimator';

describe('pickCollapseSetter', () => {
  afterEach(() => useHeaderCollapseAnimator.getState().set(null));
  it('未登録なら元の setter を返す', () => {
    const orig = vi.fn();
    expect(pickCollapseSetter(orig)).toBe(orig);
  });
  it('登録されていれば登録関数を返す', () => {
    const orig = vi.fn(), anim = vi.fn();
    useHeaderCollapseAnimator.getState().set(anim);
    pickCollapseSetter(orig)(true);
    expect(anim).toHaveBeenCalledWith(true);
    expect(orig).not.toHaveBeenCalled();
  });
});
