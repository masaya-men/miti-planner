import { useEffect, useRef } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { representativeImage } from '../../../lib/housing/representativeImage';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { HousingCardAmbientSlideshow } from '../workspace/HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from '../workspace/HousingCardVideoOverlay';

export interface TourLivingMediaProps {
  listing: MockListing;
  className?: string;
}

/**
 * 生きたカードの「メディア部分」(画像クロスフェード + 動画 spotlight)。
 * ツアー左パネルの現在カード(大)と次の目的地カード(小)で共用する。
 * 再生制御は HousingPlaybackProvider(cap1) 配下で行う想定。
 */
export const TourLivingMedia: React.FC<TourLivingMediaProps> = ({ listing, className }) => {
  const videoKind: 'twitter' | 'youtube' | null = listing.videoUrl
    ? 'twitter'
    : listing.youtubeVideoId
      ? 'youtube'
      : null;
  const { isPlaying, ambientOn, register } = useHousingCardPlayback(listing.id, videoKind !== null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    register(mediaRef.current);
    return (): void => register(null);
  }, [register]);
  const frames = useHousingCardFrames(listing, ambientOn);

  return (
    <div className={`housing-tour-living-media${className ? ` ${className}` : ''}`} ref={mediaRef}>
      <img
        className="housing-tour-living-media-img"
        src={representativeImage(listing)}
        alt=""
        loading="lazy"
      />
      <HousingCardAmbientSlideshow frames={frames} enabled={ambientOn} />
      {isPlaying && videoKind === 'twitter' && listing.videoUrl && (
        <HousingCardVideoOverlay
          kind="twitter"
          videoUrl={listing.videoUrl}
          posterUrl={listing.videoPosterUrl}
        />
      )}
      {isPlaying && videoKind === 'youtube' && listing.youtubeVideoId && (
        <HousingCardVideoOverlay kind="youtube" youtubeVideoId={listing.youtubeVideoId} />
      )}
    </div>
  );
};
