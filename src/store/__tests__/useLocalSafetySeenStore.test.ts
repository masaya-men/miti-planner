// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { useLocalSafetySeenStore } from '../useLocalSafetySeenStore';
import { isLocalSafetySeen } from '../../utils/localSafetySeen';

describe('useLocalSafetySeenStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLocalSafetySeenStore.setState({ seen: false });
  });

  it('markSeen で seen が true になり localStorage にも永続する', () => {
    expect(useLocalSafetySeenStore.getState().seen).toBe(false);
    useLocalSafetySeenStore.getState().markSeen();
    expect(useLocalSafetySeenStore.getState().seen).toBe(true);
    expect(isLocalSafetySeen()).toBe(true);
  });
});
