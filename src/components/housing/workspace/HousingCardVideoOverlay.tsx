import { buildTweetVideoProxyUrl } from '../../../lib/housing/tweetVideoProxy';

export type HousingCardVideoOverlayProps =
  | {
      kind: 'twitter';
      videoUrl: string;
      posterUrl?: string;
    }
  | {
      kind: 'youtube';
      youtubeVideoId: string;
    };

/**
 * カードに重ねる動画オーバーレイ。 spotlight rotation の live メンバーのみ mount。
 * Twitter は `<video>` + proxy (Referer gate 回避)、 YouTube は youtube-nocookie iframe。
 * 一律 muted autoplay loop、 controls なし (= ambient)、 pointer-events: none で
 * 背後の onClick (= Lightbox 起動) を spare。
 */
export function HousingCardVideoOverlay(
  props: HousingCardVideoOverlayProps,
): React.ReactElement {
  if (props.kind === 'twitter') {
    const proxied = buildTweetVideoProxyUrl(props.videoUrl);
    return (
      <div className="housing-card-video-overlay" aria-hidden="true">
        <video
          src={proxied}
          poster={props.posterUrl}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
        />
      </div>
    );
  }
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    loop: '1',
    playlist: props.youtubeVideoId,
    controls: '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  });
  const src = `https://www.youtube-nocookie.com/embed/${props.youtubeVideoId}?${params.toString()}`;
  return (
    <div className="housing-card-video-overlay" aria-hidden="true">
      <iframe
        src={src}
        title=""
        allow="autoplay; encrypted-media"
        tabIndex={-1}
      />
    </div>
  );
}
