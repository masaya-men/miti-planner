import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { parseTweetUrl } from '../../../lib/housing/tweetUrlParse';
import { useTweetFetch, type TweetData } from '../../../lib/housing/useTweetFetch';

type Props = {
    onTweetFetched: (
        data: TweetData,
        source: { postUrl: string; tweetId: string } | null,
    ) => void;
};

export function HousingRegisterSnsUrlField({ onTweetFetched }: Props) {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [invalidUrl, setInvalidUrl] = useState(false);
    const { status, data, errorCode, fetchTweet, cancel, reset } = useTweetFetch();
    // 取得結果 (data オブジェクト) ごとに 1 回だけ親へ渡す。
    // 親の fieldState が毎レンダリングで identity を変えるため onTweetFetched も毎回変わり、
    // ガードしないとこの effect が再発火して自動入力を再適用→ユーザー編集 (区=17 等) を巻き戻す。
    const dispatchedDataRef = useRef<TweetData | null>(null);

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

    const handleChange = useCallback((value: string) => {
        setUrl(value);
        if (!value.trim()) {
            setInvalidUrl(false);
            reset();
            return;
        }
        const id = parseTweetUrl(value);
        if (!id) {
            setInvalidUrl(true);
            return;
        }
        setInvalidUrl(false);
        fetchTweet(id);
    }, [fetchTweet, reset]);

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
        </div>
    );
}
