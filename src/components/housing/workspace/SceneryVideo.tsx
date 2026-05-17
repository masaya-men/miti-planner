import { useEffect, useRef } from 'react';

export interface SceneryVideoProps {
  theme: 'light' | 'dark';
}

/**
 * Two-video scenery background with theme-driven crossfade.
 * Inactive video is paused (saves GPU). `prefers-reduced-motion` pauses both.
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
    <div
      className="fixed inset-0 z-0 overflow-hidden bg-black"
      aria-hidden="true"
    >
      <video
        ref={dayRef}
        data-scenery="day"
        data-active={theme === 'light' ? 'true' : 'false'}
        autoPlay
        loop
        muted
        playsInline
        poster="/housing/scenery-day-poster.webp"
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ opacity: theme === 'light' ? 1 : 0 }}
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
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ opacity: theme === 'dark' ? 1 : 0 }}
      >
        <source src="/housing/scenery-night.webm" type="video/webm" />
        <source src="/housing/scenery-night.mp4" type="video/mp4" />
      </video>
    </div>
  );
};
