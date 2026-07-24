import { describe, it, expect } from 'vitest';
import {
  computeArrayDeletion,
  computeArrayReorder,
  parseStoragePathFromPublicUrl,
} from '../_imageArrayLogic.js';

describe('computeArrayDeletion', () => {
  it('中間の要素を削除すると後続が詰まる', () => {
    const result = computeArrayDeletion(['a', 'b', 'c', 'd'], 1);
    expect(result).toEqual({ ok: true, next: ['a', 'c', 'd'], removed: 'b' });
  });

  it('範囲外のindexは invalid_index', () => {
    expect(computeArrayDeletion(['a', 'b'], 5)).toEqual({ ok: false, error: 'invalid_index' });
    expect(computeArrayDeletion(['a', 'b'], -1)).toEqual({ ok: false, error: 'invalid_index' });
  });

  it('整数でないindexは invalid_index', () => {
    expect(computeArrayDeletion(['a', 'b'], 1.5)).toEqual({ ok: false, error: 'invalid_index' });
  });

  it('残り1件を削除しようとすると last_item', () => {
    expect(computeArrayDeletion(['a'], 0)).toEqual({ ok: false, error: 'last_item' });
  });

  it('空配列は invalid_index', () => {
    expect(computeArrayDeletion([], 0)).toEqual({ ok: false, error: 'invalid_index' });
  });
});

describe('computeArrayReorder', () => {
  it('並び替え後の配列が元の要素集合と一致すれば permutation を返す', () => {
    const result = computeArrayReorder(['a', 'b', 'c'], ['c', 'a', 'b']);
    expect(result).toEqual({ ok: true, permutation: [2, 0, 1] });
  });

  it('件数が違えば invalid_reorder', () => {
    expect(computeArrayReorder(['a', 'b'], ['a'])).toEqual({ ok: false, error: 'invalid_reorder' });
  });

  it('要素が違えば invalid_reorder', () => {
    expect(computeArrayReorder(['a', 'b'], ['a', 'z'])).toEqual({ ok: false, error: 'invalid_reorder' });
  });

  it('同じ値が重複していても1対1で対応づける', () => {
    const result = computeArrayReorder(['a', 'a', 'b'], ['a', 'b', 'a']);
    expect(result).toEqual({ ok: true, permutation: [0, 2, 1] });
  });
});

describe('parseStoragePathFromPublicUrl', () => {
  it('firebasestorage の公開URLからパスを逆算する', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/housing%2Flistings%2Fabc%2Fx1y2z3.webp?alt=media';
    expect(parseStoragePathFromPublicUrl(url)).toBe('housing/listings/abc/x1y2z3.webp');
  });

  it('firebasestorage 以外のURLは null (外部URLを誤って削除しないため)', () => {
    expect(parseStoragePathFromPublicUrl('https://pbs.twimg.com/media/x.jpg')).toBeNull();
  });

  it('不正なURL文字列は null', () => {
    expect(parseStoragePathFromPublicUrl('not-a-url')).toBeNull();
  });

  it('新形式(lopoly.app/housing-media/)のURLからもパスを逆算する', () => {
    const url = 'https://lopoly.app/housing-media/abc/x1y2z3.webp';
    expect(parseStoragePathFromPublicUrl(url)).toBe('housing/listings/abc/x1y2z3.webp');
  });

  it('新形式で listingId/filename にスラッシュ以外の記号を含んでいても正しく逆算する', () => {
    const url = 'https://lopoly.app/housing-media/abc-123_ID/a1b2-c3d4.avif';
    expect(parseStoragePathFromPublicUrl(url)).toBe('housing/listings/abc-123_ID/a1b2-c3d4.avif');
  });
});
