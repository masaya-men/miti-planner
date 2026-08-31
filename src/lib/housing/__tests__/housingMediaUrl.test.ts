import { describe, it, expect } from 'vitest';
import {
  buildHousingMediaUrl,
  extractHousingMediaFilenameFromOldUrl,
  readThumbnailPaths,
  housingImageVariant,
} from '../housingMediaUrl';
import {
  buildHousingImagePublicUrl,
  parseStoragePathFromPublicUrl,
  toDerivativePath,
  HOUSING_CARD_DERIVATIVE_WIDTHS,
} from '../../../../api/housing/_imageArrayLogic.js';

describe('buildHousingMediaUrl', () => {
  it('listingIdとfilenameから新形式の公開URLを組み立てる', () => {
    expect(buildHousingMediaUrl('abc', 'x1y2z3.webp')).toBe(
      'https://lopoly.app/housing-media/abc/x1y2z3.webp',
    );
  });
});

describe('extractHousingMediaFilenameFromOldUrl', () => {
  it('firebasestorage の旧形式URLから、指定listingIdのファイル名を取り出す', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/housing%2Flistings%2Fabc%2Fx1y2z3.webp?alt=media';
    expect(extractHousingMediaFilenameFromOldUrl(url, 'abc')).toBe('x1y2z3.webp');
  });

  it('listingIdが一致しなければ null', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/housing%2Flistings%2Fabc%2Fx1y2z3.webp?alt=media';
    expect(extractHousingMediaFilenameFromOldUrl(url, 'other-listing')).toBeNull();
  });

  it('不正なURL文字列は null', () => {
    expect(extractHousingMediaFilenameFromOldUrl('not-a-url', 'abc')).toBeNull();
  });

  it('firebasestorage以外のホストは null', () => {
    expect(extractHousingMediaFilenameFromOldUrl('https://pbs.twimg.com/media/x.jpg', 'abc')).toBeNull();
  });
});

describe('readThumbnailPaths', () => {
  it('thumbnailPaths 配列があればそれを返す', () => {
    expect(readThumbnailPaths({ thumbnailPaths: ['a', 'b'], thumbnailPath: 'ignored' })).toEqual([
      'a',
      'b',
    ]);
  });

  it('thumbnailPaths が無く thumbnailPath (文字列) のみあれば1件配列にする', () => {
    expect(readThumbnailPaths({ thumbnailPath: 'x1y2z3.webp' })).toEqual(['x1y2z3.webp']);
  });

  it('どちらも無ければ空配列', () => {
    expect(readThumbnailPaths({})).toEqual([]);
  });
});

/**
 * パリティテスト: 移行スクリプト専用に切り出したこのモジュールと、本番の
 * api/housing/_imageArrayLogic.ts が同じ変換規則であることを機械的に保証する。
 * どちらか片方だけが将来変更されて静かにズレるリスクを検出する。
 */
describe('api/housing/_imageArrayLogic.ts とのパリティ', () => {
  it('buildHousingMediaUrl と buildHousingImagePublicUrl は同じ入力に対して同じ文字列を返す', () => {
    expect(buildHousingMediaUrl('listing-42', 'uuid-abc.avif')).toBe(
      buildHousingImagePublicUrl('listing-42', 'uuid-abc.avif'),
    );
  });

  it('extractHousingMediaFilenameFromOldUrl の結果から組み立てたStorageパスは parseStoragePathFromPublicUrl の結果と一致する', () => {
    const oldUrl =
      'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/housing%2Flistings%2Flisting-42%2Fx1y2z3.webp?alt=media';
    const filename = extractHousingMediaFilenameFromOldUrl(oldUrl, 'listing-42');
    expect(filename).toBe('x1y2z3.webp');

    const derivedStoragePath = `housing/listings/listing-42/${filename}`;
    expect(derivedStoragePath).toBe(parseStoragePathFromPublicUrl(oldUrl));
  });
});

describe('housingImageVariant', () => {
  it('housing-media の webp を派生 URL に差し替える', () => {
    expect(
      housingImageVariant('https://lopoly.app/housing-media/L1/uuid-abc.webp', 480),
    ).toBe('https://lopoly.app/housing-media/L1/uuid-abc-480.webp');
    expect(
      housingImageVariant('https://lopoly.app/housing-media/L1/uuid-abc.webp', 1440),
    ).toBe('https://lopoly.app/housing-media/L1/uuid-abc-1440.webp');
  });

  it('jpg/png 元でも派生は -{w}.webp になる', () => {
    expect(
      housingImageVariant('https://lopoly.app/housing-media/L1/uuid-abc.jpg', 960),
    ).toBe('https://lopoly.app/housing-media/L1/uuid-abc-960.webp');
  });

  it('クエリ付き URL でも拡張子だけ差し替える', () => {
    expect(
      housingImageVariant('https://lopoly.app/housing-media/L1/u.webp?v=2', 480),
    ).toBe('https://lopoly.app/housing-media/L1/u-480.webp?v=2');
  });

  it('housing-media 以外(X 画像・旧 firebasestorage・pngパス)は素通し', () => {
    for (const u of [
      'https://pbs.twimg.com/media/ABC.jpg',
      'https://firebasestorage.googleapis.com/v0/b/x/o/housing%2Flistings%2FL1%2Fu.webp?alt=media',
      'https://lopoly.app/housing-media/L1/u.png',
      'not-a-url',
    ]) {
      expect(housingImageVariant(u, 480)).toBe(u);
    }
  });
});

describe('toDerivativePath / housingImageVariant パリティ', () => {
  it('同じ論理入力に対して同じファイル名になる', () => {
    const storagePath = 'housing/listings/L1/uuid-abc.webp';
    const url = 'https://lopoly.app/housing-media/L1/uuid-abc.webp';
    for (const w of HOUSING_CARD_DERIVATIVE_WIDTHS) {
      const derivedStorageBasename = toDerivativePath(storagePath, w).split('/').pop();
      const derivedUrlBasename = housingImageVariant(url, w).split('/').pop();
      expect(derivedUrlBasename).toBe(derivedStorageBasename);
    }
  });
});
