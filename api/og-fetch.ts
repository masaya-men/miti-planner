// Vercel Edge Function — OGP 汎用取得 (URL リスト返却版、 2026-05-27 リライト)
//
// 目的:
// - ハウジング系参考サイト (housingsnap.com 等) の物件ページ URL を受け取り、
//   og:image / og:title / og:description / og:site_name と、 サイト別追加抽出した
//   画像 URL リストを JSON で返す。
// - **画像本体は fetch しない** (= LoPo の倉庫にコピーせず、 元サイトの CDN URL を
//   そのままクライアントに渡す)。 表示時は `<img src={外部URL}>` で直接読む方式。
// - SSRF 防御は allowlist 完全一致 + private IP 拒否 + redirect: 'manual' で多重。
//
// Phase 3 (Cloudflare 全面移行) で Cloudflare Workers にコピペ移植する想定で、
// Node.js 固有 API は使わず Web 標準 (Request/Response/fetch/URL/AbortSignal) のみ。

import { isOgpUrlAllowed } from '../src/lib/housing/ogpHostAllowlist.js';
import {
    parseOgpHtml,
    extractBodyText,
    extractHousingSnapImages,
    extractStudioXivImages,
    normalizeStudioXivUrl,
} from '../src/lib/housing/parseOgpHtml.js';

export const config = { runtime: 'edge' };

const HTML_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB (og:meta 行は header 付近にあるので十分)
const MAX_IMAGES_PER_RESPONSE = 12; // og:image + サイト別抽出を合わせて 12 URL まで
const MAX_BODY_TEXT_CHARS = 4000; // 本文テキストの打ち切り文字数 (住所行抽出に十分)

interface OgResponse {
    /** og:image の URL (= 1 枚目代表、 後方互換用)。 取得不可なら null。 */
    image: string | null;
    /** 全画像 URL (og:image + サイト別追加抽出)。 最大 MAX_IMAGES_PER_RESPONSE。 */
    images: string[];
    title: string | null;
    description: string | null;
    siteName: string | null;
    /**
     * ページ本文のプレーンテキスト (タグ除去、 ブロック境界で改行保持、 最大
     * MAX_BODY_TEXT_CHARS 字)。 住所行が og:description truncate に載らず本文 `<p>` に
     * しか無いページ対策。 解析はクライアント側で行う。 取れなければ null。
     */
    text: string | null;
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
        const parsedUrl = new URL(url);

        // 候補 URL リスト構築: og:image (= 1 枚目) + サイト別追加抽出。
        // og:image 自身は allowlist 外の CDN ホストでも構わない (== 静的画像なので SSRF リスク低)。
        // ただし protocol = https のみで hardening、 画像本体は fetch しない。
        //
        // dedup key は hostname 別 normalize 関数で生成 (hotfix29):
        // - studio-xiv: 同一画像のリサイズ違い (`-1280x720-1.png` / `-320x320-1.png` / `-1.png`) と
        //   cache buster (`?1779846852`) を一本化。 og:image が中サイズで extras が full size の
        //   ケースでも重複を排除し、 push 時は normalized URL (= full size) を採用して原寸表示。
        // - その他: URL 完全一致のみで dedup。
        const isStudioXiv = parsedUrl.hostname === 'studio-xiv.com';
        const normalizeForDedup = isStudioXiv ? normalizeStudioXivUrl : (u: string) => u;

        const images: string[] = [];
        const seen = new Set<string>();
        const tryAdd = (u: string | null) => {
            if (!u || !isImageUrlSafe(u)) return;
            const key = normalizeForDedup(u);
            if (seen.has(key)) return;
            seen.add(key);
            // studio-xiv は normalize 後の URL (= 原寸 + cache buster 無し) を採用、
            // それ以外は元 URL をそのまま push。
            images.push(isStudioXiv ? key : u);
        };
        tryAdd(meta.image);

        // hostname 別の専用抽出器で追加画像を拾う (1 物件あたり複数画像対応)。
        const extras =
            parsedUrl.hostname === 'housingsnap.com'
                ? extractHousingSnapImages(html)
                : isStudioXiv
                ? extractStudioXivImages(html)
                : [];
        for (const u of extras) {
            tryAdd(u);
            if (images.length >= MAX_IMAGES_PER_RESPONSE) break;
        }

        // 本文プレーンテキスト (住所行が og:description に載らないページ対策)。
        // 空文字列なら null に落とす (= 取れなかった扱い)。
        const bodyText = extractBodyText(html, MAX_BODY_TEXT_CHARS);

        const body: OgResponse = {
            image: meta.image,
            images: images.slice(0, MAX_IMAGES_PER_RESPONSE),
            title: meta.title,
            description: meta.description,
            siteName: meta.siteName,
            text: bodyText.length > 0 ? bodyText : null,
        };

        return Response.json(body, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                // 画像本体は fetch しないが、 ハウジング物件ページの og:meta は更新頻度低い。
                // Cloudflare 前段化のときに帯域 cache を再導入する方針で、 今は edge cache off。
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

/** og:image URL が「クライアントに返すのに安全」 か判定。 https + 非 private IP のみ。 */
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
