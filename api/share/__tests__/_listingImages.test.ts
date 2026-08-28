import { describe, it, expect } from 'vitest';
import { listingRepresentativeImages } from '../_listingImages.js';

describe('listingRepresentativeImages', () => {
  it('thumbnailPathsがあれば複数枚(.png兄弟パスに変換して)返す', () => {
    const imgs = listingRepresentativeImages({
      imageMode: 'thumbnail',
      thumbnailPaths: ['a.webp', 'b.webp', 'c.png'],
    });
    expect(imgs).toEqual(['a.png', 'b.png', 'c.png']);
  });

  it('thumbnailPathsが無ければthumbnailPath1枚にフォールバックする', () => {
    const imgs = listingRepresentativeImages({ imageMode: 'thumbnail', thumbnailPath: 'x.webp' });
    expect(imgs).toEqual(['x.png']);
  });

  it('youtubeVideoIdはthumbnailより優先度は下だが1枚だけ返す', () => {
    const imgs = listingRepresentativeImages({ youtubeVideoId: 'abc12345678' });
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toContain('abc12345678');
  });

  it('sns + sourceImageUrlsがあれば複数枚そのまま返す', () => {
    const imgs = listingRepresentativeImages({
      imageMode: 'sns',
      sourceImageUrls: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
    });
    expect(imgs).toEqual(['https://example.com/1.jpg', 'https://example.com/2.jpg']);
  });

  it('sns + sourceImageUrls無しはogImageUrl1枚にフォールバックする', () => {
    const imgs = listingRepresentativeImages({ imageMode: 'sns', ogImageUrl: 'https://example.com/og.jpg' });
    expect(imgs).toEqual(['https://example.com/og.jpg']);
  });

  it('何も無ければ空配列', () => {
    expect(listingRepresentativeImages({})).toEqual([]);
  });
});
