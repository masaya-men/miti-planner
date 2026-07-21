import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingEditImageGrid } from './HousingEditImageGrid';
import {
  HousingRegisterSnsUrlField,
  type YoutubeFetchedData,
  type OgpFetchedData,
} from '../register/HousingRegisterSnsUrlField';
import { deleteListingSourceImage, reorderListingSourceImages } from '../../../lib/housingApiClient';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import type { SnsCapture } from '../pages/RegisterPage';
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
  onCommitSnsFetch: (
    capture: SnsCapture,
    freshSourceImageUrls: string[],
  ) => Promise<{ ok: boolean; skipped?: boolean }>;
}

/**
 * 編集ページのURL経由側パネル (Plan B・2026-07-21)。
 * 「投稿URLを貼り替える」= 既存 HousingRegisterSnsUrlField をそのまま使い、取得成功のたびに
 * `onCommitSnsFetch` (RegisterPage 側で buildDraft()+updateListing を実行) を呼んで丸ごと
 * 差し替える。削除/並び替えは commit を経由せず deleteListingSourceImage/
 * reorderListingSourceImages を直接叩く (update-listing はフルドラフトが要るため重く、
 * 1件削除ごとに使うのは不適切)。
 */
export function HousingEditSourcePanel({
  listingId,
  sourceImageUrls,
  onSourceImageUrlsChange,
  videoPreview,
  onCommitSnsFetch,
}: HousingEditSourcePanelProps) {
  const { t } = useTranslation();
  const [committing, setCommitting] = useState(false);

  const commit = useCallback(
    async (capture: SnsCapture, freshUrls: string[]) => {
      setCommitting(true);
      try {
        const result = await onCommitSnsFetch(capture, freshUrls);
        if (!result.ok) {
          showToast(t('housing.register.editMedia.save_failed'), 'error');
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
      const photos = data.photos ?? [];
      commit({ tweetData: data, tweetSource: source, youtube: null, ogp: null }, photos.slice(0, 10));
    },
    [commit],
  );

  const handleYoutubeFetched = useCallback(
    (data: YoutubeFetchedData | null) => {
      if (!data) return;
      commit({ tweetData: null, tweetSource: null, youtube: data, ogp: null }, []);
    },
    [commit],
  );

  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) return;
      const images =
        data.data.images && data.data.images.length > 0
          ? data.data.images.slice(0, 10)
          : data.data.image
            ? [data.data.image]
            : [];
      commit({ tweetData: null, tweetSource: null, youtube: null, ogp: data }, images);
    },
    [commit],
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
      <HousingRegisterSnsUrlField
        onTweetFetched={handleTweetFetched}
        onYoutubeFetched={handleYoutubeFetched}
        onOgpFetched={handleOgpFetched}
      />
      {committing && (
        <p className="housing-register-image-status">{t('housing.register.image.compressing')}</p>
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
