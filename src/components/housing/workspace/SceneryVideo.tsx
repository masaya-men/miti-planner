import { useEffect, useRef } from 'react';

export interface SceneryVideoProps {
  theme: 'light' | 'dark';
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

  return (
    <>
      <div className="housing-scenery" aria-hidden="true" data-scenery-root>
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
          style={{ opacity: theme === 'light' ? 1 : 0, willChange: 'opacity' }}
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
          style={{ opacity: theme === 'dark' ? 1 : 0, willChange: 'opacity' }}
        >
          <source src="/housing/scenery-night.webm" type="video/webm" />
          <source src="/housing/scenery-night.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="housing-scenery-veil" aria-hidden="true" />
    </>
  );
};
