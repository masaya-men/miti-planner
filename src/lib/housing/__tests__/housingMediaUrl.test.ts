import { describe, it, expect } from 'vitest';
import {
  buildHousingMediaUrl,
  extractHousingMediaFilenameFromOldUrl,
  readThumbnailPaths,
} from '../housingMediaUrl';
import {
  buildHousingImagePublicUrl,
  parseStoragePathFromPublicUrl,
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
