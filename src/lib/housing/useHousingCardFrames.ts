import { useMemo } from 'react';
import { resolveSlideshowFrames, type SlideshowFrame, type SlideshowFramesInput } from './slideshowFrames';
import { useTweetVideoFrames } from './useTweetVideoFrames';

/**
 * 2026-05-27 カード ambient slideshow に渡す静止画フレーム配列を統合的に解決する。
 *
 * 動画 listing の 2 パターン分岐:
 * - X 動画 only (sourceImageUrls 空) → extractVideoFrames で 3 フレーム抽出
 *   (Allmarks 正規仕様、 表示時抽出 + メモリ保持、 Storage 保存しない)
 * - X 動画 + 画像 (sourceImageUrls あり) → **抽出 skip**。 resolveSlideshowFrames が
 *   画像 + videoPosterUrl を merge して 3 枚以上の ambient フレームを作る (= ② パターン)。
 *   抽出 hook の cost (= video decode + canvas + JPEG) をまるまる節約できる。
 *
 * 非動画 listing (= YouTube only / 画像 only / OGP) は extracted=[] のまま素直に
 * resolveSlideshowFrames を返す (= 余計な cost なし)。
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
  const hasSourceImages = (listing.sourceImageUrls?.length ?? 0) > 0;
  const shouldExtract = Boolean(listing.videoUrl) && !hasSourceImages;
  const extracted = useTweetVideoFrames(
    listing.id,
    listing.videoUrl,
    shouldExtract && enabled,
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
