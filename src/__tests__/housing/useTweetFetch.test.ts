// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTweetFetch } from '../../lib/housing/useTweetFetch';

let mockFetch: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    mockFetch = vi.spyOn(globalThis, 'fetch');
});

describe('useTweetFetch', () => {
    it('initial state is idle', () => {
        const { result } = renderHook(() => useTweetFetch());
        expect(result.current.status).toBe('idle');
    });

    it('fetch sets status to loading then success', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    text: 'hello',
                    author: { name: 'A', screen_name: 'a' },
                    photos: [],
                    video: false,
                }),
                { status: 200 },
            ),
        );
        const { result } = renderHook(() => useTweetFetch());
        act(() => { result.current.fetchTweet('123'); });
        await waitFor(() => expect(result.current.status).toBe('success'));
        expect(result.current.data?.text).toBe('hello');
    });

    it('handles 404 error', async () => {
        mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }));
        const { result } = renderHook(() => useTweetFetch());
        act(() => { result.current.fetchTweet('123'); });
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current.errorCode).toBe('notFound');
    });

    it('cancel aborts in-flight request', async () => {
        mockFetch.mockImplementationOnce(
            () => new Promise<Response>(() => {}),
        );
        const { result } = renderHook(() => useTweetFetch());
        act(() => { result.current.fetchTweet('123'); });
        act(() => { result.current.cancel(); });
        expect(result.current.status).toBe('idle');
    });
});
