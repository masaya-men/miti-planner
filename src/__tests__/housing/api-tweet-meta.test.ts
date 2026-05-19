import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../api/tweet-meta';

const mockFetch = vi.spyOn(globalThis, 'fetch');

function makeReq(id: string | null): Request {
    const u = new URL('http://localhost/api/tweet-meta');
    if (id !== null) u.searchParams.set('id', id);
    return new Request(u);
}

describe('GET /api/tweet-meta', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('returns 400 for missing id', async () => {
        const res = await handler(makeReq(null));
        expect(res.status).toBe(400);
    });

    it('returns 400 for non-numeric id', async () => {
        const res = await handler(makeReq('abc'));
        expect(res.status).toBe(400);
    });

    it('returns 400 for id longer than 20 digits', async () => {
        const res = await handler(makeReq('123456789012345678901'));
        expect(res.status).toBe(400);
    });

    it('returns syndication data on success', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    text: 'Mana\nAnima\nShirogane | 6-6 | Small',
                    user: { name: 'Test User', screen_name: 'testuser' },
                    photos: [{ url: 'https://pbs.twimg.com/a.jpg' }],
                    video: { id: 'v1' },
                }),
                { status: 200 },
            ),
        );
        const res = await handler(makeReq('1842217368673759498'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.text).toContain('Shirogane');
        expect(body.author.name).toBe('Test User');
        expect(body.author.screen_name).toBe('testuser');
        expect(body.photos).toEqual(['https://pbs.twimg.com/a.jpg']);
        expect(body.video).toBe(true);
    });

    it('returns 404 when syndication returns 404', async () => {
        mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }));
        const res = await handler(makeReq('1234567890'));
        expect(res.status).toBe(404);
    });

    it('returns 502 when syndication returns 500', async () => {
        mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }));
        const res = await handler(makeReq('1234567890'));
        expect(res.status).toBe(502);
    });

    it('returns 504 on AbortError (timeout)', async () => {
        mockFetch.mockRejectedValueOnce(
            Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
        );
        const res = await handler(makeReq('1234567890'));
        expect(res.status).toBe(504);
    });
});
