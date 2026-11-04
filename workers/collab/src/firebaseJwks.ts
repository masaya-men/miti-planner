// Firebase ID トークンの署名を確かめる Google の公開鍵(securetoken の JWK)の取得と記憶。
// 応答の Cache-Control の max-age の間だけ isolate 内に覚える(Google が鍵の入れ替えに合わせて期間を決める)。
// 取得失敗は覚えない(次の呼び出しで取り直す)。同時の取得は 1 本にまとめる。

export const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

/** 取り込んだ公開鍵の型(テスト用 tsconfig でも解決できるよう importKey の戻り値から取る)。 */
export type VerifyKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

/** Cache-Control に max-age が無い時に覚える期間。 */
const FALLBACK_TTL_MS = 5 * 60_000;

export function parseMaxAgeSeconds(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  const m = /(?:^|[,\s])max-age=(\d+)/i.exec(cacheControl);
  return m ? Number(m[1]) : null;
}

interface KeySet {
  keys: Map<string, VerifyKey>;
  expiresAt: number;
}

type FetchFn = (url: string) => Promise<Response>;

/** Google の応答の 1 鍵分(使う項目だけ)。 */
interface RsaJwk {
  kty?: string;
  kid?: string;
  n?: string;
  e?: string;
}

async function loadKeySet(fetchFn: FetchFn, now: () => number): Promise<KeySet | null> {
  try {
    const res = await fetchFn(FIREBASE_JWKS_URL);
    if (!res.ok) return null;
    const body = (await res.json()) as { keys?: RsaJwk[] };
    const keys = new Map<string, VerifyKey>();
    for (const jwk of body.keys ?? []) {
      if (typeof jwk.kid !== "string" || jwk.kty !== "RSA") continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      keys.set(jwk.kid, key);
    }
    if (keys.size === 0) return null;
    const maxAge = parseMaxAgeSeconds(res.headers.get("cache-control"));
    return { keys, expiresAt: now() + (maxAge !== null ? maxAge * 1000 : FALLBACK_TTL_MS) };
  } catch {
    return null;
  }
}

export function createJwksSource(
  fetchFn: FetchFn = (url) => fetch(url),
  now: () => number = Date.now,
): { getKey(kid: string): Promise<VerifyKey | null> } {
  let current: KeySet | null = null;
  let inflight: Promise<KeySet | null> | null = null;

  async function keySet(): Promise<KeySet | null> {
    if (current && now() < current.expiresAt) return current;
    if (!inflight) {
      inflight = loadKeySet(fetchFn, now).then((ks) => {
        if (ks) current = ks;
        inflight = null;
        return ks;
      });
    }
    return inflight;
  }

  return {
    async getKey(kid) {
      const ks = await keySet();
      return ks?.keys.get(kid) ?? null;
    },
  };
}
