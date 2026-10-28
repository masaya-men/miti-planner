import { useTranslation } from 'react-i18next';

interface EphemeralUrlFieldProps {
  url: string;
  handleUrlChange: (value: string) => void;
  fetching: boolean;
  fetchFailed: boolean;
  tweetStatus: string;
  youtubeStatus: string;
}

/** EphemeralAddPanel の URL 入力欄 (取得中表示・取得失敗の文言つき)。 */
export const EphemeralUrlField: React.FC<EphemeralUrlFieldProps> = ({
  url, handleUrlChange, fetching, fetchFailed, tweetStatus, youtubeStatus,
}) => {
  const { t } = useTranslation();
  return (
            <div className="housing-ephemeral-field">
              <label htmlFor="housing-ephemeral-url" className="housing-label">
                {t('housing.ephemeral.url_label')}
              </label>
              <input
                id="housing-ephemeral-url"
                type="url"
                className="housing-input"
                autoComplete="off"
                placeholder={t('housing.ephemeral.url_placeholder')}
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
              />
              {fetching && (
                <div className="housing-fetch-indicator">
                  <span className="housing-spinner" aria-hidden />
                  <span>
                    {t(
                      tweetStatus === 'loading'
                        ? 'housing.register.snsUrl.fetching'
                        : youtubeStatus === 'loading'
                          ? 'housing.register.snsUrl.youtube_fetching'
                          : 'housing.register.snsUrl.ogp_fetching',
                    )}
                  </span>
                </div>
              )}
              {fetchFailed && (
                <p className="housing-error-text">{t('housing.ephemeral.fetch_error')}</p>
              )}
            </div>
  );
};
