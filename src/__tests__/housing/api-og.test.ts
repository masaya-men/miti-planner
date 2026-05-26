import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../api/og';

const mockFetch = vi.spyOn(globalThis, 'fetch');

function makeReq(url: string | null): Request {
    const u = new URL('http://localhost/api/og');
    if (url !== null) u.searchParams.set('url', url);
    return new Request(u);
}

function htmlResponse(html: string): Response {
    return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}

function imageResponse(bytes: Uint8Array, mimeType = 'image/jpeg'): Response {
    // Node 20+ の TS lib では Uint8Array<ArrayBufferLike> が BlobPart に直接適合しないため
    // ArrayBuffer に slice してから渡す (= 元の SharedArrayBuffer の可能性を排除)。
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return new Response(new Blob([buf as ArrayBuffer], { type: mimeType }), {
        status: 200,
        headers: { 'content-type': mimeType },
    });
}

describe('GET /api/og', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('url パラメータ無しは 400', async () => {
        const res = await handler(makeReq(null));
        expect(res.status).toBe(400);
    });

    it('allowlist 外 host は 403 (SSRF guard)', async () => {
        const res = await handler(makeReq('https://evil.example.com/x'));
        expect(res.status).toBe(403);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('http (非 https) は 403', async () => {
        const res = await handler(makeReq('http://housingsnap.com/x'));
        expect(res.status).toBe(403);
    });

    it('IP リテラルの allowlist 外は 403', async () => {
        const res = await handler(makeReq('https://169.254.169.254/latest/meta-data'));
        expect(res.status).toBe(403);
    });

    it('allowlist 通過 + HTML + 画像取得が動く', async () => {
        const html = `
            <meta property="og:image" content="https://cdn.x/a.jpg">
            <meta property="og:title" content="家">
            <meta property="og:site_name" content="Housing Snap">
        `;
        const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic
        mockFetch
            .mockResolvedValueOnce(htmlResponse(html))
            .mockResolvedValueOnce(imageResponse(imageBytes, 'image/jpeg'));

        const res = await handler(makeReq('https://thonhart.com/p/1'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.image).toBe('https://cdn.x/a.jpg');
        expect(body.title).toBe('家');
        expect(body.siteName).toBe('Housing Snap');
        expect(body.images).toEqual([
            {
                sourceUrl: 'https://cdn.x/a.jpg',
                base64: '/9j/4A==',
                mimeType: 'image/jpeg',
            },
        ]);
    });

    it('og:image が無いと images も空配列', async () => {
        const html = `<meta property="og:title" content="No Image Page">`;
        mockFetch.mockResolvedValueOnce(htmlResponse(html));

        const res = await handler(makeReq('https://thonhart.com/p/1'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.image).toBeNull();
        expect(body.images).toEqual([]);
        expect(body.title).toBe('No Image Page');
    });

    it('og:image が private IP の場合は画像取得スキップ', async () => {
        const html = `<meta property="og:image" content="https://10.0.0.5/img.jpg">`;
        mockFetch.mockResolvedValueOnce(htmlResponse(html));

        const res = await handler(makeReq('https://thonhart.com/p/1'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.image).toBe('https://10.0.0.5/img.jpg');
        expect(body.images).toEqual([]); // SSRF guard で 2 回目 fetch しない
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('housingsnap.com では追加画像も最大 4 枚まで取得', async () => {
        const html = `
            <meta property="og:image" content="https://assets.housingsnap.com/uploads/paragraph/image/1/aaa111_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/2/bbb222_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/3/ccc333_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/4/ddd444_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/5/eee555_watermark.jpg">
        `;
        const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
        mockFetch
            .mockResolvedValueOnce(htmlResponse(html))
            .mockResolvedValueOnce(imageResponse(bytes))
            .mockResolvedValueOnce(imageResponse(bytes))
            .mockResolvedValueOnce(imageResponse(bytes))
            .mockResolvedValueOnce(imageResponse(bytes));

        const res = await handler(makeReq('https://housingsnap.com/46775'));
        expect(res.status).toBe(200);
        const body = await res.json();
        // og:image + 追加 3 枚 = 計 4 枚 (max)。 5 枚目は捨てる
        expect(body.images).toHaveLength(4);
        expect(body.images[0].sourceUrl).toContain('/1/aaa111_');
        expect(body.images[1].sourceUrl).toContain('/2/bbb222_');
        expect(body.images[2].sourceUrl).toContain('/3/ccc333_');
        expect(body.images[3].sourceUrl).toContain('/4/ddd444_');
    });

    it('upstream HTML fetch 失敗で 502', async () => {
        mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }));
        const res = await handler(makeReq('https://housingsnap.com/x'));
        expect(res.status).toBe(502);
    });

    it('OPTIONS preflight は 204 + CORS ヘッダー', async () => {
        const u = new URL('http://localhost/api/og');
        u.searchParams.set('url', 'https://housingsnap.com/x');
        const req = new Request(u, { method: 'OPTIONS' });
        const res = await handler(req);
        expect(res.status).toBe(204);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
});
