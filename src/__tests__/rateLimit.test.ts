import { describe, it, expect } from 'vitest';
import { resolveClientIp, consumeCounter, type RateLimitRedis } from '../lib/rateLimit';

function makeStub() {
  const store = new Map<string, { count: number; ttl: number }>();
  const r: RateLimitRedis = {
    async incr(key) {
      const e = store.get(key) ?? { count: 0, ttl: -1 };
      e.count += 1;
      store.set(key, e);
      return e.count;
    },
    async expire(key, seconds) {
      const e = store.get(key) ?? { count: 0, ttl: -1 };
      e.ttl = seconds;
      store.set(key, e);
      return 1;
    },
    async ttl(key) {
      return store.get(key)?.ttl ?? -2;
    },
  };
  return { r, store };
}

describe('resolveClientIp', () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name];

  it('cf-connecting-ip を最優先する', () => {
    expect(
      resolveClientIp(headers({
        'cf-connecting-ip': '1.1.1.1',
        'x-vercel-forwarded-for': '2.2.2.2',
        'x-forwarded-for': '9.9.9.9, 8.8.8.8',
      })),
    ).toBe('1.1.1.1');
  });

  it('cf が無ければ x-vercel-forwarded-for', () => {
    expect(
      resolveClientIp(headers({ 'x-vercel-forwarded-for': '2.2.2.2', 'x-forwarded-for': '9.9.9.9' })),
    ).toBe('2.2.2.2');
  });

  it('x-real-ip → x-forwarded-for 最左の順にフォールバック', () => {
    expect(resolveClientIp(headers({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
    expect(resolveClientIp(headers({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8' }))).toBe('9.9.9.9');
  });

  it('カンマ区切りは最初の値を使う', () => {
    expect(resolveClientIp(headers({ 'cf-connecting-ip': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1');
  });

  it('何も無ければ unknown', () => {
    expect(resolveClientIp(headers({}))).toBe('unknown');
  });
});

describe('consumeCounter', () => {
  it('上限以内は許可・超過で拒否', async () => {
    const { r } = makeStub();
    expect(await consumeCounter(r, 'k', 2, 60)).toBe(true);
    expect(await consumeCounter(r, 'k', 2, 60)).toBe(true);
    expect(await consumeCounter(r, 'k', 2, 60)).toBe(false);
  });

  it('初回 INCR で TTL を設定する', async () => {
    const { r, store } = makeStub();
    await consumeCounter(r, 'k', 5, 60);
    expect(store.get('k')?.ttl).toBe(60);
  });

  it('TTL 無しで残留したキーを上限超過の検知時に自己修復する', async () => {
    const { r, store } = makeStub();
    store.set('k', { count: 5, ttl: -1 }); // EXPIRE 失敗で残留した状態を再現
    expect(await consumeCounter(r, 'k', 5, 60)).toBe(false); // count=6 > 5
    expect(store.get('k')?.ttl).toBe(60); // TTL が張り直されている
  });
});
