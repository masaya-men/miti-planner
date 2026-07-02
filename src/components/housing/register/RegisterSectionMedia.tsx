import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HousingRegisterSnsUrlField,
  type YoutubeFetchedData,
  type OgpFetchedData,
} from './HousingRegisterSnsUrlField';
import { HousingRegisterImageField } from './HousingRegisterImageField';
import { HousingRegisterSourceImageUrlsField } from './HousingRegisterSourceImageUrlsField';
import { SkeletonCard } from '../workspace/SkeletonCard';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
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
 *   3 分岐判定 + URL 形式エラーのインライン表示は子が持つ)。
 * - **実 fetch (tweet/ogp) の取得状態は子から `onFetchStatusChange` で受け取る**。
 *   fetch を実際に走らせるのは子インスタンス 1 つだけなので、 別インスタンスの hook を
 *   ここで購読しても常に idle のまま (dead) になる。 そのため自前の useTweetFetch/useOgpFetch は
 *   持たず、 子が握る実 status を state に受けてセクション level の
 *   loading skeleton / 成功時の枚数 / 失敗時の静かな注記 を出す (spec:22)。
 *   子側のインライン fetch loading/error は `suppressInlineFetchStatus` で抑止し二重表示を避ける
 *   (成功時の枚数は sourceImageUrls.length を信頼源にする)。
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
  // 子が握る実 fetch 状態 (loading / errorKey)。子の onFetchStatusChange から受ける。
  const [fetchStatus, setFetchStatus] = useState<{ loading: boolean; errorKey: string | null }>({
    loading: false,
    errorKey: null,
  });
  const handleFetchStatusChange = useCallback(
    (next: { loading: boolean; errorKey: string | null }) => setFetchStatus(next),
    [],
  );

  const isLoading = fetchStatus.loading;
  const isError = !isLoading && fetchStatus.errorKey != null;
  const errorMessageKey = fetchStatus.errorKey;
  const fetchedImageCount = sourceImageUrls.length;
  // 成功表示は sourceImageUrls の有無で判定する (RegisterPage が OGP/Twitter 取得完了後に
  // 渡す props をそのまま信頼源にする。 fetch status は loading/error 判定にのみ使う)。
  const showSuccess = !isLoading && !isError && fetchedImageCount > 0;

  return (
    <section className="housing-register-section" data-testid="housing-register-section-media">
      <h2 className="housing-register-section-title">{t('housing.register.section_media')}</h2>

      <HousingRegisterSnsUrlField
        onTweetFetched={onTweetFetched}
        onYoutubeFetched={onYoutubeFetched ?? (() => {})}
        onOgpFetched={onOgpFetched}
        initialUrl={initialSnsUrl}
        onUrlUserEdit={onUrlUserEdit}
        onFetchStatusChange={handleFetchStatusChange}
        suppressInlineFetchStatus
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
