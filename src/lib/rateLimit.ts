/**
 * APIレート制限ユーティリティ
 * IPアドレスごとにリクエスト数を制限する
 * Vercel Serverless Functions用（インメモリ・インスタンス単位）
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** 古いエントリを定期的にクリーンアップ（メモリリーク防止） */
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

// 5分ごとにクリーンアップ
setInterval(cleanup, 5 * 60 * 1000);

/**
 * レート制限チェック
 * @param ip クライアントのIPアドレス
 * @param maxRequests ウィンドウあたりの最大リクエスト数（デフォルト: 10）
 * @param windowMs ウィンドウの長さ（ミリ秒、デフォルト: 60秒）
 * @returns true = 許可, false = 制限超過
 */
export function checkRateLimit(
  ip: string,
  maxRequests = 10,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return false;
  }
  return true;
}

/**
 * Vercel APIハンドラーにレート制限を適用するヘルパー
 * @returns true = リクエスト続行OK, false = 429を返した（ハンドラーは即return）
 */
export function applyRateLimit(req: any, res: any, maxRequests = 10, windowMs = 60_000): boolean {
  const ip = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkRateLimit(ip, maxRequests, windowMs)) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }
  return true;
}
