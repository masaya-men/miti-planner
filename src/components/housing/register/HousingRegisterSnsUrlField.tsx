import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { parseTweetUrl } from '../../../lib/housing/tweetUrlParse';
import { useTweetFetch, type TweetData } from '../../../lib/housing/useTweetFetch';
import { parseYoutubeUrl, buildYoutubeThumbnailUrl } from '../../../lib/housing/youtubeUrl';
import { useOgpFetch, type OgpData } from '../../../lib/housing/useOgpFetch';
import { isOgpUrlAllowed } from '../../../lib/housing/ogpHostAllowlist';

export interface YoutubeFetchedData {
    postUrl: string;
    ogImageUrl: string;
    videoId: string;
}

export interface OgpFetchedData {
    postUrl: string;
    data: OgpData;
}

type Props = {
    onTweetFetched: (
        data: TweetData,
        source: { postUrl: string; tweetId: string } | null,
    ) => void;
    /**
     * 2026-05-26 追加: YouTube URL が入力された場合に親に通知する。
     * Twitter の fetchTweet とは排他 (どちらか一方の状態のみ active)。
     * null は「YouTube state クリア」 (URL が空になった or Twitter に切替) を意味する。
     */
    onYoutubeFetched: (data: YoutubeFetchedData | null) => void;
    /**
     * 2026-05-27 追加 (B): allowlist 内 OGP URL のとき親に OgpData を通知。
     * null は「OGP state クリア」 (URL が空・別形式に切替・失敗) を意味する。
     */
    onOgpFetched: (data: OgpFetchedData | null) => void;
};

export function HousingRegisterSnsUrlField({
    onTweetFetched,
    onYoutubeFetched,
    onOgpFetched,
}: Props) {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [invalidUrl, setInvalidUrl] = useState(false);
    // 内部の YouTube 取得状態は親が握る (onYoutubeFetched で通知)、 子側では setter のみ使う。
    const [, setYoutubeData] = useState<YoutubeFetchedData | null>(null);
    const { status, data, errorCode, fetchTweet, cancel, reset } = useTweetFetch();
    const {
        status: ogpStatus,
        data: ogpData,
        errorCode: ogpErrorCode,
        fetchOgp,
        reset: resetOgp,
    } = useOgpFetch();
    // 取得結果 (data オブジェクト) ごとに 1 回だけ親へ渡す。
    // 親の fieldState が毎レンダリングで identity を変えるため onTweetFetched も毎回変わり、
    // ガードしないとこの effect が再発火して自動入力を再適用→ユーザー編集 (区=17 等) を巻き戻す。
    const dispatchedDataRef = useRef<TweetData | null>(null);
    const dispatchedOgpRef = useRef<OgpData | null>(null);

    useEffect(() => {
        if (status !== 'success' || !data) return;
        if (dispatchedDataRef.current === data) return; // 同じ取得結果は二度渡さない
        dispatchedDataRef.current = data;
        const tweetId = parseTweetUrl(url);
        onTweetFetched(
            data,
            tweetId ? { postUrl: url.trim(), tweetId } : null,
        );
    }, [status, data, onTweetFetched, url]);

    // OGP 取得成功時に親へ通知 (Twitter と同じ「1 result = 1 dispatch」 ガード)。
    useEffect(() => {
        if (ogpStatus !== 'success' || !ogpData) return;
        if (dispatchedOgpRef.current === ogpData) return;
        dispatchedOgpRef.current = ogpData;
        onOgpFetched({ postUrl: url.trim(), data: ogpData });
    }, [ogpStatus, ogpData, onOgpFetched, url]);

    const handleChange = useCallback((value: string) => {
        setUrl(value);
        if (!value.trim()) {
            setInvalidUrl(false);
            reset();
            resetOgp();
            setYoutubeData(null);
            onYoutubeFetched(null);
            onOgpFetched(null);
            return;
        }
        // 2026-05-26: YouTube を先に判定 (Twitter の syndication API が走る前に確定)。
        const ytId = parseYoutubeUrl(value);
        if (ytId) {
            setInvalidUrl(false);
            reset();
            resetOgp();
            onOgpFetched(null);
            const yt: YoutubeFetchedData = {
                postUrl: value.trim(),
                ogImageUrl: buildYoutubeThumbnailUrl(ytId),
                videoId: ytId,
            };
            setYoutubeData(yt);
            onYoutubeFetched(yt);
            return;
        }
        // Twitter 判定
        const id = parseTweetUrl(value);
        if (id) {
            setInvalidUrl(false);
            setYoutubeData(null);
            onYoutubeFetched(null);
            resetOgp();
            onOgpFetched(null);
            fetchTweet(id);
            return;
        }
        // 2026-05-27 (B): OGP allowlist 判定 (housingsnap 等)
        if (isOgpUrlAllowed(value.trim())) {
            setInvalidUrl(false);
            reset();
            setYoutubeData(null);
            onYoutubeFetched(null);
            dispatchedOgpRef.current = null; // 別 URL → 再 dispatch を許す
            fetchOgp(value.trim());
            return;
        }
        // どれにも該当しない URL
        setInvalidUrl(true);
        setYoutubeData(null);
        onYoutubeFetched(null);
        resetOgp();
        onOgpFetched(null);
    }, [fetchTweet, reset, fetchOgp, resetOgp, onYoutubeFetched, onOgpFetched]);

    return (
        <div className="housing-register-sns-url-field">
            <label htmlFor="housing-sns-url" className="housing-label">
                {t('housing.register.snsUrl.label')}
            </label>
            <input
                id="housing-sns-url"
                type="url"
                className="housing-input"
                placeholder={t('housing.register.snsUrl.placeholder')}
                value={url}
                onChange={(e) => handleChange(e.target.value)}
            />
            {invalidUrl && (
                <p className="housing-error-text">
                    {t('housing.register.snsUrl.error.invalid')}
                </p>
            )}
            {status === 'loading' && (
                <div className="housing-fetch-indicator">
                    <span className="housing-spinner" aria-hidden />
                    <span>{t('housing.register.snsUrl.fetching')}</span>
                    <button type="button" onClick={cancel}>
                        {t('housing.register.snsUrl.cancel')}
                    </button>
                </div>
            )}
            {status === 'error' && errorCode && (
                <div className="housing-error-block">
                    <p className="housing-error-text">
                        {t(`housing.register.snsUrl.error.${errorCode}`)}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            const id = parseTweetUrl(url);
                            if (id) fetchTweet(id);
                        }}
                    >
                        {t('housing.register.snsUrl.retry')}
                    </button>
                </div>
            )}
            {ogpStatus === 'loading' && (
                <div className="housing-fetch-indicator">
                    <span className="housing-spinner" aria-hidden />
                    <span>{t('housing.register.snsUrl.ogp_fetching')}</span>
                </div>
            )}
            {ogpStatus === 'error' && ogpErrorCode && (
                <div className="housing-error-block">
                    <p className="housing-error-text">
                        {t(`housing.register.snsUrl.ogp_error.${ogpErrorCode}`)}
                    </p>
                    <button
                        type="button"
                        onClick={() => fetchOgp(url.trim())}
                    >
                        {t('housing.register.snsUrl.retry')}
                    </button>
                </div>
            )}
        </div>
    );
}
