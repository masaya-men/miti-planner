// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { requestPersistentStorage } from '../requestPersistentStorage';

const setStorage = (storage: unknown) => {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
};

describe('requestPersistentStorage', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('navigator.storage が無ければ false を返し例外を投げない', async () => {
    setStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('既に persisted() が true なら persist() を呼ばず true', async () => {
    const persist = vi.fn();
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('persisted() が false なら persist() を呼びその結果を返す', async () => {
    setStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
    });
    await expect(requestPersistentStorage()).resolves.toBe(true);
  });

  it('persist() が throw しても false を返す', async () => {
    setStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockRejectedValue(new Error('denied')),
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
