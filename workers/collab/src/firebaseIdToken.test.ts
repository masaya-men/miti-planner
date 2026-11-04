import { describe, it, expect, beforeAll } from "vitest";
import { verifyFirebaseIdToken } from "./firebaseIdToken";
import type { VerifyKey } from "./firebaseJwks";

// テスト用 tsconfig は workers-types を読まないので、鍵の型は VerifyKey から作る
type Key = VerifyKey;
type KeyPair = { publicKey: Key; privateKey: Key };

const PROJECT = "test-project";
const NOW_S = 1_800_000_000;
const now = () => NOW_S * 1000;

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let privateKey: Key;
let publicKey: Key;
let otherPrivateKey: Key;

async function genKeyPair(): Promise<KeyPair> {
  return (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as KeyPair;
}

beforeAll(async () => {
  const kp = await genKeyPair();
  privateKey = kp.privateKey;
  publicKey = kp.publicKey;
  otherPrivateKey = (await genKeyPair()).privateKey;
});

const getKey = async (kid: string) => (kid === "kid-1" ? publicKey : null);

function validClaims(): Record<string, unknown> {
  return {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: "user-1",
    iat: NOW_S - 60,
    auth_time: NOW_S - 60,
    exp: NOW_S + 3600,
  };
}

async function sign(
  claims: Record<string, unknown>,
  opts: { kid?: string; alg?: string; key?: Key } = {},
): Promise<string> {
  const header = { alg: opts.alg ?? "RS256", kid: opts.kid ?? "kid-1", typ: "JWT" };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", opts.key ?? privateKey, new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

describe("verifyFirebaseIdToken", () => {
  it("正しい署名・項目なら uid(sub)を返す", async () => {
    expect(await verifyFirebaseIdToken(await sign(validClaims()), PROJECT, getKey, now)).toBe("user-1");
  });

  it("期限切れは null", async () => {
    const t = await sign({ ...validClaims(), exp: NOW_S });
    expect(await verifyFirebaseIdToken(t, PROJECT, getKey, now)).toBeNull();
  });

  it("aud 違いは null", async () => {
    const t = await sign({ ...validClaims(), aud: "other-project" });
    expect(await verifyFirebaseIdToken(t, PROJECT, getKey, now)).toBeNull();
  });

  it("iss 違いは null", async () => {
    const t = await sign({ ...validClaims(), iss: "https://securetoken.google.com/other-project" });
    expect(await verifyFirebaseIdToken(t, PROJECT, getKey, now)).toBeNull();
  });

  it("鍵 ID 違い(知らない kid)は null", async () => {
    const t = await sign(validClaims(), { kid: "kid-unknown" });
    expect(await verifyFirebaseIdToken(t, PROJECT, getKey, now)).toBeNull();
  });

  it("署名の改ざん(中身を書き換え)は null", async () => {
    const t = await sign(validClaims());
    const [h, , s] = t.split(".");
    const forged = `${h}.${b64url(JSON.stringify({ ...validClaims(), sub: "attacker" }))}.${s}`;
    expect(await verifyFirebaseIdToken(forged, PROJECT, getKey, now)).toBeNull();
  });

  it("別の鍵で署名されたものは null", async () => {
    const t = await sign(validClaims(), { key: otherPrivateKey });
    expect(await verifyFirebaseIdToken(t, PROJECT, getKey, now)).toBeNull();
  });

  it("alg が RS256 でなければ null", async () => {
    const t = await sign(validClaims(), { alg: "HS256" });
    expect(await verifyFirebaseIdToken(t, PROJECT, getKey, now)).toBeNull();
  });

  it("sub が空なら null", async () => {
    const t = await sign({ ...validClaims(), sub: "" });
    expect(await verifyFirebaseIdToken(t, PROJECT, getKey, now)).toBeNull();
  });

  it("iat / auth_time が未来(許容 60 秒超)なら null", async () => {
    expect(await verifyFirebaseIdToken(await sign({ ...validClaims(), iat: NOW_S + 120 }), PROJECT, getKey, now)).toBeNull();
    expect(await verifyFirebaseIdToken(await sign({ ...validClaims(), auth_time: NOW_S + 120 }), PROJECT, getKey, now)).toBeNull();
  });

  it("形の壊れたトークン・プロジェクト ID 空は null", async () => {
    expect(await verifyFirebaseIdToken("not-a-jwt", PROJECT, getKey, now)).toBeNull();
    expect(await verifyFirebaseIdToken("a.b.c", PROJECT, getKey, now)).toBeNull();
    expect(await verifyFirebaseIdToken(await sign(validClaims()), "", getKey, now)).toBeNull();
  });
});
