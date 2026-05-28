import { useState, useCallback, useRef } from 'react';
import type { TweetVideoPayload } from './tweetMetaExtract';

export type TweetData = {
    text: string;
    author: { name: string; screen_name: string };
    photos: string[];
    photoAspectRatios?: (number | null)[];
    /**
     * 動画ありなら mp4 URL + poster URL + aspectRatio。 静止画 or なしなら null。
     * 2026-05-26 拡張: 旧仕様は boolean のみ。 useTweetVideoFrames から
     * `/api/tweet-video?url=<url>` を叩いて 3 フレーム抽出する。
     */
    video: TweetVideoPayload | null;
};

export type TweetFetchStatus = 'idle' | 'loading' | 'success' | 'error';
export type TweetFetchErrorCode =
    | 'invalid'
    | 'notFound'
    | 'rateLimit'
    | 'upstream'
    | 'network';

export function useTweetFetch() {
    const [status, setStatus] = useState<TweetFetchStatus>('idle');
    const [data, setData] = useState<TweetData | null>(null);
    const [errorCode, setErrorCode] = useState<TweetFetchErrorCode | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        setStatus('idle');
    }, []);

    const fetchTweet = useCallback(async (tweetId: string) => {
        controllerRef.current?.abort();
        const ctrl = new AbortController();
        controllerRef.current = ctrl;
        setStatus('loading');
        setData(null);
        setErrorCode(null);
        try {
            const res = await fetch(`/api/tweet-meta?id=${encodeURIComponent(tweetId)}`, {
                signal: ctrl.signal,
            });
            if (ctrl.signal.aborted) return;
            if (res.status === 404) {
                setErrorCode('notFound');
                setStatus('error');
                return;
            }
            if (res.status === 429) {
                setErrorCode('rateLimit');
                setStatus('error');
                return;
            }
            if (!res.ok) {
                setErrorCode('upstream');
                setStatus('error');
                return;
            }
            const json = (await res.json()) as TweetData;
            setData(json);
            setStatus('success');
        } catch (e: unknown) {
            const err = e as { name?: string };
            if (err?.name === 'AbortError') return;
            setErrorCode('network');
            setStatus('error');
        }
    }, []);

    const reset = useCallback(() => {
        cancel();
        setData(null);
        setErrorCode(null);
        setStatus('idle');
    }, [cancel]);

    return { status, data, errorCode, fetchTweet, cancel, reset };
}
