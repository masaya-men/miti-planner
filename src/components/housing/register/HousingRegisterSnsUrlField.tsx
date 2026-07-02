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
    /**
     * 2026-07-02 追加 (Task14 fix): オートセーブ復元時に保存済み SNS URL を復元して
     * 画像を実再取得するための optional prop。マウント時に一度だけ、非空なら内部の
     * handleChange(initialUrl) を発火し、URL 欄を可視化 + 種別判定 (Twitter/YouTube/OGP)
     * → fetch → onTweetFetched/onYoutubeFetched/onOgpFetched パイプラインを走らせる。
     * 未指定 (旧 HousingRegisterForm/HousingRegisterView 等) は従来どおり空 URL 開始で無影響。
     */
    initialUrl?: string;
    /**
     * 2026-07-02 追加 (Task14 fix): ユーザーが URL 入力欄を実際に手入力/貼り付けた時にだけ発火する。
     * initialUrl 由来のプログラム的 handleChange (復元再取得) では呼ばれない。親は復元 guard の解除
     * (以降の再取得は全フィールド上書きに戻す) に使う。未指定なら無影響 (optional)。
     */
    onUrlUserEdit?: () => void;
};

export function HousingRegisterSnsUrlField({
    onTweetFetched,
    onYoutubeFetched,
    onOgpFetched,
    initialUrl,
    onUrlUserEdit,
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

    // オートセーブ復元時 (initialUrl 非空) にマウント一度だけ handleChange を発火し、URL 欄復元 +
    // 種別判定→fetch を再実行する (spec:120)。復元起因の再取得であることは親側の ref で判定するため
    // ここでは通常の URL 貼付と同じパイプラインを流すだけ。initialUrl は初期復元専用で、以降の
    // ユーザー入力には介入しない (依存を空にして再発火を防ぐ)。
    const initialUrlAppliedRef = useRef(false);
    useEffect(() => {
        if (initialUrlAppliedRef.current) return;
        initialUrlAppliedRef.current = true;
        if (initialUrl && initialUrl.trim()) {
            handleChange(initialUrl);
        }
        // マウント時一度だけ。handleChange は安定 (fieldState 由来の不安定さは親側)。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                onChange={(e) => {
                    onUrlUserEdit?.();
                    handleChange(e.target.value);
                }}
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
