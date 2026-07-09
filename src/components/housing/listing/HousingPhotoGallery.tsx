/**
 * 物件詳細のメディアギャラリー（2026-07-09 再設計: 大メイン＋縦サムネイル列）
 *
 * - 動画＋画像を 1 本の配列 (mediaItems) に統合。 activeIndex がメインステージに映る項目。
 * - 左: メインステージ（選択中を object-fit:contain で「絶対に切り抜かず」全体表示）。
 * - 右: 縦サムネイル列（全項目）。 内部だけ縦スクロールし、 スクロールバーは出さず、
 *   端に強めのフェード（scroll 位置で data-at-top/at-bottom をトグル → CSS で opacity）。
 * - サムネクリック → activeIndex 更新でメインが入れ替わるだけ（拡大/ライトボックスは無し）。
 * - 404 で読めない外部 URL は onError で markFailed → 表示から除外（元投稿削除の自然消失）。
 */
import { useState, useMemo, useCallback, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '../../../types/housing';
import {
  handleYoutubeThumbnailError,
  handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';
import { buildTweetVideoProxyUrl } from '../../../lib/housing/tweetVideoProxy';
import { useScrollFade } from '../../../lib/housing/useScrollFade';

export interface HousingPhotoGalleryProps {
  listing: HousingListing;
}

/**
 * listing から画像 URL の配列を取り出す（挙動は従来と同一）。
 * - imageMode==='thumbnail': thumbnailPaths を優先、 なければ thumbnailPath を 1 件
 * - imageMode==='sns': sourceImageUrls があれば配列、 なければ ogImageUrl 1 件
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

type MediaItem = { kind: 'video' } | { kind: 'image'; src: string };

export const HousingPhotoGallery: React.FC<HousingPhotoGalleryProps> = ({ listing }) => {
  const { t } = useTranslation();
  const sources = useMemo(() => resolveSources(listing), [listing]);
  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());

  const markFailed = useCallback((src: string) => {
    setFailedSources((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  // onError: まず YouTube サムネ段階 fallback、 それでも src が変わらなければ表示不可として除外。
  const handleImgError = useCallback(
    (originalSrc: string) => (e: SyntheticEvent<HTMLImageElement>) => {
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

  const hasVideo = !!(listing.videoUrl || listing.youtubeVideoId);
  const videoAspectStyle = listing.videoAspectRatio
    ? { aspectRatio: String(listing.videoAspectRatio) }
    : undefined;
  const videoThumb = listing.videoPosterUrl || listing.ogImageUrl || null;

  // 全メディアを 1 本に統合（動画があれば先頭）。
  const mediaItems = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = [];
    if (hasVideo) items.push({ kind: 'video' });
    for (const src of visibleSources) items.push({ kind: 'image', src });
    return items;
  }, [hasVideo, visibleSources]);

  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, Math.max(0, mediaItems.length - 1));

  // 縦サムネ列のスクロールフェード（共通フック）。 端に達したらその端のフェードを消す。
  const { ref: railRef, atStart: atTop, atEnd: atBottom, onScroll: updateFade } =
    useScrollFade<HTMLUListElement>();

  if (mediaItems.length === 0) {
    return (
      <div className="housing-gallery-empty" aria-hidden="true">
        <span>{t('housing.gallery.no_image', { defaultValue: 'No image' })}</span>
      </div>
    );
  }

  const active = mediaItems[safeIndex];
  const showRail = mediaItems.length > 1;

  return (
    <div className="housing-gallery">
      <div className="housing-gallery-stage">
        {active.kind === 'video' ? (
          <div className="housing-gallery-video" style={videoAspectStyle}>
            {listing.videoUrl ? (
              <video
                src={buildTweetVideoProxyUrl(listing.videoUrl)}
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
        ) : (
          <img
            src={active.src}
            alt=""
            loading="lazy"
            className="housing-gallery-main"
            onError={handleImgError(active.src)}
            onLoad={handleYoutubeThumbnailLoad}
          />
        )}
      </div>

      {showRail && (
        <div
          className="housing-detail-thumbrail-wrap"
          data-at-top={atTop}
          data-at-bottom={atBottom}
        >
          <ul
            className="housing-detail-thumbrail"
            role="tablist"
            ref={railRef}
            onScroll={updateFade}
          >
            {mediaItems.map((item, i) => (
              <li key={item.kind === 'video' ? 'video' : `${i}-${item.src}`} role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  data-active={i === safeIndex}
                  className="housing-detail-thumb"
                  onClick={() => setActiveIndex(i)}
                  aria-label={t('housing.gallery.thumb_aria', {
                    index: i + 1,
                    total: mediaItems.length,
                    defaultValue: `Image ${i + 1} of ${mediaItems.length}`,
                  })}
                >
                  {item.kind === 'video' ? (
                    <>
                      {videoThumb ? (
                        <img src={videoThumb} alt="" loading="lazy" />
                      ) : (
                        <span className="housing-detail-thumb-videobg" aria-hidden="true" />
                      )}
                      <span className="housing-detail-thumb-play" aria-hidden="true">
                        ▶
                      </span>
                    </>
                  ) : (
                    <img
                      src={item.src}
                      alt=""
                      loading="lazy"
                      onError={handleImgError(item.src)}
                      onLoad={handleYoutubeThumbnailLoad}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
