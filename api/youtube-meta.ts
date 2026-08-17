// api/youtube-meta.ts
// Vercel Edge Function — YouTube Data API v3 プロキシ
//
// YouTube 動画 ID を受け取り、概要欄テキスト (snippet.description) だけを返す。
// LoPo の housing 登録ページ/一時ツアー追加パネルの SNS URL → 自動入力機能が使う。
// tweet-meta.ts と同じ理由 (App Check 不要な匿名アクセス窓口が必要・Vercel Hobby の
// Node関数12個上限を避ける) で独立 Edge Function にする。
//
// 概要欄取得はベストエフォート: 動画が存在しない/非公開/APIキー未設定/クォータ超過/
// タイムアウトのいずれでも常に 200 + { description: null } を返す (呼び出し元はサムネイル
// 添付を続行するため、エラーを伝播させる必要がない)。

import { applyRateLimitWeb } from '../src/lib/rateLimit.js';
import { rejectIfPublicApiDisabledWeb } from '../src/lib/publicApiGuard.js';

export const config = { runtime: 'edge' };

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const TIMEOUT_MS = 10_000;

export default async function handler(req: Request): Promise<Response> {
  const disabled = rejectIfPublicApiDisabledWeb();
  if (disabled) return disabled;
  const limited = await applyRateLimitWeb(req, 60, 60_000, { scope: 'youtube-meta', globalMax: 600 });
  if (limited) return limited;

  const url = new URL(req.url);
  const videoId = url.searchParams.get('videoId');
  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    return Response.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({ description: null });
  }

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${apiKey}`;

  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      return Response.json({ description: null });
    }
    const json = (await res.json()) as { items?: Array<{ snippet?: { description?: string } }> };
    const description = json.items?.[0]?.snippet?.description;
    if (!description) {
      return Response.json({ description: null });
    }
    return Response.json(
      { description },
      { headers: { 'Cache-Control': 's-maxage=3600, max-age=3600, stale-while-revalidate=86400' } },
    );
  } catch {
    return Response.json({ description: null });
  }
}
