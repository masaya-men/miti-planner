// Firebase ID トークンを worker の中で確かめる(Vercel の /api/collab/verify を呼ばない)。
// Firebase 公式「第三者のライブラリで ID トークンを確かめる」と同じ項目を見る:
//   header: alg = RS256・kid が Google の公開鍵にある / 署名: RS256(WebCrypto)
//   payload: exp が未来・iat と auth_time が過去・aud = プロジェクト ID・
//            iss = https://securetoken.google.com/<プロジェクト ID>・sub が空でない文字列
// 取り消し(checkRevoked)の確認はしない(従来の Vercel verify もしていない=同じ)。
// iat / auth_time は時計のずれを CLOCK_SKEW_S だけ許す(exp は許さない)。

import type { VerifyKey } from "./firebaseJwks";

const CLOCK_SKEW_S = 60;

export type GetKeyFn = (kid: string) => Promise<VerifyKey | null>;

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** 正しい Firebase ID トークンなら uid(sub)を、そうでなければ null を返す(throw しない)。 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  getKey: GetKeyFn,
  now: () => number = Date.now,
): Promise<string | null> {
  if (!token || !projectId) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const header = decodeJson(h);
  const payload = decodeJson(p);
  if (!header || !payload) return null;
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

  const nowS = now() / 1000;
  if (!isNum(payload.exp) || payload.exp <= nowS) return null;
  if (!isNum(payload.iat) || payload.iat > nowS + CLOCK_SKEW_S) return null;
  if (!isNum(payload.auth_time) || payload.auth_time > nowS + CLOCK_SKEW_S) return null;
  if (payload.aud !== projectId) return null;
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;

  try {
    const key = await getKey(header.kid);
    if (!key) return null;
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    return ok ? payload.sub : null;
  } catch {
    return null;
  }
}
