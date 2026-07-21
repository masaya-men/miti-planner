import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { YoutubeFetchedData, OgpFetchedData } from './HousingRegisterSnsUrlField';
import { HousingRegisterMultiUrlField } from './HousingRegisterMultiUrlField';
import { HousingRegisterImageField, SAVED_IMAGES_LIMIT } from './HousingRegisterImageField';
import { HousingRegisterSourceImageUrlsField } from './HousingRegisterSourceImageUrlsField';
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
   * オートセーブ復元時に SNS URL 欄へ流し込む初期 URL (Task14 fix)。
   * 2026-07-21 (Batch2 Task7) 時点の既知の制限: `HousingRegisterMultiUrlField` はこの prop を
   * 内部の `HousingRegisterSnsUrlField` インスタンスへ転送しないため (Task5 実装、本タスクのスコープ外)、
   * 現状は呼び出し元 (RegisterPage.tsx) との型互換のためだけに残しており、実際の URL 欄復元・
   * 再取得トリガーには使われない。オートセーブ復元で「SNS URL の再取得」までは戻らなくなった
   * (住所/タイトル等の他フィールド復元には影響しない)。是非は docs/TODO.md に記録し、
   * 別タスクで `HousingRegisterMultiUrlField` 側に initialUrl 転送 (1本目の欄限定) を足すか検討する。
   */
  initialSnsUrl?: string;
  /** ユーザーが URL 欄を手入力した時に発火。上記と同じ理由で現状未使用。 */
  onUrlUserEdit?: () => void;
  /**
   * 動画ツイート取得時の video ペイロード (`{url, posterUrl, aspectRatio}`)。存在すれば
   * poster 画像 1 枚 + 「動画あり」バッジを最小プレビューとして描画する。動画のみツイート
   * (静止画ゼロ) でも「メディア取得済み」と分かるようにするため。<video> は CSP img-src の
   * 対象外 (media-src) で直参照できないため、poster (pbs.twimg.com・img-src 許可済み) を出す。
   * YouTube/OGP では null (親が snsCapture.tweetData?.video を渡すため)。
   */
  tweetVideo?: TweetData['video'];
  /** 2026-07-21 追加 (Batch2): 複数URL欄の制御 (現在の欄数・追加・削除)。 */
  urlSlotCount: number;
  onAddUrlSlot: () => void;
  onRemoveUrlSlot: (index: number) => void;
}

/**
 * 登録フォーム中央カラム: 画像/SNS URL セクション (Task11、Batch2 Task7 で URL優先UIに刷新)。
 *
 * - SNS URL 入力は複数欄対応の `HousingRegisterMultiUrlField` (Task5) 経由で
 *   `HousingRegisterSnsUrlField` を流用する。各欄は `suppressInlineFetchStatus={false}` で
 *   自分の取得中/エラー状態をインライン表示する (欄が複数になったことで「どの欄の状態か」が
 *   曖昧になるため、Task6 以前のセクション level 集約表示は廃止した)。
 * - 直接アップロードは既定で折りたたみ、「画像をアップロードして登録する」リンクを押すと展開する
 *   (URL優先UI: URLでの登録を第一導線にする)。
 * - 画像リストは既存 `HousingRegisterImageField` (ローカルアップロード) /
 *   `HousingRegisterSourceImageUrlsField` (SNS 取得 URL) をそのまま流用。
 */
export const RegisterSectionMedia: React.FC<Props> = ({
  onTweetFetched,
  onYoutubeFetched,
  onOgpFetched,
  localImages,
  onLocalImagesChange,
  sourceImageUrls,
  onSourceImageUrlsChange,
  tweetVideo,
  urlSlotCount,
  onAddUrlSlot,
  onRemoveUrlSlot,
}) => {
  const { t } = useTranslation();
  const [uploadExpanded, setUploadExpanded] = useState(false);

  // 取得済み枚数の表示は sourceImageUrls の有無で判定する (複数 URL 欄の合算結果を
  // RegisterPage が集約して渡す props をそのまま信頼源にする)。
  const fetchedImageCount = sourceImageUrls.length;
  const showSuccess = fetchedImageCount > 0;

  return (
    <section className="housing-register-section" data-testid="housing-register-section-media">
      <h2 className="housing-register-section-title">{t('housing.register.section_media')}</h2>
      <p className="housing-register-image-limit-note">
        {t('housing.register.media.limit_note')}
      </p>

      <HousingRegisterMultiUrlField
        slotCount={urlSlotCount}
        onAddSlot={onAddUrlSlot}
        onRemoveSlot={onRemoveUrlSlot}
        onTweetFetched={onTweetFetched}
        onYoutubeFetched={onYoutubeFetched ?? (() => {})}
        onOgpFetched={onOgpFetched}
      />

      {showSuccess && (
        <p className="housing-register-media-success-note" data-testid="housing-register-media-success">
          {t('housing.register.media.fetched_count', { count: fetchedImageCount })}
        </p>
      )}

      {/* 動画ツイートの最小プレビュー: poster 1 枚 + 「動画あり」バッジ。静止画ゼロの動画のみ
          ツイートでも「メディア取得済み」と分かるようにする (confirmSummary も動画を +1 で数える)。
          YouTube/OGP では親が null を渡すため誤発火しない。 */}
      {tweetVideo && (
        <div className="housing-register-media-video" data-testid="housing-register-media-video">
          <img
            src={tweetVideo.posterUrl}
            alt=""
            className="housing-register-media-video-poster"
            loading="lazy"
          />
          <span className="housing-register-media-video-badge">
            {t('housing.register.media.video_badge')}
          </span>
        </div>
      )}

      <HousingRegisterSourceImageUrlsField
        value={sourceImageUrls}
        onChange={onSourceImageUrlsChange}
        maxImages={10}
      />

      {!uploadExpanded ? (
        <button
          type="button"
          data-testid="housing-register-toggle-upload"
          className="housing-register-toggle-upload"
          onClick={() => setUploadExpanded(true)}
        >
          {t('housing.register.media.expand_upload')}
        </button>
      ) : (
        <div data-testid="housing-register-image-field">
          <p className="housing-register-upload-warning">
            {t('housing.register.media.upload_warning')}
          </p>
          <HousingRegisterImageField
            value={localImages}
            onChange={onLocalImagesChange}
            hasSnsUrl={sourceImageUrls.length > 0}
            maxImages={SAVED_IMAGES_LIMIT}
          />
        </div>
      )}
    </section>
  );
};
