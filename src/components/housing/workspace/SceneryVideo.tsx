import { useEffect, useRef, useState } from 'react';
import { useVideoLoadRecovery } from './useVideoLoadRecovery';
import './SceneryVideo.css';

export interface SceneryVideoProps {
  theme: 'light' | 'dark';
}

/**
 * 実際に流れている間だけ true。iPhone は自動再生を拒否すると動画中央に標準の再生ボタンを出し、
 * CSS の疑似要素では隠せない(2026-10-26 実機)。流れていない動画は見せず後ろの静止画を出す。
 */
function useIsPlaying(ref: React.RefObject<HTMLVideoElement | null>) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const onPlaying = () => setPlaying(true);
    const onStopped = () => setPlaying(false);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onStopped);
    video.addEventListener('emptied', onStopped);
    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onStopped);
      video.removeEventListener('emptied', onStopped);
    };
  }, [ref]);
  return playing;
}

/**
 * Background scenery layer: two crossfading videos behind the workspace,
 * plus a theme-conditional gradient overlay and a darkening veil for legibility.
 * Light: warm wash + bottom darken. Dark: starry night + milky-way + starfield.
 * Inactive video is paused (GPU save). `prefers-reduced-motion` pauses both.
 * Only the active video preloads fully; the inactive one fetches metadata only
 * (2026-07-14: halves per-visit video bandwidth; play() on theme switch starts the fetch).
 */
export const SceneryVideo: React.FC<SceneryVideoProps> = ({ theme }) => {
  const dayRef = useRef<HTMLVideoElement>(null);
  const nightRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const day = dayRef.current;
    const night = nightRef.current;
    if (!day || !night) return;
    if (reduceMotion) {
      day.pause();
      night.pause();
      return;
    }
    if (theme === 'light') {
      night.pause();
      day.play().catch(() => {});
    } else {
      day.pause();
      night.play().catch(() => {});
    }
  }, [theme]);

  useVideoLoadRecovery(dayRef, theme === 'light');
  useVideoLoadRecovery(nightRef, theme === 'dark');
  const dayPlaying = useIsPlaying(dayRef);
  const nightPlaying = useIsPlaying(nightRef);

  return (
    <>
      <div className="housing-scenery" aria-hidden="true" data-scenery-root>
        <div className="housing-scenery-poster" data-scenery-poster={theme === 'light' ? 'day' : 'night'} />
        <video
          ref={dayRef}
          data-scenery="day"
          data-active={theme === 'light' ? 'true' : 'false'}
          autoPlay
          loop
          muted
          playsInline
          poster="/housing/scenery-day-poster.webp"
          preload={theme === 'light' ? 'auto' : 'metadata'}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: theme === 'light' && dayPlaying ? 1 : 0, willChange: 'opacity' }}
        >
          <source src="/housing/scenery-day.webm" type="video/webm" />
          <source src="/housing/scenery-day.mp4" type="video/mp4" />
        </video>
        <video
          ref={nightRef}
          data-scenery="night"
          data-active={theme === 'dark' ? 'true' : 'false'}
          autoPlay
          loop
          muted
          playsInline
          poster="/housing/scenery-night-poster.webp"
          preload={theme === 'dark' ? 'auto' : 'metadata'}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: theme === 'dark' && nightPlaying ? 1 : 0, willChange: 'opacity' }}
        >
          <source src="/housing/scenery-night.webm" type="video/webm" />
          <source src="/housing/scenery-night.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="housing-scenery-veil" aria-hidden="true" />
    </>
  );
};
