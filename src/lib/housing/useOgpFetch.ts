import { useState, useCallback, useRef } from 'react';

/**
 * 汎用 OGP 取得 hook (2026-05-27 リライト、 URL 直接表示版)。
 *
 * /api/og-fetch?url=<allowlist 内 URL> を叩いて、 OGP メタデータ + 画像 URL リストを取得。
 * (注: /api/og は共有プランの OGP 画像生成器が使うため、 ハウジング取得器は /api/og-fetch に分離。)
 * **画像本体は LoPo の倉庫にコピーせず、 元サイトの URL をそのまま `<img src>` で読む**
 * (= 投稿削除で自動消失、 LoPo 帯域消費ゼロ)。
 * useTweetFetch / useYoutubeFetch と並ぶ「URL → 物件画像」 経路の 3 つ目。
 */

export interface OgpData {
    /** og:image URL (= 1 枚目代表、 後方互換用)。 取得不可なら null。 */
    image: string | null;
    /**
     * 全画像 URL (og:image + サイト別追加抽出)。 最大 12 件。
     * housingsnap.com / studio-xiv.com なら 1 物件 1-12 枚、 他のサイトは og:image の 1 枚のみ。
     * 登録時に先頭 10 件に絞る (HousingRegisterForm 側、 2026-05-27 4→10 拡大)。
     */
    images: string[];
    title: string | null;
    description: string | null;
    siteName: string | null;
    /**
     * ページ本文のプレーンテキスト (タグ除去、 ブロック境界で改行保持、 最大 4000 字)。
     * 住所行が og:description の truncate に載らず本文にしか無いページ対策。 住所解析は
     * クライアント側 (parseHousingFromText) が担当する。 取れなければ null。
     */
    text: string | null;
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
            const res = await fetch(`/api/og-fetch?url=${encodeURIComponent(url)}`, {
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
            // text が無い旧デプロイのレスポンスでも落ちないよう null に落とす。
            setData({ ...json, text: json.text ?? null });
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
