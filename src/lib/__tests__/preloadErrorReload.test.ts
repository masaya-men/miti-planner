import { describe, it, expect } from 'vitest';
import { shouldReloadOnPreloadError } from '../preloadErrorReload';

// テスト用の最小 Storage（sessionStorage 相当）
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => { m.clear(); },
    key: () => null,
    get length() { return m.size; },
  } as Storage;
}

describe('shouldReloadOnPreloadError (チャンク読込失敗時の自動リロード判定)', () => {
  it('1セッションの初回は true（=リロードする）', () => {
    const s = makeStorage();
    expect(shouldReloadOnPreloadError(s)).toBe(true);
  });

  it('2回目以降は false（無限リロードループ防止）', () => {
    const s = makeStorage();
    shouldReloadOnPreloadError(s); // 初回でフラグが立つ
    expect(shouldReloadOnPreloadError(s)).toBe(false);
    expect(shouldReloadOnPreloadError(s)).toBe(false);
  });

  it('別セッション（別 storage）なら再び true（=新しい機会には1回リロードできる）', () => {
    const s1 = makeStorage();
    shouldReloadOnPreloadError(s1);
    const s2 = makeStorage();
    expect(shouldReloadOnPreloadError(s2)).toBe(true);
  });
});
