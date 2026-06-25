// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { isLocalSafetySeen, markLocalSafetySeen } from '../localSafetySeen';

describe('localSafetySeen', () => {
  beforeEach(() => localStorage.clear());

  it('初期状態は未読(false)', () => {
    expect(isLocalSafetySeen()).toBe(false);
  });

  it('mark 後は既読(true)', () => {
    markLocalSafetySeen();
    expect(isLocalSafetySeen()).toBe(true);
  });
});
