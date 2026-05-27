import { useMemo } from 'react';
import { resolveSlideshowFrames, type SlideshowFrame, type SlideshowFramesInput } from './slideshowFrames';
import { useTweetVideoFrames } from './useTweetVideoFrames';

/**
 * 2026-05-27 カード ambient slideshow に渡す静止画フレーム配列を統合的に解決する。
 *
 * - X (Twitter) 動画 listing は extractVideoFrames で「3 フレーム抽出」 を試みる
 *   (Allmarks 正規仕様、 = 表示時抽出 + メモリ保持、 Storage 保存しない)
 * - 抽出が完了するまでは resolveSlideshowFrames の fallback (= videoPosterUrl 1 枚) を見せる
 * - 抽出失敗 (= 短すぎる / decode error / CORS error) も同じ fallback で何も壊れない
 * - 非動画 listing は extracted=[] のまま素直に resolveSlideshowFrames を返す (= 余計な cost なし)
 *
 * `enabled` は ambient global flag (= !reduced && !isScrolling && !lightboxOpen) を渡す。
 * false の間は抽出 queue を進めない (= 高速スクロール中の decoder 大量 spin-up 抑止)。
 * 抽出は MAX_CONCURRENT=1 + FIFO queue (useTweetVideoFrames 側)。
 */
export interface UseHousingCardFramesInput extends SlideshowFramesInput {
  id: string;
  videoUrl?: string;
}

export function useHousingCardFrames(
  listing: UseHousingCardFramesInput,
  enabled: boolean,
): readonly SlideshowFrame[] {
  const extracted = useTweetVideoFrames(
    listing.id,
    listing.videoUrl,
    Boolean(listing.videoUrl) && enabled,
  );
  const fallback = useMemo(() => resolveSlideshowFrames(listing), [listing]);
  return useMemo<readonly SlideshowFrame[]>(
    () =>
      extracted.length > 0
        ? extracted.map((src): SlideshowFrame => ({ src }))
        : fallback,
    [extracted, fallback],
  );
}
