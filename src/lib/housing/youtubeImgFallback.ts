/**
 * YouTube サムネ画像の 4 段階フォールバック ハンドラ (2026-05-26 新設)。
 *
 * register プレビュー + listing 詳細ギャラリーの両方で使い回す。
 *
 * - onError: 404 系のときに次段の quality へ src swap (maxresdefault→hq→mq→default→停止)
 * - onLoad: maxresdefault 不在動画で YouTube が 120x90 のグレーTV画像を 200 で返すケースを検出して fallback 起動
 *   (default.jpg は正規に 120x90 なので除外、 ループ防止)
 */
import type { SyntheticEvent } from 'react';
import { nextYoutubeThumbnailFallback, parseYoutubeThumbnailUrl } from './youtubeUrl';

export function handleYoutubeThumbnailError(e: SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  const next = nextYoutubeThumbnailFallback(img.src);
  if (next) img.src = next;
}

export function handleYoutubeThumbnailLoad(e: SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.naturalWidth !== 120 || img.naturalHeight !== 90) return;
  const parsed = parseYoutubeThumbnailUrl(img.src);
  if (!parsed || parsed.quality === 'default') return;
  const next = nextYoutubeThumbnailFallback(img.src);
  if (next) img.src = next;
}
