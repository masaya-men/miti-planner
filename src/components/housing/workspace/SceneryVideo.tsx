import { useCallback, useEffect, useRef } from 'react';

export interface SceneryVideoProps {
  theme: 'light' | 'dark';
}

// 実機指摘(2026-08-12): スマホでは開いた直後に背景動画が1フレームも描画されず
// (下地の背景色が一色のまま見える)、リロードでのみ直る症状がある。ブラウザは
// 動画の読み込み失敗/無応答を自分から再試行しないため、猶予時間内に描画が
// 始まらなければ自動でリロード相当(load()し直し)を行う自己修復を持たせる。
const LOAD_WATCHDOG_MS = 6000;
// CDNは既にキャッシュ済みのため再取得コストは小さいが、無応答が続く回線では
// 際限なく再試行しても無駄なので上限を設ける。
const MAX_RETRIES = 1;

/** アクティブになった video 要素が猶予時間内に描画開始しなければ load() し直す。 */
function useVideoLoadRecovery(ref: React.RefObject<HTMLVideoElement | null>, active: boolean) {
  const retriesRef = useRef(0);

  const retry = useCallback(() => {
    const video = ref.current;
    if (!video || retriesRef.current >= MAX_RETRIES) return;
    retriesRef.current += 1;
    video.load();
    video.play().catch(() => {});
  }, [ref]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !active) return;
    retriesRef.current = 0;

    const onLoadedData = () => window.clearTimeout(watchdog);
    const onError = () => {
      window.clearTimeout(watchdog);
      retry();
    };
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('error', onError);

    const watchdog = window.setTimeout(() => {
      // HAVE_CURRENT_DATA(2)未満 = まだ1フレームも描画できていない。
      if (video.readyState < 2) retry();
    }, LOAD_WATCHDOG_MS);

    return () => {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('error', onError);
      window.clearTimeout(watchdog);
    };
  }, [ref, active, retry]);
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
