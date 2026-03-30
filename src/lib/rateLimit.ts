/**
 * APIレート制限ユーティリティ
 * IPアドレスごとにリクエスト数を制限する
 * Upstash Redis使用（Vercel Serverless Functions間で共有）
 * Redis障害時はフェイルオープン（レート制限をスキップしてAPIを通す）
 */

import { Redis } from '@upstash/redis';

/** Upstash Redis クライアント（環境変数未設定時はnull） */
let redis: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  // Redis初期化失敗時はフェイルオープン
  redis = null;
}

/**
 * レート制限チェック（非同期）
 * @param ip クライアントのIPアドレス
 * @param maxRequests ウィンドウあたりの最大リクエスト数（デフォルト: 10）
 * @param windowMs ウィンドウの長さ（ミリ秒、デフォルト: 60秒）
 * @returns true = 許可, false = 制限超過
 */
export async function checkRateLimit(
  ip: string,
  maxRequests = 10,
  windowMs = 60_000,
): Promise<boolean> {
  // Redis未設定時はフェイルオープン（制限なしで通す）
  if (!redis) return true;

  try {
    const key = `rate:${ip}`;
    const windowSec = Math.ceil(windowMs / 1000);

    // INCRでカウントアップ、初回ならEXPIREで有効期限を設定
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSec);
    }

    return count <= maxRequests;
  } catch {
    // Redis障害時はフェイルオープン
    return true;
  }
}

/**
 * Vercel APIハンドラーにレート制限を適用するヘルパー
 * @returns true = リクエスト続行OK, false = 429を返した（ハンドラーは即return）
 */
export async function applyRateLimit(req: any, res: any, maxRequests = 10, windowMs = 60_000): Promise<boolean> {
  const ip = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  const allowed = await checkRateLimit(ip, maxRequests, windowMs);
  if (!allowed) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }
  return true;
}
