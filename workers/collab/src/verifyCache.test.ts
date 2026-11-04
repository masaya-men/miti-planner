import { describe, it, expect, vi } from "vitest";
import {
  createVerifyCache,
  tokenCacheKey,
  readJwtExpMs,
  VERIFY_CACHE_MAX_MS,
  VERIFY_CACHE_MAX_ENTRIES,
} from "./verifyCache";

const T0 = Date.UTC(2026, 10, 5, 0, 0, 0);

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** header.<base64url({exp, uid})>.sig の形のトークンを組み立てる(exp は秒)。 */
function makeToken(expMs: number, uid = "user-1"): string {
  return `${b64url('{"alg":"RS256"}')}.${b64url(JSON.stringify({ exp: Math.floor(expMs / 1000), uid }))}.sig`;
}

function clock(start = T0) {
  let t = start;
  return { now: () => t, set: (v: number) => { t = v; } };
}

describe("verifyCache", () => {
  it("同じトークンの 2 回目は inner を呼ばない", async () => {
    const c = clock();
    const cache = createVerifyCache(c.now);
    const inner = vi.fn().mockResolvedValue("user-1");
    const tok = makeToken(T0 + 60 * 60_000);
    expect(await cache.verify(tok, inner)).toBe("user-1");
    expect(await cache.verify(tok, inner)).toBe("user-1");
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("10 分たったら inner を呼び直す", async () => {
    const c = clock();
    const cache = createVerifyCache(c.now);
    const inner = vi.fn().mockResolvedValue("user-1");
    const tok = makeToken(T0 + 60 * 60_000);
    await cache.verify(tok, inner);
    c.set(T0 + VERIFY_CACHE_MAX_MS);
    await cache.verify(tok, inner);
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("exp が 10 分より近ければ exp で切れる", async () => {
    const c = clock();
    const cache = createVerifyCache(c.now);
    const inner = vi.fn().mockResolvedValue("user-1");
    const tok = makeToken(T0 + 2 * 60_000);
    await cache.verify(tok, inner);
    c.set(T0 + 2 * 60_000 - 1);
    await cache.verify(tok, inner);
    expect(inner).toHaveBeenCalledTimes(1);
    c.set(T0 + 2 * 60_000);
    await cache.verify(tok, inner);
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("null は覚えない", async () => {
    const cache = createVerifyCache(clock().now);
    const inner = vi.fn().mockResolvedValue(null);
    const tok = makeToken(T0 + 60 * 60_000);
    expect(await cache.verify(tok, inner)).toBeNull();
    expect(await cache.verify(tok, inner)).toBeNull();
    expect(inner).toHaveBeenCalledTimes(2);
    expect(cache.size()).toBe(0);
  });

  it("exp が読めないトークンは覚えない", async () => {
    const cache = createVerifyCache(clock().now);
    const inner = vi.fn().mockResolvedValue("user-1");
    await cache.verify("not-a-jwt", inner);
    await cache.verify("not-a-jwt", inner);
    expect(inner).toHaveBeenCalledTimes(2);
    expect(readJwtExpMs("not-a-jwt")).toBeNull();
    expect(readJwtExpMs(`a.${b64url('{"exp":"x"}')}.c`)).toBeNull();
  });

  it("期限切れ exp のトークンは覚えない", async () => {
    const cache = createVerifyCache(clock().now);
    const inner = vi.fn().mockResolvedValue("user-1");
    const tok = makeToken(T0 - 1000);
    await cache.verify(tok, inner);
    await cache.verify(tok, inner);
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("上限 500 件を超えたら古いものから捨てる", async () => {
    const cache = createVerifyCache(clock().now);
    const inner = vi.fn().mockResolvedValue("user-1");
    const tokens = Array.from({ length: VERIFY_CACHE_MAX_ENTRIES + 1 }, (_, i) =>
      makeToken(T0 + 60 * 60_000, `u${i}`),
    );
    for (const t of tokens) await cache.verify(t, inner);
    expect(cache.size()).toBe(VERIFY_CACHE_MAX_ENTRIES);
    inner.mockClear();
    await cache.verify(tokens[0], inner);
    expect(inner).toHaveBeenCalledTimes(1);
    inner.mockClear();
    await cache.verify(tokens[VERIFY_CACHE_MAX_ENTRIES], inner);
    expect(inner).toHaveBeenCalledTimes(0);
  });

  it("鍵は SHA-256 の hex で生のトークンを含まない", async () => {
    const key = await tokenCacheKey("abc");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toBe("abc");
    expect(key).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
