import { describe, it, expect } from 'vitest';
import { resolveCoverAspectRatio, DEFAULT_COVER_ASPECT_RATIO } from '../../lib/housing/resolveCoverAspectRatio';
import type { MockListing } from '../../data/housing/mockListings';

// resolveCoverAspectRatio が読むフィールドだけ与えれば十分。厳密 tsc 回避で unknown 経由キャスト。
const base = (over: Partial<MockListing>): MockListing => ({
  id: 'x', dc: 'Mana', server: 'Anima', region: 'JP', area: 'Mist',
  tags: [], createdAt: 0, ...over,
} as unknown as MockListing);

describe('resolveCoverAspectRatio', () => {
  it('動画 listing は videoAspectRatio を返す', () => {
    expect(resolveCoverAspectRatio(base({ videoUrl: 'v', videoAspectRatio: 1.78 }))).toBe(1.78);
  });
  it('YouTube listing も videoAspectRatio を返す', () => {
    expect(resolveCoverAspectRatio(base({ youtubeVideoId: 'abc', videoAspectRatio: 1.5 }))).toBe(1.5);
  });
  it('静止画 listing は先頭画像の比を返す', () => {
    expect(resolveCoverAspectRatio(base({ sourceImageAspectRatios: [0.75, 1.2] }))).toBe(0.75);
  });
  it('比が無ければ既定値', () => {
    expect(resolveCoverAspectRatio(base({}))).toBe(DEFAULT_COVER_ASPECT_RATIO);
  });
  it('比が 0 (寸法不明) なら既定値', () => {
    expect(resolveCoverAspectRatio(base({ sourceImageAspectRatios: [0] }))).toBe(DEFAULT_COVER_ASPECT_RATIO);
  });
  it('動画だが videoAspectRatio 未設定なら画像比 → 既定値の順で fallback', () => {
    expect(resolveCoverAspectRatio(base({ videoUrl: 'v', sourceImageAspectRatios: [1.33] }))).toBe(1.33);
    expect(resolveCoverAspectRatio(base({ videoUrl: 'v' }))).toBe(DEFAULT_COVER_ASPECT_RATIO);
  });
});
