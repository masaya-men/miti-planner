// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useActiveColorSwatches } from '../useActiveColorSwatches';

describe('useActiveColorSwatches(告知まで管理者だけ)', () => {
  beforeEach(() => {
    useHousingFilterStore.setState({ colorSwatches: [3, 7] });
  });

  it('本番で管理者でない人は store に色が残っていても空', () => {
    vi.stubEnv('DEV', false);
    useAuthStore.setState({ isAdmin: false });
    const { result } = renderHook(() => useActiveColorSwatches());
    expect(result.current).toEqual([]);
    vi.unstubAllEnvs();
  });

  it('本番で管理者なら選んだ色がそのまま効く', () => {
    vi.stubEnv('DEV', false);
    useAuthStore.setState({ isAdmin: true });
    const { result } = renderHook(() => useActiveColorSwatches());
    expect(result.current).toEqual([3, 7]);
    vi.unstubAllEnvs();
    useAuthStore.setState({ isAdmin: false });
  });
});
