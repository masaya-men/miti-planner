// Vercel Edge Function — OGP 汎用取得 (2026-05-27 新設、 B: housingsnap 等 4 サイト対応)
//
// 目的:
// - ハウジング系参考サイト (housingsnap.com 等) の物件ページ URL を受け取り、
//   og:image / og:title / og:description / og:site_name を JSON で返す。
// - og:image は同時に server 側で fetch して base64 化して同梱
//   (= クライアントは別途リモートに繋がず、 dataUrlToCompressedImage 経路で
//    localImages に push 可能 → Storage 経由で thumbnailPaths に乗る)。
// - SSRF 防御は allowlist 完全一致 + private IP 拒否 + redirect: 'manual' で多重。
//
// Phase 3 (Cloudflare 全面移行) で Cloudflare Workers にコピペ移植する想定で、
// Node.js 固有 API は使わず Web 標準 (Request/Response/fetch/URL/AbortSignal) のみ。

import { isOgpUrlAllowed } from '../src/lib/housing/ogpHostAllowlist.js';
import { parseOgpHtml } from '../src/lib/housing/parseOgpHtml.js';

export const config = { runtime: 'edge' };

const HTML_TIMEOUT_MS = 8_000;
const IMAGE_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB (= og:meta 行は header 付近にあるので十分)
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB

interface OgResponse {
    image: string | null;
    imageBase64: string | null;
    imageMimeType: string | null;
    title: string | null;
    description: string | null;
    siteName: string | null;
}

export default async function handler(req: Request): Promise<Response> {
    // CORS preflight (将来 cross-origin 経由で叩かれた場合の安全策)
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    const url = new URL(req.url).searchParams.get('url');
    if (!url) {
        return Response.json({ error: 'url query param is required' }, { status: 400 });
    }
    if (!isOgpUrlAllowed(url)) {
        // SSRF guard: allowlist 外 / protocol 不正 / private IP のいずれかで 403
        return Response.json(
            { error: 'host not in allowlist or URL not safe' },
            { status: 403 },
        );
    }

    try {
        const html = await fetchHtml(url);
        if (html === null) {
            return Response.json({ error: 'failed to fetch HTML' }, { status: 502 });
        }

        const meta = parseOgpHtml(html, url);

        // og:image を server 側で fetch して base64 化 (CSP 拡張不要にする目的)。
        // og:image 自身は allowlist 外の CDN ホストでも構わない (== 静的画像なので SSRF リスク低)。
        // ただし protocol = https のみ、 redirect 追跡しない、 サイズ制限の 3 点で hardening。
        let imageBase64: string | null = null;
        let imageMimeType: string | null = null;
        if (meta.image && isImageUrlSafe(meta.image)) {
            const fetched = await fetchImageAsBase64(meta.image);
            if (fetched) {
                imageBase64 = fetched.base64;
                imageMimeType = fetched.mimeType;
            }
        }

        const body: OgResponse = {
            image: meta.image,
            imageBase64,
            imageMimeType,
            title: meta.title,
            description: meta.description,
            siteName: meta.siteName,
        };

        return Response.json(body, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                // 動画 proxy と同じく edge cache off で出す
                // (= ハウジング物件ページは更新頻度低いが、 Range Vary 等の罠を避け、
                //  Cloudflare 前段化のときに帯域 cache を再導入する方針)
                'Cache-Control': 'private, max-age=0, must-revalidate',
            },
        });
    } catch (e: unknown) {
        const err = e as { name?: string };
        if (err?.name === 'TimeoutError') {
            return Response.json({ error: 'Upstream timeout' }, { status: 504 });
        }
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** allowlist 通過した URL の HTML を fetch する。 redirect 追跡しない (= SSRF + 無限ループ防御)。 */
async function fetchHtml(url: string): Promise<string | null> {
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LoPo/1.0)',
            Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(HTML_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    // ストリーミングで読み、 MAX_HTML_BYTES に達したら打ち切る (DoS 防御)
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder('utf-8');
    let total = 0;
    let html = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_HTML_BYTES) {
            try {
                await reader.cancel();
            } catch {
                /* noop */
            }
            break;
        }
        html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    return html;
}

/** og:image URL が「画像 fetch するのに安全」 か判定。 https + 非 private IP のみ。 */
function isImageUrlSafe(url: string): boolean {
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return false;
        // IPv4 リテラルが private/loopback なら拒否 (host allowlist と同じガード)
        const ipv4 = u.hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipv4) {
            const a = Number(ipv4[1]);
            const b = Number(ipv4[2]);
            if (
                a === 10 ||
                a === 127 ||
                (a === 169 && b === 254) ||
                (a === 172 && b >= 16 && b <= 31) ||
                (a === 192 && b === 168) ||
                a === 0
            ) {
                return false;
            }
        }
        return true;
    } catch {
        return false;
    }
}

/** og:image URL を fetch して base64 + mimeType を返す。 サイズ超過は null。 */
async function fetchImageAsBase64(
    url: string,
): Promise<{ base64: string; mimeType: string } | null> {
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LoPo/1.0)' },
            redirect: 'manual',
            signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const mimeType = res.headers.get('content-type')?.split(';')[0].trim() ?? 'image/jpeg';
        if (!mimeType.startsWith('image/')) return null;

        const reader = res.body?.getReader();
        if (!reader) return null;
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > MAX_IMAGE_BYTES) {
                try {
                    await reader.cancel();
                } catch {
                    /* noop */
                }
                return null;
            }
            chunks.push(value);
        }
        const concatenated = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
            concatenated.set(c, offset);
            offset += c.byteLength;
        }
        // Uint8Array → base64 (Web 標準 btoa は ASCII 文字列のみなので String.fromCharCode 経由)
        let binary = '';
        for (let i = 0; i < concatenated.byteLength; i++) {
            binary += String.fromCharCode(concatenated[i]);
        }
        const base64 = btoa(binary);
        return { base64, mimeType };
    } catch {
        return null;
    }
}
