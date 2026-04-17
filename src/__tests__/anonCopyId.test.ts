// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAnonCopyId } from '../lib/anonCopyId';

describe('getAnonCopyId', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('初回呼び出しで UUID v4 形式のIDを生成し localStorage に保存する', () => {
    const id = getAnonCopyId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(localStorage.getItem('lopo_anon_copy_id')).toBe(id);
  });

  it('2回目以降の呼び出しで同じIDを返す', () => {
    const id1 = getAnonCopyId();
    const id2 = getAnonCopyId();
    expect(id1).toBe(id2);
  });

  it('localStorage が使えない環境では null を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    expect(getAnonCopyId()).toBeNull();
  });
});
