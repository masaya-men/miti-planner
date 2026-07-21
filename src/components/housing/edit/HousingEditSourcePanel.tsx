import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingEditImageGrid } from './HousingEditImageGrid';
import type { YoutubeFetchedData, OgpFetchedData } from '../register/HousingRegisterSnsUrlField';
import { HousingRegisterMultiUrlField } from '../register/HousingRegisterMultiUrlField';
import { deleteListingSourceImage, reorderListingSourceImages } from '../../../lib/housingApiClient';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import { EMPTY_SNS_CAPTURE, mergeTweetPhotoAspectRatios, type SnsCapture } from '../pages/RegisterPage';
import { isDuplicatePostUrl, shouldRejectIncomingVideo } from '../../../lib/housing/multiSourceGuards';
import { showToast } from '../../Toast';

export interface EditVideoPreview {
  url: string;
  posterUrl: string;
  aspectRatio?: number;
}

export interface HousingEditSourcePanelProps {
  listingId: string;
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  videoPreview: EditVideoPreview | null;
  /** 2026-07-21 追加 (Batch2): 貼った投稿URLの一覧 (重複検出に使う)。 */
  sourcePostUrls: string[];
  onCommitSnsFetch: (
    capture: SnsCapture,
    freshSourceImageUrls: string[],
    nextPostUrl: string,
  ) => Promise<{ ok: boolean; skipped?: boolean }>;
}

/**
 * 編集ページのURL経由側パネル (Plan B・2026-07-21 → Batch2・2026-07-22 で「貼り替え=全差し替え」
 * から「追加 (既存+新規の累積)」へ統一)。
 *
 * RegisterPage.tsx の handleTweetFetched/handleYoutubeFetched/handleOgpFetched (Task6/7 で複数URL
 * 集約バグを潰した「実戦済み」実装) と全く同じマージアルゴリズムを、編集ページの
 * 「1回の貼付けごとに即座に commit する」アーキテクチャに合わせて局所的に再現する。
 *
 * captureRef (代表の種別・識別情報) だけをこのコンポーネント内に保持し、写真配列そのもの
 * (tweetData.photos として送る内容) は毎回 **必ず現在の sourceImageUrls prop から組み直す**
 * (キャッシュしない)。理由: HousingEditImageGrid 経由の削除/並び替えは commit を経由せず
 * deleteListingSourceImage/reorderListingSourceImages を直接呼ぶため、もし過去の commit で
 * 送った写真配列をここでキャッシュしてしまうと、削除済みの画像が次の URL 貼付けで
 * 「復活」してしまう (sourceImageUrls prop が唯一の正)。
 *
 * サーバーに既に保存済みの代表種別 (このパネルを開く前) はここからは判別できないため、
 * captureRef による代表種別トラッキングは「このセッション内で複数の異なる種類のURLを
 * 貼った場合の競合検出」にのみ使う。この境界を越える組み合わせ (例: 編集を開く前から
 * OGP 由来の画像が保存されており、開いた直後に動画付きツイートを貼る) はサーバー側
 * validateImage が invalid_url で明示的に (サイレントではなく) 拒否する。
 */
export function HousingEditSourcePanel({
  listingId,
  sourceImageUrls,
  onSourceImageUrlsChange,
  videoPreview,
  sourcePostUrls,
  onCommitSnsFetch,
}: HousingEditSourcePanelProps) {
  const { t } = useTranslation();
  const [committing, setCommitting] = useState(false);
  const [urlSlotCount, setUrlSlotCount] = useState(1);

  const captureRef = useRef<SnsCapture>(EMPTY_SNS_CAPTURE);
  /** 動画を確定済みか (videoPreview prop の非同期更新を待たずに同期判定するための補助)。 */
  const capturedVideoRef = useRef(false);

  const commit = useCallback(
    async (nextCapture: SnsCapture, freshUrls: string[], nextPostUrl: string) => {
      setCommitting(true);
      try {
        const result = await onCommitSnsFetch(nextCapture, freshUrls, nextPostUrl);
        if (!result.ok) {
          showToast(t('housing.register.editMedia.save_failed'), 'error');
        } else {
          captureRef.current = nextCapture;
        }
      } catch {
        showToast(t('housing.register.editMedia.save_failed'), 'error');
      } finally {
        setCommitting(false);
      }
    },
    [onCommitSnsFetch, t],
  );

  const handleTweetFetched = useCallback(
    (data: TweetData, source: { postUrl: string; tweetId: string } | null) => {
      if (!source) return;
      if (isDuplicatePostUrl(sourcePostUrls, source.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      const capture = captureRef.current;
      const photos = data.photos ?? [];

      // 代表が既に YouTube (このセッション内) の場合、静止画は conflict_sources 制約により
      // 追加できない (buildDraftImageFields の YouTube 分岐は写真を一切見ないため、受理すると
      // 保存時に消える)。
      const representativeIsYoutube = !!capture.youtube;
      if (representativeIsYoutube && photos.length > 0) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        return;
      }

      const incomingHasVideo = !!data.video?.url;
      const hasRepresentative = !!(capture.tweetData || capture.youtube || capture.ogp);
      const representativeCanHostVideo = !hasRepresentative || !!capture.tweetData;
      const existingVideoLimit = shouldRejectIncomingVideo(
        capturedVideoRef.current || !!videoPreview,
        incomingHasVideo,
      );
      // 代表が YouTube/OGP (tweetData を持たない) で確定していて、この動画を添付する tweetData
      // が存在しない場合は「受理したのに保存先が無く消える」事故になるため拒否する
      // (RegisterPage.tsx handleTweetFetched の orphanVideo と同型)。
      const orphanVideo = incomingHasVideo && !existingVideoLimit && !representativeCanHostVideo;
      const rejectVideo = existingVideoLimit || orphanVideo;
      if (rejectVideo) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
      }

      const freshSourceImageUrls = photos.length > 0 ? [...sourceImageUrls, ...photos] : sourceImageUrls;
      const adoptsVideo = !rejectVideo && incomingHasVideo && !capture.tweetData?.video;
      const becomesTwitterRepresentative =
        !!capture.tweetData || (!hasRepresentative && (photos.length > 0 || adoptsVideo));

      if (!becomesTwitterRepresentative) {
        // テキストのみのツイート (代表未確立・写真も動画も無し)、または代表が既に
        // YouTube/OGP で確定していて今回の Twitter 由来の写真/動画がどちらも対象外だった
        // 場合は、代表の識別情報を変更しない。何も変化がないなら commit 自体もスキップする。
        if (freshSourceImageUrls === sourceImageUrls) return;
        commit(capture, freshSourceImageUrls, source.postUrl);
        return;
      }

      // Twitter 代表として持つ写真は「常に現在のギャラリー (sourceImageUrls, 手動削除/並び替え
      // 済みの最新state) + 今回の追記分」から組む (capture 側に古い photos 配列をキャッシュ
      // しないことで、削除/並び替え後に再度貼っても削除済み画像が復活しない)。代表の
      // tweetSource (postUrl/tweetId) は最初に確立したURLのものを維持する (RegisterPage.tsx と
      // 同じ「代表は最初の1件が正」の設計)。
      const nextCapture: SnsCapture = {
        tweetData: {
          ...data,
          photos: freshSourceImageUrls,
          photoAspectRatios: mergeTweetPhotoAspectRatios(
            undefined,
            sourceImageUrls.length,
            data.photoAspectRatios,
            photos.length,
          ),
          video: capture.tweetData?.video ?? (adoptsVideo ? data.video : null),
        },
        tweetSource: capture.tweetData ? capture.tweetSource! : source,
        youtube: null,
        ogp: null,
      };
      if (incomingHasVideo && !rejectVideo) capturedVideoRef.current = true;
      commit(nextCapture, freshSourceImageUrls, source.postUrl);
    },
    [commit, sourceImageUrls, sourcePostUrls, videoPreview, t],
  );

  const handleYoutubeFetched = useCallback(
    (data: YoutubeFetchedData | null) => {
      if (!data) return;
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      // YouTube は静止画・動画のどちらとも排他 (conflict_sources 制約)。既に何か捕捉済み
      // (このセッション内の動画/写真、または編集を開く前からの既存データ) ならこの
      // YouTube URL は追加不可として拒否する。
      if (capturedVideoRef.current || !!videoPreview || sourceImageUrls.length > 0) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        return;
      }
      capturedVideoRef.current = true;
      commit({ tweetData: null, tweetSource: null, youtube: data, ogp: null }, [], data.postUrl);
    },
    [commit, sourceImageUrls.length, sourcePostUrls, videoPreview, t],
  );

  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) return;
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      const capture = captureRef.current;
      const images =
        data.data.images && data.data.images.length > 0
          ? data.data.images
          : data.data.image
            ? [data.data.image]
            : [];
      // 代表が Twitter (tweetData) の場合、OGP 画像 (任意ホスト) を混ぜると tweetId 併用時の
      // pbs.twimg.com host 制約 (housingValidation.ts:413) に抵触し登録全体が失敗するため拒否
      // する。代表が YouTube の場合も画像は一切追加できない (conflict_sources)。
      // どちらも「受理したのに保存先が無く消える」事故を避けるため、マージせず拒否する
      // (RegisterPage.tsx handleOgpFetched と同型)。
      if (images.length > 0) {
        if (capture.tweetData) {
          showToast(t('housing.register.snsUrl.error.photo_source_conflict'), 'error');
          return;
        }
        if (capture.youtube) {
          showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
          return;
        }
      }
      const freshSourceImageUrls = images.length > 0 ? [...sourceImageUrls, ...images] : sourceImageUrls;
      // 代表が既に OGP で確定している場合は識別情報 (postUrl/ogImageUrl) を最初の1件のまま
      // 維持し、新規に画像を持たない OGP ページを代表として誤って確立しない
      // (postUrl の誤帰属を避ける)。
      const nextCapture: SnsCapture =
        images.length > 0 && !capture.ogp
          ? { tweetData: null, tweetSource: null, youtube: null, ogp: data }
          : capture;
      if (nextCapture === capture && freshSourceImageUrls === sourceImageUrls) return;
      commit(nextCapture, freshSourceImageUrls, data.postUrl);
    },
    [commit, sourceImageUrls, sourcePostUrls, t],
  );

  const handleDelete = useCallback(
    (index: number) => deleteListingSourceImage({ listingId, index }).then((r) => r.sourceImageUrls),
    [listingId],
  );
  const handleReorder = useCallback(
    (newOrder: string[]) => reorderListingSourceImages({ listingId, newOrder }).then((r) => r.sourceImageUrls),
    [listingId],
  );

  return (
    <div className="housing-register-image-field">
      <p className="housing-register-image-limit-note">{t('housing.register.media.limit_note')}</p>
      <HousingRegisterMultiUrlField
        slotCount={urlSlotCount}
        onAddSlot={() => setUrlSlotCount((prev) => Math.min(5, prev + 1))}
        onRemoveSlot={() => setUrlSlotCount((prev) => Math.max(1, prev - 1))}
        onTweetFetched={handleTweetFetched}
        onYoutubeFetched={handleYoutubeFetched}
        onOgpFetched={handleOgpFetched}
      />
      {committing && (
        <p className="housing-register-image-status">{t('housing.register.editMedia.saving')}</p>
      )}
      {videoPreview && (
        <div className="housing-register-media-video" data-testid="housing-register-media-video">
          <img
            src={videoPreview.posterUrl}
            alt=""
            className="housing-register-media-video-poster"
            loading="lazy"
          />
          <span className="housing-register-media-video-badge">
            {t('housing.register.media.video_badge')}
          </span>
        </div>
      )}
      <HousingEditImageGrid
        images={sourceImageUrls}
        onImagesChange={onSourceImageUrlsChange}
        onDelete={handleDelete}
        onReorder={handleReorder}
        minImages={1}
      />
    </div>
  );
}
