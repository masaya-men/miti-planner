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

describe('GET /api/og (URL リスト返却版、 2026-05-27)', () => {
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

    it('allowlist 通過 + HTML パース → URL リスト返却 (画像 fetch しない)', async () => {
        const html = `
            <meta property="og:image" content="https://cdn.x/a.jpg">
            <meta property="og:title" content="家">
            <meta property="og:site_name" content="Housing Snap">
        `;
        mockFetch.mockResolvedValueOnce(htmlResponse(html));

        const res = await handler(makeReq('https://thonhart.com/p/1'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.image).toBe('https://cdn.x/a.jpg');
        expect(body.title).toBe('家');
        expect(body.siteName).toBe('Housing Snap');
        expect(body.images).toEqual(['https://cdn.x/a.jpg']);
        // 画像本体は fetch しない (= HTML fetch の 1 回のみ)
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('og:image が無いと images は空配列', async () => {
        const html = `<meta property="og:title" content="No Image Page">`;
        mockFetch.mockResolvedValueOnce(htmlResponse(html));

        const res = await handler(makeReq('https://thonhart.com/p/1'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.image).toBeNull();
        expect(body.images).toEqual([]);
        expect(body.title).toBe('No Image Page');
    });

    it('og:image が private IP の場合は images から除外 (SSRF guard)', async () => {
        const html = `<meta property="og:image" content="https://10.0.0.5/img.jpg">`;
        mockFetch.mockResolvedValueOnce(htmlResponse(html));

        const res = await handler(makeReq('https://thonhart.com/p/1'));
        expect(res.status).toBe(200);
        const body = await res.json();
        // og:image meta は残るが、 isImageUrlSafe で弾かれて images には入らない
        expect(body.image).toBe('https://10.0.0.5/img.jpg');
        expect(body.images).toEqual([]);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('studio-xiv.com で og:image と extras がリサイズ違いの同一画像なら 1 件に dedup (hotfix29)', async () => {
        const html = `
            <meta property="og:image" content="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_a-1280x720-1.png?1779846852">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_a-320x320-1.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_a-1.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_b-1.png">
        `;
        mockFetch.mockResolvedValueOnce(htmlResponse(html));

        const res = await handler(makeReq('https://studio-xiv.com/studio/100/'));
        expect(res.status).toBe(200);
        const body = await res.json();
        // ffxiv_a の 3 つのリサイズ違い + cache buster は 1 件に dedup、 ffxiv_b は別 = 計 2 件
        expect(body.images).toHaveLength(2);
        // 採用される URL は normalize 後 (= 原寸 + cache buster 無し)
        expect(body.images[0]).toBe(
            'https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_a-1.png',
        );
        expect(body.images[1]).toBe(
            'https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_b-1.png',
        );
    });

    it('studio-xiv.com は ffxiv_ パターンを全部取得、 ロゴ等は除外', async () => {
        const html = `
            <meta property="og:image" content="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_main.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_b.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_c.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_d.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/site-logo.png">
        `;
        mockFetch.mockResolvedValueOnce(htmlResponse(html));

        const res = await handler(makeReq('https://studio-xiv.com/studio/100189/'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.images).toHaveLength(4);
        expect(body.images[0]).toContain('ffxiv_main');
        expect(body.images[3]).toContain('ffxiv_d');
        expect(body.images.some((u: string) => u.includes('site-logo'))).toBe(false);
    });

    it('housingsnap.com で 5 枚あれば 5 件返る', async () => {
        const html = `
            <meta property="og:image" content="https://assets.housingsnap.com/uploads/paragraph/image/1/aaa111_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/2/bbb222_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/3/ccc333_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/4/ddd444_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/5/eee555_watermark.jpg">
        `;
        mockFetch.mockResolvedValueOnce(htmlResponse(html));

        const res = await handler(makeReq('https://housingsnap.com/46775'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.images).toHaveLength(5);
        expect(body.images[0]).toContain('/1/aaa111_');
        expect(body.images[4]).toContain('/5/eee555_');
    });

    it('housingsnap.com で 13 枚あっても 12 件で打ち切り', async () => {
        const imgs = Array.from({ length: 13 }, (_, i) => {
            const id = i + 1;
            const hash = `aa${id.toString(16).padStart(4, '0')}bb`;
            return `<img src="https://assets.housingsnap.com/uploads/paragraph/image/${id}/${hash}_watermark.jpg">`;
        }).join('\n');
        const html = `<meta property="og:image" content="https://assets.housingsnap.com/uploads/paragraph/image/100/zzz999_watermark.jpg">${imgs}`;
        mockFetch.mockResolvedValueOnce(htmlResponse(html));

        const res = await handler(makeReq('https://housingsnap.com/x'));
        expect(res.status).toBe(200);
        const body = await res.json();
        // og:image (zzz999) + 追加 11 枚 = 計 12 件で打ち切り
        expect(body.images).toHaveLength(12);
        expect(body.images[0]).toContain('zzz999');
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
