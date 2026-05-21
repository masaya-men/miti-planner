// Vercel Edge Function — syndication CDN プロキシ
// X (旧 Twitter) のツイート ID を受け取り、 cdn.syndication.twimg.com に
// 問い合わせて本文・著者・メディア有無を返す。 LoPo の housing 登録モーダルで
// SNS URL → 自動入力 機能が使う。
//
// Phase 3 (Cloudflare 全面移行) で Cloudflare Workers にコピペ移植する想定で、
// Node.js 固有 API は使わず Web 標準 (Request/Response/fetch/URL/AbortSignal) のみ。

import { syndicationUrl } from '../src/lib/housing/tweetSyndication';

export const config = { runtime: 'edge' };

const TWEET_ID_REGEX = /^\d{1,20}$/;
const TIMEOUT_MS = 10_000;

export default async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id || !TWEET_ID_REGEX.test(id)) {
        return Response.json({ error: 'Invalid tweet ID' }, { status: 400 });
    }

    // syndication CDN の URL/token 生成は共有モジュールに集約 (cron/purge と同一ロジック)
    const syndUrl = syndicationUrl(id);

    try {
        const res = await fetch(syndUrl, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { 'User-Agent': 'LoPo Housing Tour' },
        });

        if (res.status === 404) {
            return Response.json({ error: 'Tweet not found or private' }, { status: 404 });
        }
        if (!res.ok) {
            return Response.json({ error: 'Upstream error' }, { status: 502 });
        }

        const json = await res.json();
        return Response.json(
            {
                text: json.text ?? '',
                author: {
                    name: json.user?.name ?? '',
                    screen_name: json.user?.screen_name ?? '',
                },
                photos: Array.isArray(json.photos)
                    ? json.photos
                        .map((p: unknown) => (p as { url?: unknown })?.url)
                        .filter((u: unknown): u is string => typeof u === 'string')
                    : [],
                video: Boolean(json.video),
            },
            {
                headers: {
                    'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
                },
            },
        );
    } catch (e: unknown) {
        const err = e as { name?: string };
        if (err?.name === 'TimeoutError') {
            return Response.json({ error: 'Upstream timeout' }, { status: 504 });
        }
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}
