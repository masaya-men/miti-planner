import { describe, it, expect } from 'vitest';
import { cardImageAttrs, smallHousingImageUrl, CARD_IMAGE_SIZES } from '../cardImageAttrs';

const HM = 'https://lopoly.app/housing-media/L1/u.webp';
const TW = 'https://pbs.twimg.com/media/ABC.jpg';
const YT = 'https://img.youtube.com/vi/ID/hqdefault.jpg';

describe('cardImageAttrs', () => {
  it('housing-media webp → 3幅の srcSet + 元 src + sizes', () => {
    const a = cardImageAttrs(HM, { sizes: CARD_IMAGE_SIZES });
    expect(a.src).toBe(HM);
    expect(a.srcSet).toBe(
      'https://lopoly.app/housing-media/L1/u-480.webp 480w, ' +
        'https://lopoly.app/housing-media/L1/u-960.webp 960w, ' +
        'https://lopoly.app/housing-media/L1/u-1440.webp 1440w',
    );
    expect(a.sizes).toBe(CARD_IMAGE_SIZES);
  });

  it('opts.widths と appendOriginal で詳細メイン用 srcSet', () => {
    const a = cardImageAttrs(HM, { widths: [960, 1440], appendOriginal: true });
    expect(a.srcSet).toBe(
      'https://lopoly.app/housing-media/L1/u-960.webp 960w, ' +
        'https://lopoly.app/housing-media/L1/u-1440.webp 1440w, ' +
        `${HM} 1920w`,
    );
  });

  it('X 画像 + twitterName → ?name= の src、srcSet なし', () => {
    const a = cardImageAttrs(TW, { twitterName: 'small' });
    expect(a.src).toBe('https://pbs.twimg.com/media/ABC.jpg?name=small');
    expect(a.srcSet).toBeUndefined();
  });

  it('X 画像 + twitterName 未指定 → 素の src', () => {
    expect(cardImageAttrs(TW).src).toBe(TW);
  });

  it('YouTube サムネ等 → 素の src のみ', () => {
    const a = cardImageAttrs(YT, { twitterName: 'small' });
    expect(a).toEqual({ src: YT });
  });
});

describe('smallHousingImageUrl', () => {
  it('housing-media は 480w 実体、X は ?name=small、他は素通し', () => {
    expect(smallHousingImageUrl(HM)).toBe('https://lopoly.app/housing-media/L1/u-480.webp');
    expect(smallHousingImageUrl(TW)).toBe('https://pbs.twimg.com/media/ABC.jpg?name=small');
    expect(smallHousingImageUrl(YT)).toBe(YT);
  });
});
