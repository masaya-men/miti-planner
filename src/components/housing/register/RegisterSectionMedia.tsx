import { useTranslation } from 'react-i18next';
import {
  HousingRegisterSnsUrlField,
  type YoutubeFetchedData,
  type OgpFetchedData,
} from './HousingRegisterSnsUrlField';
import { HousingRegisterImageField } from './HousingRegisterImageField';
import { HousingRegisterSourceImageUrlsField } from './HousingRegisterSourceImageUrlsField';
import { SkeletonCard } from '../workspace/SkeletonCard';
import { useTweetFetch, type TweetData } from '../../../lib/housing/useTweetFetch';
import { useOgpFetch } from '../../../lib/housing/useOgpFetch';
import type { CompressedImage } from '../../../lib/housing/imageCompression';

interface Props {
  onTweetFetched: (
    data: TweetData,
    source: { postUrl: string; tweetId: string } | null,
  ) => void;
  onYoutubeFetched?: (data: YoutubeFetchedData | null) => void;
  onOgpFetched: (data: OgpFetchedData | null) => void;
  localImages: CompressedImage[];
  onLocalImagesChange: (value: CompressedImage[]) => void;
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  /**
   * オートセーブ復元時に SNS URL 欄へ流し込む初期 URL (Task14 fix)。非空なら
   * HousingRegisterSnsUrlField がマウント時に一度だけ再取得を発火する。未指定なら無影響。
   */
  initialSnsUrl?: string;
  /** ユーザーが URL 欄を手入力した時に発火 (復元 guard 解除用、Task14 fix)。 */
  onUrlUserEdit?: () => void;
}

/**
 * 登録フォーム中央カラム: 画像/SNS URL セクション (Task11)。
 *
 * - SNS URL 入力は既存 `HousingRegisterSnsUrlField` をそのまま流用 (Twitter/YouTube/OGP の
 *   3 分岐判定 + URL 単位のインライン loading/error は既にこのコンポーネントが持つ)。
 * - 本コンポーネントは `useTweetFetch`/`useOgpFetch` を並行して購読し、 セクション全体の
 *   取得状態 (loading skeleton / 成功時の枚数 / 失敗時の静かな注記) を上位表示として追加する。
 *   フックの内部 state はモジュール単位で共有されるため、 HousingRegisterSnsUrlField 側の
 *   fetch 実行がここにも反映される。
 * - 画像リストは既存 `HousingRegisterImageField` (ローカルアップロード) /
 *   `HousingRegisterSourceImageUrlsField` (SNS 取得 URL) をそのまま流用 (props 形状が
 *   そのまま適合するため adapt 不要と判断)。
 */
export const RegisterSectionMedia: React.FC<Props> = ({
  onTweetFetched,
  onYoutubeFetched,
  onOgpFetched,
  localImages,
  onLocalImagesChange,
  sourceImageUrls,
  onSourceImageUrlsChange,
  initialSnsUrl,
  onUrlUserEdit,
}) => {
  const { t } = useTranslation();
  const tweet = useTweetFetch();
  const ogp = useOgpFetch();

  const isLoading = tweet.status === 'loading' || ogp.status === 'loading';
  const isError = tweet.status === 'error' || ogp.status === 'error';
  const fetchedImageCount = sourceImageUrls.length;
  // 成功表示は sourceImageUrls の有無で判定する (RegisterPage が OGP/Twitter 取得完了後に
  // 渡す props をそのまま信頼源にする。 hook の status 自体は loading/error 判定にのみ使う)。
  const showSuccess = !isLoading && !isError && fetchedImageCount > 0;

  const errorMessageKey = tweet.status === 'error' && tweet.errorCode
    ? `housing.register.snsUrl.error.${tweet.errorCode}`
    : ogp.status === 'error' && ogp.errorCode
      ? `housing.register.snsUrl.ogp_error.${ogp.errorCode}`
      : null;

  return (
    <section className="housing-register-section" data-testid="housing-register-section-media">
      <h2 className="housing-register-section-title">{t('housing.register.section_media')}</h2>

      <HousingRegisterSnsUrlField
        onTweetFetched={onTweetFetched}
        onYoutubeFetched={onYoutubeFetched ?? (() => {})}
        onOgpFetched={onOgpFetched}
        initialUrl={initialSnsUrl}
        onUrlUserEdit={onUrlUserEdit}
      />

      {isLoading && (
        <div className="housing-register-media-skeleton-row" data-testid="housing-register-media-loading" aria-hidden="true">
          <SkeletonCard variant="right-panel" />
          <SkeletonCard variant="right-panel" />
          <SkeletonCard variant="right-panel" />
        </div>
      )}

      {showSuccess && (
        <p className="housing-register-media-success-note" data-testid="housing-register-media-success">
          {t('housing.register.media.fetched_count', { count: fetchedImageCount })}
        </p>
      )}

      {isError && errorMessageKey && (
        <div className="housing-register-media-quiet-notice" data-testid="housing-register-media-error">
          <p className="housing-register-media-quiet-notice-text">{t(errorMessageKey)}</p>
          <p className="housing-register-media-quiet-notice-hint">
            {t('housing.register.media.error_hint')}
          </p>
        </div>
      )}

      <HousingRegisterSourceImageUrlsField
        value={sourceImageUrls}
        onChange={onSourceImageUrlsChange}
        maxImages={10}
      />

      <HousingRegisterImageField
        value={localImages}
        onChange={onLocalImagesChange}
        hasSnsUrl={sourceImageUrls.length > 0}
        maxImages={12}
      />
    </section>
  );
};
