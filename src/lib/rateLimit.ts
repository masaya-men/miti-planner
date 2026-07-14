/**
 * API レート制限ユーティリティ
 * Upstash Redis 使用 (Vercel Serverless/Edge Functions 間で共有・REST ベースなので Edge でも動く)
 * Redis 障害時はフェイルオープン (レート制限をスキップして API を通す)
 *
 * 2026-07-14 強化:
 * - IP はクライアントが自由に設定できるヘッダを単独で信用しない
 * - キーに scope を追加 (エンドポイント群ごとに独立バケット。省略時は従来互換の共有バケット)
 * - EXPIRE 漏れキーの自己修復 (TTL 無し残留による恒久 429 を防ぐ)
 * - scope 単位のグローバルバジェット (IP が分散しても合計回数を頭打ちにする)
 * - Edge runtime (Web Request) 用ヘルパー
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

/** テスト用に最小限の Redis 面だけ切り出したインターフェース */
export interface RateLimitRedis {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

/**
 * クライアント IP の決定。
 * 優先順: cf-connecting-ip (Cloudflare 前段の正値) → x-vercel-forwarded-for / x-real-ip
 * (Vercel 付与) → x-forwarded-for 最左 (最後の手段)。
 */
export function resolveClientIp(getHeader: (name: string) => string | undefined): string {
  const pick = (name: string): string | undefined => {
    const v = getHeader(name);
    if (!v) return undefined;
    const first = v.split(',')[0]?.trim();
    return first || undefined;
  };
  return (
    pick('cf-connecting-ip')
    ?? pick('x-vercel-forwarded-for')
    ?? pick('x-real-ip')
    ?? pick('x-forwarded-for')
    ?? 'unknown'
  );
}

/** Node ハンドラの req.headers から getHeader を作る (値は string | string[] がありうる) */
function nodeHeaderGetter(req: any): (name: string) => string | undefined {
  return (name: string) => {
    const v = req?.headers?.[name];
    if (Array.isArray(v)) return v[0];
    return typeof v === 'string' ? v : undefined;
  };
}

/**
 * カウンタ 1 本ぶんの判定 (テスト可能なコア)。
 * INCR → 初回は EXPIRE。EXPIRE が失敗して TTL 無しになったキーは、
 * 上限超過を最初に検知したタイミングで TTL を張り直して自己修復する。
 */
export async function consumeCounter(
  r: RateLimitRedis,
  key: string,
  maxRequests: number,
  windowSec: number,
): Promise<boolean> {
  const count = await r.incr(key);
  if (count === 1) {
    await r.expire(key, windowSec);
  } else if (count === maxRequests + 1) {
    const ttl = await r.ttl(key);
    if (ttl === -1) await r.expire(key, windowSec);
  }
  return count <= maxRequests;
}

export interface RateLimitOptions {
  /** バケット名。省略時 'global' (従来互換の全エンドポイント共有バケット) */
  scope?: string;
  /** scope 全体の合計上限 (IP と無関係)。分散アクセスでも総量を頭打ちにする */
  globalMax?: number;
}

/**
 * レート制限チェック（非同期）
 * @returns true = 許可, false = 制限超過
 */
export async function checkRateLimit(
  ip: string,
  maxRequests = 10,
  windowMs = 60_000,
  opts: RateLimitOptions = {},
): Promise<boolean> {
  // Redis未設定時はフェイルオープン（制限なしで通す）
  if (!redis) return true;

  const scope = opts.scope ?? 'global';
  const windowSec = Math.ceil(windowMs / 1000);
  try {
    const okIp = await consumeCounter(redis, `rate:${scope}:${ip}`, maxRequests, windowSec);
    if (!okIp) return false;
    if (opts.globalMax && opts.globalMax > 0) {
      return await consumeCounter(redis, `rate:g:${scope}`, opts.globalMax, windowSec);
    }
    return true;
  } catch {
    // Redis障害時はフェイルオープン
    return true;
  }
}

/**
 * Vercel API (Node) ハンドラーにレート制限を適用するヘルパー
 * @returns true = リクエスト続行OK, false = 429を返した（ハンドラーは即return）
 */
export async function applyRateLimit(
  req: any,
  res: any,
  maxRequests = 10,
  windowMs = 60_000,
  opts: RateLimitOptions = {},
): Promise<boolean> {
  let ip = resolveClientIp(nodeHeaderGetter(req));
  if (ip === 'unknown' && req.socket?.remoteAddress) ip = req.socket.remoteAddress;

  const allowed = await checkRateLimit(ip, maxRequests, windowMs, opts);
  if (!allowed) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }
  return true;
}

/**
 * Edge runtime (Web Request) 用。
 * @returns 429 Response (これをそのまま return する) or null (続行)
 */
export async function applyRateLimitWeb(
  req: Request,
  maxRequests = 10,
  windowMs = 60_000,
  opts: RateLimitOptions = {},
): Promise<Response | null> {
  const ip = resolveClientIp((name) => req.headers.get(name) ?? undefined);
  const allowed = await checkRateLimit(ip, maxRequests, windowMs, opts);
  if (!allowed) {
    return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }
  return null;
}
