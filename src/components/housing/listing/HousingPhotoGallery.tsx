/**
 * Phase 3 + 2026-05-26 multi-image 対応 + 2026-05-27 外部 URL fallback: 物件詳細の写真ギャラリー
 *
 * - thumbnailPaths があれば配列を表示 (1 枚目はメイン、 2 枚目以降はサムネ列で切替)
 * - thumbnailPaths がなければ thumbnailPath / ogImageUrl / sourceImageUrls にフォールバック
 * - imageMode='sns' で sourceImageUrls 配列があれば外部 URL を `<img src>` 直接表示
 * - **404 等で読めない外部 URL は onError で自動非表示** (元投稿が削除された場合の自然消失)
 * - 全画像読めなければ「No image」 プレースホルダ
 */
import { useState, useMemo, useCallback, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '../../../types/housing';
import {
  handleYoutubeThumbnailError,
  handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';

export interface HousingPhotoGalleryProps {
  listing: HousingListing;
}

/**
 * listing から画像 URL の配列を取り出す。
 * - imageMode==='thumbnail': thumbnailPaths を優先、 なければ thumbnailPath を 1 件
 * - imageMode==='sns':
 *   - sourceImageUrls (OGP 経由の外部 URL リスト) があれば配列で切替表示
 *   - なければ ogImageUrl 1 件 (Twitter / YouTube / 旧データ後方互換)
 * - その他: []
 */
function resolveSources(listing: HousingListing): string[] {
  if (listing.imageMode === 'thumbnail') {
    if (Array.isArray(listing.thumbnailPaths) && listing.thumbnailPaths.length > 0) {
      return listing.thumbnailPaths.filter((s) => typeof s === 'string' && s !== '');
    }
    if (listing.thumbnailPath) return [listing.thumbnailPath];
    return [];
  }
  if (listing.imageMode === 'sns') {
    if (Array.isArray(listing.sourceImageUrls) && listing.sourceImageUrls.length > 0) {
      return listing.sourceImageUrls.filter((s) => typeof s === 'string' && s !== '');
    }
    if (listing.ogImageUrl) return [listing.ogImageUrl];
    return [];
  }
  return [];
}

export const HousingPhotoGallery: React.FC<HousingPhotoGalleryProps> = ({ listing }) => {
  const { t } = useTranslation();
  const sources = useMemo(() => resolveSources(listing), [listing]);
  const [activeIndex, setActiveIndex] = useState(0);
  /**
   * 読み込み失敗した元 URL の集合。 YouTube fallback で src を書き換えても駄目だった
   * 画像、 OGP 経由の外部 URL が 404 で消えた画像などを記録する。 元 URL 単位で記録するので、
   * YouTube サムネの maxres→hq→mq→default の途中段階では markFailed しない。
   */
  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());

  const markFailed = useCallback((src: string) => {
    setFailedSources((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  /**
   * `onError` ハンドラ。 まず YouTube サムネの段階的 fallback を試し、 それでも src が
   * 書き換わらなければ「最終的に表示不可」 として markFailed → 親 filter で非表示にする。
   */
  const handleImgError = useCallback(
    (originalSrc: string) =>
      (e: SyntheticEvent<HTMLImageElement>) => {
        const before = e.currentTarget.src;
        handleYoutubeThumbnailError(e);
        if (e.currentTarget.src === before) markFailed(originalSrc);
      },
    [markFailed],
  );

  const visibleSources = useMemo(
    () => sources.filter((s) => !failedSources.has(s)),
    [sources, failedSources],
  );

  // 2026-05-27: 動画あり listing は ギャラリー最上段に再生領域 (controls あり)。
  const hasVideo = !!(listing.videoUrl || listing.youtubeVideoId);
  const videoAspectStyle = listing.videoAspectRatio
    ? { aspectRatio: String(listing.videoAspectRatio) }
    : undefined;

  if (visibleSources.length === 0 && !hasVideo) {
    return (
      <div className="housing-gallery-empty" aria-hidden="true">
        <span>{t('housing.gallery.no_image', { defaultValue: 'No image' })}</span>
      </div>
    );
  }

  const safeIndex = Math.min(activeIndex, Math.max(0, visibleSources.length - 1));
  const mainSrc = visibleSources[safeIndex];

  return (
    <div className="housing-gallery">
      {hasVideo && (
        <div className="housing-gallery-video" style={videoAspectStyle}>
          {listing.videoUrl ? (
            <video
              src={`/api/tweet-video?url=${encodeURIComponent(listing.videoUrl)}`}
              poster={listing.videoPosterUrl}
              controls
              muted
              autoPlay
              loop
              playsInline
              preload="metadata"
              aria-label={t('housing.gallery.video_iframe_title', {
                defaultValue: 'Listing video',
              })}
            />
          ) : listing.youtubeVideoId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${listing.youtubeVideoId}?autoplay=1&mute=1&playsinline=1&rel=0`}
              title={t('housing.gallery.video_iframe_title', {
                defaultValue: 'Listing video',
              })}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          ) : null}
        </div>
      )}
      {mainSrc && (
      <img
        src={mainSrc}
        alt=""
        loading="lazy"
        className="housing-gallery-main"
        onError={handleImgError(mainSrc)}
        onLoad={handleYoutubeThumbnailLoad}
      />
      )}
      {visibleSources.length > 1 && (
        <ul className="housing-gallery-thumbs" role="tablist">
          {visibleSources.map((src, i) => (
            <li key={`${i}-${src}`} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={i === safeIndex}
                data-active={i === safeIndex}
                className="housing-gallery-thumb"
                onClick={() => setActiveIndex(i)}
                aria-label={t('housing.gallery.thumb_aria', {
                  index: i + 1,
                  total: visibleSources.length,
                  defaultValue: `Image ${i + 1} of ${visibleSources.length}`,
                })}
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  onError={handleImgError(src)}
                  onLoad={handleYoutubeThumbnailLoad}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
