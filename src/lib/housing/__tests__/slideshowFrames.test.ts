import { describe, it, expect } from 'vitest';
import { resolveSlideshowFrames } from '../slideshowFrames';
import type { HousingListing } from '../../../types/housing';

const baseListing = (): HousingListing =>
  ({ id: 'x', imageMode: 'sns' } as HousingListing);

describe('resolveSlideshowFrames', () => {
  it('returns sourceImageUrls when available (OGP / Twitter 静止画)', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      sourceImageUrls: [
        'https://pbs.twimg.com/media/A.jpg',
        'https://pbs.twimg.com/media/B.jpg',
      ],
    } as HousingListing);
    expect(frames.map((f) => f.src)).toEqual([
      'https://pbs.twimg.com/media/A.jpg',
      'https://pbs.twimg.com/media/B.jpg',
    ]);
  });

  it('returns YouTube storyboard 3 frames (poster + hq1 + hq2 with fallbacks)', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      youtubeVideoId: 'abcdefghijk',
    } as HousingListing);
    expect(frames).toEqual([
      { src: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' },
      {
        src: 'https://i.ytimg.com/vi/abcdefghijk/hq1.jpg',
        fallback: 'https://i.ytimg.com/vi/abcdefghijk/1.jpg',
      },
      {
        src: 'https://i.ytimg.com/vi/abcdefghijk/hq2.jpg',
        fallback: 'https://i.ytimg.com/vi/abcdefghijk/2.jpg',
      },
    ]);
  });

  it('returns videoPosterUrl 1 frame for Twitter 動画 only ツイート', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      videoPosterUrl: 'https://pbs.twimg.com/media/POSTER.jpg',
    } as HousingListing);
    expect(frames).toEqual([{ src: 'https://pbs.twimg.com/media/POSTER.jpg' }]);
  });

  it('returns thumbnailPaths for legacy data', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      imageMode: 'thumbnail',
      thumbnailPaths: ['/thumb1.webp', '/thumb2.webp'],
    } as HousingListing);
    expect(frames).toEqual([
      { src: '/thumb1.webp' },
      { src: '/thumb2.webp' },
    ]);
  });

  it('returns ogImageUrl 1 frame as final fallback', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      ogImageUrl: 'https://example.com/og.png',
    } as HousingListing);
    expect(frames).toEqual([{ src: 'https://example.com/og.png' }]);
  });

  it('returns empty array when nothing matches', () => {
    expect(resolveSlideshowFrames(baseListing())).toEqual([]);
  });

  it('appends videoPosterUrl to sourceImageUrls for video+image tweets (no extraction needed)', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      sourceImageUrls: [
        'https://pbs.twimg.com/media/A.jpg',
        'https://pbs.twimg.com/media/B.jpg',
      ],
      videoPosterUrl: 'https://pbs.twimg.com/media/POSTER.jpg',
    } as HousingListing);
    expect(frames.map((f) => f.src)).toEqual([
      'https://pbs.twimg.com/media/A.jpg',
      'https://pbs.twimg.com/media/B.jpg',
      'https://pbs.twimg.com/media/POSTER.jpg',
    ]);
  });

  it('prioritizes sourceImageUrls over youtubeVideoId', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      sourceImageUrls: ['https://pbs.twimg.com/media/A.jpg'],
      youtubeVideoId: 'abcdefghijk',
    } as HousingListing);
    expect(frames).toEqual([{ src: 'https://pbs.twimg.com/media/A.jpg' }]);
  });
});
