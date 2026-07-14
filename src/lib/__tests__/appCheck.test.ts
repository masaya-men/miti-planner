import { describe, it, expect, vi, beforeEach } from 'vitest';

// firebase/app-check をモック(initializeAppCheck の呼び出し回数を観測する)
const initializeAppCheck = vi.fn(() => ({ __mock: 'appcheck-instance' }));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (...args: unknown[]) => initializeAppCheck(...args),
  ReCaptchaEnterpriseProvider: vi.fn(function (this: unknown, key: string) {
    (this as { key: string }).key = key;
  }),
}));

import { createLazyAppCheck } from '../appCheck';

const fakeApp = { name: '[DEFAULT]' } as never;

beforeEach(() => {
  initializeAppCheck.mockClear();
});

describe('createLazyAppCheck', () => {
  it('MODE==="test" では ensureAppCheck が null を返し initializeAppCheck を呼ばない', () => {
    // vitest は import.meta.env.MODE === 'test'
    const { ensureAppCheck } = createLazyAppCheck(fakeApp);
    expect(ensureAppCheck()).toBeNull();
    expect(initializeAppCheck).not.toHaveBeenCalled();
  });

  it('getActiveAppCheck は ensureAppCheck を呼ぶまで null(peek で初期化しない)', () => {
    const { getActiveAppCheck } = createLazyAppCheck(fakeApp);
    expect(getActiveAppCheck()).toBeNull();
    expect(initializeAppCheck).not.toHaveBeenCalled();
  });
});
