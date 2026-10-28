import { describe, it, expect } from 'vitest';
import { buildListingImageFields } from '../../utils/housingImageValidation';

describe('buildListingImageFields', () => {
  it('sns + 全フィールド揃いで sns モードのフィールドを返す', () => {
    const out = buildListingImageFields(
      { imageMode: 'sns', postUrl: 'https://x.com/u/status/123', ogImageUrl: 'https://pbs.twimg.com/media/a.jpg', tweetId: '123' } as any,
      1000,
    );
    expect(out).toEqual({
      imageMode: 'sns',
      postUrl: 'https://x.com/u/status/123',
      ogImageUrl: 'https://pbs.twimg.com/media/a.jpg',
      tweetId: '123',
      lastTweetCheckAt: 1000,
    });
  });

  // 2026-05-27: OGP 経路 (sourceImageUrls) の buildListingImageFields
  it('OGP 経路 (sourceImageUrls あり) で sourceImageUrls を含めて返す', () => {
    const out = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://housingsnap.com/12345',
        ogImageUrl: 'https://cdn.example.com/a.jpg',
        sourceImageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      } as any,
      1000,
    );
    expect(out).toEqual({
      imageMode: 'sns',
      postUrl: 'https://housingsnap.com/12345',
      ogImageUrl: 'https://cdn.example.com/a.jpg',
      sourceImageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    });
  });

  it('OGP 経路で sourceImageUrls が 11 件来ても先頭 10 件で保存 (2026-05-27 4→10 拡大)', () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
    const out = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://housingsnap.com/12345',
        ogImageUrl: urls[0],
        sourceImageUrls: urls,
      } as any,
      1000,
    );
    if (out.imageMode !== 'sns' || !('sourceImageUrls' in out)) throw new Error('expected OGP sns');
    expect(out.sourceImageUrls).toHaveLength(10);
    expect(out.sourceImageUrls).toEqual(urls.slice(0, 10));
  });

  // 2026-08-20: YouTube動画 + Xの静止画の同居
  it('YouTube (sourceImageUrls なし) は従来通り youtubeVideoId のみ返す (回帰確認)', () => {
    const out = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://youtu.be/abcdefghijk',
        ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
        youtubeVideoId: 'abcdefghijk',
      } as any,
      1000,
    );
    expect(out).toEqual({
      imageMode: 'sns',
      postUrl: 'https://youtu.be/abcdefghijk',
      ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
      youtubeVideoId: 'abcdefghijk',
    });
  });

  it('YouTube + sourceImageUrls (Xの静止画) ありなら両方を含めて返す', () => {
    const out = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://youtu.be/abcdefghijk',
        ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
        youtubeVideoId: 'abcdefghijk',
        sourceImageUrls: ['https://pbs.twimg.com/media/a.jpg', 'https://pbs.twimg.com/media/b.jpg'],
      } as any,
      1000,
    );
    expect(out).toEqual({
      imageMode: 'sns',
      postUrl: 'https://youtu.be/abcdefghijk',
      ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
      youtubeVideoId: 'abcdefghijk',
      sourceImageUrls: ['https://pbs.twimg.com/media/a.jpg', 'https://pbs.twimg.com/media/b.jpg'],
    });
  });

  it('sns 以外は none を返す', () => {
    expect(buildListingImageFields({} as any, 1000)).toEqual({ imageMode: 'none' });
  });

  // 2026-07-20: 直接画像アップロード時でも postUrl だけは保存する (実ユーザー報告の修正)
  it("imageMode!=='sns' でも postUrl があれば none + postUrl を返す", () => {
    const out = buildListingImageFields(
      { imageMode: undefined, postUrl: 'https://x.com/foo/status/123' } as any,
      1000,
    );
    expect(out).toEqual({ imageMode: 'none', postUrl: 'https://x.com/foo/status/123' });
  });

  it("imageMode!=='sns' かつ postUrl も無ければ引き続き none のみ", () => {
    expect(buildListingImageFields({ imageMode: undefined } as any, 1000)).toEqual({
      imageMode: 'none',
    });
  });

  // 2026-05-27: Twitter 静止画ツイート (tweetId + sourceImageUrls)
  it('Twitter 静止画ツイートは tweetId + sourceImageUrls + lastTweetCheckAt を返す', () => {
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/B.jpg',
        ],
        tags: [],
      } as any,
      1700000000000,
    );
    expect(result).toMatchObject({
      imageMode: 'sns',
      tweetId: '123',
      lastTweetCheckAt: 1700000000000,
      sourceImageUrls: [
        'https://pbs.twimg.com/media/A.jpg',
        'https://pbs.twimg.com/media/B.jpg',
      ],
    });
    expect('videoUrl' in result).toBe(false);
  });

  // 2026-05-27: Twitter 動画ツイート (tweetId + videoUrl/Poster/AspectRatio)
  it('Twitter 動画ツイートは tweetId + video 3 フィールド + lastTweetCheckAt を返す', () => {
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/x.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoAspectRatio: 1.78,
        tags: [],
      } as any,
      1700000000000,
    );
    expect(result).toMatchObject({
      imageMode: 'sns',
      tweetId: '123',
      lastTweetCheckAt: 1700000000000,
      videoUrl: 'https://video.twimg.com/x.mp4',
      videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
      videoAspectRatio: 1.78,
    });
    expect('sourceImageUrls' in result).toBe(false);
  });

  it('Twitter テキストツイート (画像も動画も無し) は tweetId のみ返す', () => {
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        tags: [],
      } as any,
      1700000000000,
    );
    expect(result).toEqual({
      imageMode: 'sns',
      postUrl: 'https://twitter.com/foo/status/123',
      ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
      tweetId: '123',
      lastTweetCheckAt: 1700000000000,
    });
  });

  it('Twitter 静止画ツイートで sourceImageUrls 11 件は先頭 10 件で保存', () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://pbs.twimg.com/media/${i}.jpg`);
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: urls[0],
        sourceImageUrls: urls,
        tags: [],
      } as any,
      1700000000000,
    );
    if (result.imageMode !== 'sns' || !('sourceImageUrls' in result)) {
      throw new Error('expected sns + sourceImageUrls');
    }
    expect(result.sourceImageUrls).toHaveLength(10);
  });
});
