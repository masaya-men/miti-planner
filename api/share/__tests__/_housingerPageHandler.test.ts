import { describe, it, expect } from 'vitest';
import { listingRepresentativeImages, collectImagesFromListings, reorderListingImageArraysByBackgroundId } from '../_housingerPageHandler.js';
import { buildHousingerSeoSnapshotHtml } from '../_housingerPageHandler.js';

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

describe('collectImagesFromListings', () => {
  it('各listingの代表1枚ずつを先に集める(足りていれば2枚目以降は見ない)', () => {
    const result = collectImagesFromListings([
      ['1a', '1b', '1c'],
      ['2a', '2b'],
      ['3a'],
    ], 3);
    expect(result).toEqual(['1a', '2a', '3a']);
  });

  it('代表1枚ずつだけでは目標に届かない場合、各listingの2枚目以降を追加で埋める', () => {
    const result = collectImagesFromListings([
      ['1a', '1b', '1c'],
      ['2a'],
    ], 5);
    // phase1: 1a, 2a (2枚) → phase2: 1b, 1c (listing1の残り) で計4枚、listing2に残りが無いのでそこで打ち止め
    expect(result).toEqual(['1a', '2a', '1b', '1c']);
  });

  it('全listingを合計しても目標に届かない場合はあるだけ返す(巡回コピーはしない)', () => {
    const result = collectImagesFromListings([['1a'], ['2a']], 10);
    expect(result).toEqual(['1a', '2a']);
  });

  it('listingが0件なら空配列', () => {
    expect(collectImagesFromListings([], 10)).toEqual([]);
  });

  it('空のlisting(画像0枚)が混ざっていても無視して続行する', () => {
    const result = collectImagesFromListings([['1a'], [], ['3a', '3b']], 10);
    expect(result).toEqual(['1a', '3a', '3b']);
  });
});

describe('reorderListingImageArraysByBackgroundId', () => {
  it('backgroundListingIdが一致する要素を先頭へ移動する', () => {
    const entries = [
      { id: 'l-1', images: ['1a'] },
      { id: 'l-2', images: ['2a'] },
      { id: 'l-3', images: ['3a'] },
    ];
    const result = reorderListingImageArraysByBackgroundId(entries, 'l-3');
    expect(result.map((e) => e.id)).toEqual(['l-3', 'l-1', 'l-2']);
    expect(result.map((e) => e.images)).toEqual([['3a'], ['1a'], ['2a']]);
  });

  it('一致する要素が無ければ並び順をそのまま返す', () => {
    const entries = [{ id: 'l-1', images: ['1a'] }, { id: 'l-2', images: ['2a'] }];
    const result = reorderListingImageArraysByBackgroundId(entries, 'l-999');
    expect(result.map((e) => e.id)).toEqual(['l-1', 'l-2']);
  });

  it('未指定(null/undefined)ならそのまま返す', () => {
    const entries = [{ id: 'l-1', images: ['1a'] }, { id: 'l-2', images: ['2a'] }];
    expect(reorderListingImageArraysByBackgroundId(entries, null).map((e) => e.id)).toEqual(['l-1', 'l-2']);
    expect(reorderListingImageArraysByBackgroundId(entries, undefined).map((e) => e.id)).toEqual(['l-1', 'l-2']);
  });

  it('既に先頭にある場合は並び替えしない', () => {
    const entries = [{ id: 'l-1', images: ['1a'] }, { id: 'l-2', images: ['2a'] }];
    const result = reorderListingImageArraysByBackgroundId(entries, 'l-1');
    expect(result.map((e) => e.id)).toEqual(['l-1', 'l-2']);
  });

  it('空配列はそのまま空配列', () => {
    expect(reorderListingImageArraysByBackgroundId([], 'l-1')).toEqual([]);
  });
});

describe('buildHousingerSeoSnapshotHtml', () => {
  it('displayName・bio・件数からスナップショットHTMLを組み立てる', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: 'ミスト太郎', bio: '内装こだわってます', listingCount: 3 });
    expect(html).toBe('<h1>ミスト太郎 のハウジング</h1><p>内装こだわってます</p><p>3件のハウジングを公開中</p>');
  });

  it('bioが空なら<p>を出さない', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: 'ミスト太郎', bio: '', listingCount: 0 });
    expect(html).toBe('<h1>ミスト太郎 のハウジング</h1><p>0件のハウジングを公開中</p>');
  });

  it('displayNameが空なら「ハウジンガー」にフォールバックする', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: '', bio: '', listingCount: 1 });
    expect(html).toBe('<h1>ハウジンガー のハウジング</h1><p>1件のハウジングを公開中</p>');
  });

  it('displayName・bioのHTML特殊文字をエスケープする', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: '<b>x</b>', bio: '"quote"', listingCount: 0 });
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt; のハウジング</h1><p>&quot;quote&quot;</p><p>0件のハウジングを公開中</p>');
  });
});
