// verify(受付係 Vercel の /api/collab/verify)結果の短期記憶。
// つなぎ直しのたびに同じ ID トークンで Vercel を呼ばないための、isolate 内のベストエフォートなキャッシュ
// (isolate が入れ替われば消える)。
//
// 安全性:
// - 覚えるのは成功(uid が返った)だけ。null(不正・期限切れ・障害)は覚えない=障害が直れば次の接続で通る。
// - 期限 = min(トークンの exp, 今 + VERIFY_CACHE_MAX_MS)。exp が読めない/既に過ぎている → 覚えない。
//   exp は payload を読むだけ(署名確認は Vercel が済ませた後にしか覚えない・鍵はトークン全体の hash
//   なので別トークンに流用されない)。
// - 生のトークンは鍵にも値にも持たない(鍵 = SHA-256 hex、値 = uid と期限だけ)。
// - 今の verify は checkRevoked なし=取り消したトークンも exp まで通る。キャッシュは exp を超えないので
//   通る時間の上限は今と同じ。**将来 verify に checkRevoked: true を足したら、取り消しの反映が
//   最大 VERIFY_CACHE_MAX_MS 遅れる → その時はこの値を見直すこと。**
import type { VerifyFn } from "./collabAuth";

export const VERIFY_CACHE_MAX_MS = 10 * 60_000;
export const VERIFY_CACHE_MAX_ENTRIES = 500;

/** JWT の payload の exp(秒)をミリ秒で返す。読めなければ null。 */
export function readJwtExpMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    const exp = payload?.exp;
    if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
    return exp * 1000;
  } catch {
    return null;
  }
}

/** トークンの SHA-256 hex(キャッシュの鍵)。 */
export async function tokenCacheKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

interface Entry {
  uid: string;
  expiresAt: number;
}

export function createVerifyCache(now: () => number = Date.now): {
  verify(token: string, inner: VerifyFn): Promise<string | null>;
  size(): number;
} {
  const entries = new Map<string, Entry>();

  return {
    async verify(token, inner) {
      const key = await tokenCacheKey(token);
      const hit = entries.get(key);
      if (hit) {
        if (now() < hit.expiresAt) return hit.uid;
        entries.delete(key);
      }
      const uid = await inner(token);
      if (!uid) return uid;
      const expMs = readJwtExpMs(token);
      const t = now();
      if (expMs === null || expMs <= t) return uid;
      entries.delete(key);
      while (entries.size >= VERIFY_CACHE_MAX_ENTRIES) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      entries.set(key, { uid, expiresAt: Math.min(expMs, t + VERIFY_CACHE_MAX_MS) });
      return uid;
    },
    size() {
      return entries.size;
    },
  };
}
