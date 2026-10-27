import { useCallback, useEffect, useRef } from 'react';

// 実機指摘(2026-08-12): スマホでは開いた直後に背景動画が1フレームも描画されず
// (下地の背景色が一色のまま見える)、リロードでのみ直る症状がある。ブラウザは
// 動画の読み込み失敗/無応答を自分から再試行しないため、猶予時間内に描画が
// 始まらなければ自動でリロード相当(load()し直し)を行う自己修復を持たせる。
const LOAD_WATCHDOG_MS = 6000;

// CDNは既にキャッシュ済みのため再取得コストは小さいが、無応答が続く回線では
// 際限なく再試行しても無駄なので上限を設ける。
const MAX_RETRIES = 1;

/** アクティブになった video 要素が猶予時間内に描画開始しなければ load() し直す。 */
export function useVideoLoadRecovery(ref: React.RefObject<HTMLVideoElement | null>, active: boolean) {
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
