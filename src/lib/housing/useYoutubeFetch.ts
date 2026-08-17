import { useState, useCallback, useRef } from 'react';

export interface YoutubeMetaData {
    description: string | null;
}

export type YoutubeFetchStatus = 'idle' | 'loading' | 'success';

/**
 * YouTube 概要欄取得 hook (useTweetFetch/useOgpFetch と同系統)。
 *
 * 概要欄取得はベストエフォートの補助機能 (サムネイル添付はこれに依存しない) のため、
 * useTweetFetch/useOgpFetch と違い status='error' を一切公開しない。API 呼び出しが
 * 何らかの理由で失敗しても description:null の success として扱い、呼び出し元
 * (RegisterPage/EphemeralAddPanel) は「description があるかないか」だけを見ればよい
 * (設計書 2026-08-17「失敗時の扱い」参照)。
 */
export function useYoutubeFetch() {
    const [status, setStatus] = useState<YoutubeFetchStatus>('idle');
    const [data, setData] = useState<YoutubeMetaData | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        setStatus('idle');
    }, []);

    const fetchYoutubeMeta = useCallback(async (videoId: string) => {
        controllerRef.current?.abort();
        const ctrl = new AbortController();
        controllerRef.current = ctrl;
        setStatus('loading');
        setData(null);
        try {
            const res = await fetch(`/api/youtube-meta?videoId=${encodeURIComponent(videoId)}`, {
                signal: ctrl.signal,
            });
            if (ctrl.signal.aborted) return;
            if (!res.ok) {
                setData({ description: null });
                setStatus('success');
                return;
            }
            const json = (await res.json()) as YoutubeMetaData;
            setData({ description: json.description ?? null });
            setStatus('success');
        } catch (e: unknown) {
            const err = e as { name?: string };
            if (err?.name === 'AbortError') return;
            setData({ description: null });
            setStatus('success');
        }
    }, []);

    const reset = useCallback(() => {
        cancel();
        setData(null);
        setStatus('idle');
    }, [cancel]);

    return { status, data, fetchYoutubeMeta, cancel, reset };
}
