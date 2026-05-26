// Vercel Edge Function — Twitter 動画 CDN プロキシ (2026-05-26 新設)
//
// 目的:
// - `video.twimg.com` はブラウザの Referer/Origin/Sec-Fetch-Site を gate し、
//   `lopoly.app` から直接 <video src="https://video.twimg.com/..."> しても
//   load 前に拒否される。 サーバー間 fetch (= Vercel Edge から発火) は Referer/Origin
//   を含まないので CDN がそのままバイト列を返す。
// - `extractVideoFrames` は canvas.toDataURL() を呼ぶため、 video.src は必ず
//   **同一 origin** でなければならない (tainted canvas で throw する)。
//   つまり本プロキシ経由が前提。
//
// 設計判断:
// - allowlist (`video.twimg.com` のみ) で open proxy 化を防ぐ。
// - Range ヘッダー透過で HTML5 video の seek (= フレーム抽出時の currentTime=) を有効化。
// - Cache-Control 1 日 (ツイートの mp4 URL は tweet 寿命中安定)。
// - 既存 api/tweet-meta.ts と同じ Vercel Edge runtime + Web 標準のみ (Cloudflare 移行可)。

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = new Set<string>(['video.twimg.com']);
const TIMEOUT_MS = 30_000;

export default async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url).searchParams.get('url');
    if (!url) {
        return Response.json({ error: 'url query param is required' }, { status: 400 });
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return Response.json({ error: 'invalid url' }, { status: 400 });
    }
    if (parsed.protocol !== 'https:') {
        return Response.json({ error: 'only https upstream allowed' }, { status: 400 });
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
        return Response.json({ error: 'upstream host not allowed' }, { status: 403 });
    }

    const upstreamHeaders: Record<string, string> = {
        'User-Agent': 'LoPo Housing Tour',
    };
    const range = req.headers.get('range');
    if (range) upstreamHeaders.Range = range;

    try {
        const upstream = await fetch(parsed.toString(), {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            headers: upstreamHeaders,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!upstream.ok && upstream.status !== 206) {
            return Response.json(
                { error: `upstream ${upstream.status}` },
                { status: upstream.status === 404 ? 404 : 502 },
            );
        }

        const responseHeaders = new Headers();
        for (const h of [
            'content-type',
            'content-length',
            'content-range',
            'accept-ranges',
            'last-modified',
            'etag',
        ]) {
            const v = upstream.headers.get(h);
            if (v) responseHeaders.set(h, v);
        }
        // CORS ヘッダーは extractVideoFrames が video.crossOrigin='anonymous' を
        // 設定する都合で必須 (= 同一 origin でも anonymous モードは CORS check 発動)。
        // Access-Control-Allow-Origin が欠けると video.error → 抽出失敗で poster fallback。
        // (2026-05-26 hotfix17: hotfix16 移植時の漏れ。 Allmarks 元コードには元から有り)
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set(
            'Access-Control-Expose-Headers',
            'Content-Length, Content-Range, Accept-Ranges',
        );
        responseHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');

        return new Response(upstream.body, {
            status: upstream.status,
            headers: responseHeaders,
        });
    } catch (e: unknown) {
        const err = e as { name?: string };
        if (err?.name === 'TimeoutError') {
            return Response.json({ error: 'Upstream timeout' }, { status: 504 });
        }
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}
