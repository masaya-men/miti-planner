import { describe, it, expect } from 'vitest';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { representativeImage } from '../representativeImage';

const base = MOCK_LISTINGS[0];

describe('representativeImage', () => {
  it('imageMode=thumbnail かつ thumbnailPath があればそれを返す', () => {
    const listing = { ...base, imageMode: 'thumbnail' as const, thumbnailPath: '/x.svg' };
    expect(representativeImage(listing)).toBe('/x.svg');
  });

  it('imageMode=sns かつ ogImageUrl があればそれを返す', () => {
    const listing = {
      ...base,
      imageMode: 'sns' as const,
      ogImageUrl: 'https://example.com/a.jpg',
      thumbnailPath: undefined,
    };
    expect(representativeImage(listing)).toBe('https://example.com/a.jpg');
  });

  it('imageMode=none はプレースホルダを返す', () => {
    const listing = {
      ...base,
      imageMode: 'none' as const,
      thumbnailPath: undefined,
      ogImageUrl: undefined,
    };
    expect(representativeImage(listing)).toBe('/housing/mock-thumbs/1.svg');
  });

  it('imageMode=thumbnail だが thumbnailPath 欠落はプレースホルダにフォールバック', () => {
    const listing = { ...base, imageMode: 'thumbnail' as const, thumbnailPath: undefined };
    expect(representativeImage(listing)).toBe('/housing/mock-thumbs/1.svg');
  });

  it('imageMode=sns だが ogImageUrl 欠落はプレースホルダにフォールバック', () => {
    const listing = { ...base, imageMode: 'sns' as const, ogImageUrl: undefined };
    expect(representativeImage(listing)).toBe('/housing/mock-thumbs/1.svg');
  });
});
