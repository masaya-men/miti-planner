// Vercel Edge Function — syndication CDN プロキシ
// X (旧 Twitter) のツイート ID を受け取り、 cdn.syndication.twimg.com に
// 問い合わせて本文・著者・メディア有無を返す。 LoPo の housing 登録モーダルで
// SNS URL → 自動入力 機能が使う。
//
// 2026-05-26 拡張: 動画ツイートの mp4 URL + poster + aspectRatio も返す。
// クライアント側の useTweetVideoFrames が /api/tweet-video 経由でフレーム抽出するため、
// ここで mediaDetails.video_info.variants から最高 bitrate mp4 を選別する。
//
// Phase 3 (Cloudflare 全面移行) で Cloudflare Workers にコピペ移植する想定で、
// Node.js 固有 API は使わず Web 標準 (Request/Response/fetch/URL/AbortSignal) のみ。

import { syndicationUrl } from '../src/lib/housing/tweetSyndication.js';
import {
    extractTweetMediaPayload,
    type SyndicationRaw,
} from '../src/lib/housing/tweetMetaExtract.js';
import { applyRateLimitWeb } from '../src/lib/rateLimit.js';
import { rejectIfPublicApiDisabledWeb } from '../src/lib/publicApiGuard.js';

export const config = { runtime: 'edge' };

const TWEET_ID_REGEX = /^\d{1,20}$/;
const TIMEOUT_MS = 10_000;

export default async function handler(req: Request): Promise<Response> {
    const disabled = rejectIfPublicApiDisabledWeb();
    if (disabled) return disabled;
    // s-maxage=3600 があるので、ここに来るのはキャッシュ MISS のみ。
    // 探す一覧のカードが並行で呼ぶ場合があるため 60/分と緩めにする。
    const limited = await applyRateLimitWeb(req, 60, 60_000, { scope: 'tweet-meta', globalMax: 600 });
    if (limited) return limited;

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

        const json = (await res.json()) as SyndicationRaw;
        const media = extractTweetMediaPayload(json);

        return Response.json(
            {
                text: json.text ?? '',
                author: {
                    name: json.user?.name ?? '',
                    screen_name: json.user?.screen_name ?? '',
                },
                photos: media.photos,
                photoAspectRatios: media.photoAspectRatios,
                video: media.video,
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
