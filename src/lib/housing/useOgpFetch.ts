import { useState, useCallback, useRef } from 'react';

/**
 * 汎用 OGP 取得 hook (2026-05-27 新設、 B: housingsnap 等 4 サイト対応)。
 *
 * /api/og?url=<allowlist 内 URL> を叩いて、 OGP メタデータ + og:image base64 を取得。
 * useTweetFetch / useYoutubeFetch と並ぶ「URL → 物件画像」 経路の 3 つ目。
 */

export interface OgpImagePayload {
    sourceUrl: string;
    base64: string;
    mimeType: string;
}

export interface OgpData {
    /** og:image URL (= 1 枚目の出典 URL、 後方互換用)。 取得不可なら null。 */
    image: string | null;
    /**
     * 全画像 (og:image + サイト別追加抽出) を base64 で同梱。 最大 4 枚。
     * housingsnap.com なら 1 物件 1-4 枚、 他のサイトは og:image の 1 枚のみ。
     */
    images: OgpImagePayload[];
    title: string | null;
    description: string | null;
    siteName: string | null;
}

export type OgpFetchStatus = 'idle' | 'loading' | 'success' | 'error';
export type OgpFetchErrorCode = 'invalid' | 'forbidden' | 'notFound' | 'upstream' | 'network';

export function useOgpFetch() {
    const [status, setStatus] = useState<OgpFetchStatus>('idle');
    const [data, setData] = useState<OgpData | null>(null);
    const [errorCode, setErrorCode] = useState<OgpFetchErrorCode | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        setStatus('idle');
    }, []);

    const fetchOgp = useCallback(async (url: string) => {
        controllerRef.current?.abort();
        const ctrl = new AbortController();
        controllerRef.current = ctrl;
        setStatus('loading');
        setData(null);
        setErrorCode(null);
        try {
            const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`, {
                signal: ctrl.signal,
            });
            if (ctrl.signal.aborted) return;
            if (res.status === 400) {
                setErrorCode('invalid');
                setStatus('error');
                return;
            }
            if (res.status === 403) {
                setErrorCode('forbidden');
                setStatus('error');
                return;
            }
            if (res.status === 404) {
                setErrorCode('notFound');
                setStatus('error');
                return;
            }
            if (!res.ok) {
                setErrorCode('upstream');
                setStatus('error');
                return;
            }
            const json = (await res.json()) as OgpData;
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

    return { status, data, errorCode, fetchOgp, cancel, reset };
}
