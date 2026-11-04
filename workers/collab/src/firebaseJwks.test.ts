import { describe, it, expect, vi, beforeAll } from "vitest";
import { createJwksSource, FIREBASE_JWKS_URL, parseMaxAgeSeconds } from "./firebaseJwks";

let jwk: Record<string, unknown>;

beforeAll(async () => {
  const kp = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as { publicKey: Parameters<typeof crypto.subtle.exportKey>[1] };
  jwk = (await crypto.subtle.exportKey("jwk", kp.publicKey)) as unknown as Record<string, unknown>;
});

function jwksResponse(kids: string[], cacheControl = "public, max-age=3600, must-revalidate") {
  return new Response(JSON.stringify({ keys: kids.map((kid) => ({ ...jwk, kid, alg: "RS256", use: "sig" })) }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": cacheControl },
  });
}

describe("parseMaxAgeSeconds", () => {
  it("max-age を読む・無ければ null", () => {
    expect(parseMaxAgeSeconds("public, max-age=19302, must-revalidate")).toBe(19302);
    expect(parseMaxAgeSeconds("no-cache")).toBeNull();
    expect(parseMaxAgeSeconds(null)).toBeNull();
  });
});

describe("createJwksSource", () => {
  it("Google の公開鍵を取り、kid の鍵を返す・知らない kid は null", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => jwksResponse(["k1"]));
    const src = createJwksSource(fetchFn, () => 0);
    expect(await src.getKey("k1")).not.toBeNull();
    expect(await src.getKey("k2")).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe(FIREBASE_JWKS_URL);
  });

  it("Cache-Control の期間だけ覚え、過ぎたら取り直す", async () => {
    let t = 0;
    const fetchFn = vi.fn().mockImplementation(async () => jwksResponse(["k1"], "public, max-age=100"));
    const src = createJwksSource(fetchFn, () => t);
    await src.getKey("k1");
    t = 99_999;
    await src.getKey("k1");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    t = 100_000;
    await src.getKey("k1");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("同時の取得は 1 本にまとめる", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => jwksResponse(["k1"]));
    const src = createJwksSource(fetchFn, () => 0);
    await Promise.all([src.getKey("k1"), src.getKey("k1"), src.getKey("k1")]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("取得に失敗したら null(覚えない=次で取り直す)", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockImplementation(async () => jwksResponse(["k1"]));
    const src = createJwksSource(fetchFn, () => 0);
    expect(await src.getKey("k1")).toBeNull();
    expect(await src.getKey("k1")).not.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
