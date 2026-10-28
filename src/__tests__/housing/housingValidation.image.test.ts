import { describe, it, expect } from 'vitest';
import { validateImage } from '../../utils/housingImageValidation';

describe('validateImage', () => {
  const base = { imageMode: 'sns' as const, postUrl: 'https://x.com/u/status/123', ogImageUrl: 'https://pbs.twimg.com/media/abc.jpg', tweetId: '123' };

  it('imageMode が sns 以外 + postUrl 無しなら ok', () => {
    expect(validateImage({ imageMode: 'none' } as any).ok).toBe(true);
    expect(validateImage({} as any).ok).toBe(true);
  });

  // 2026-07-20: 直接画像アップロード時 (imageMode!=='sns') でも postUrl を保持できるようになった
  // ため、その場合は host を検証する (実ユーザー報告: postUrl ごと消えるバグの修正に伴う)。
  describe('imageMode!==\'sns\' でも postUrl があるケース (2026-07-20)', () => {
    it('X の投稿URLなら ok', () => {
      expect(validateImage({ imageMode: 'none', postUrl: 'https://x.com/foo/status/123' } as any).ok).toBe(true);
      expect(validateImage({ postUrl: 'https://twitter.com/foo/status/123' } as any).ok).toBe(true);
    });

    it('YouTube の URL なら ok', () => {
      expect(validateImage({ imageMode: 'none', postUrl: 'https://youtu.be/dQw4w9WgXcQ' } as any).ok).toBe(true);
      expect(validateImage({ postUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } as any).ok).toBe(true);
    });

    it('OGP allowlist の URL なら ok', () => {
      expect(validateImage({ imageMode: 'none', postUrl: 'https://housingsnap.com/12345' } as any).ok).toBe(true);
    });

    it('どれにも該当しない URL は invalid', () => {
      const result = validateImage({ imageMode: 'none', postUrl: 'https://evil.example.com/x' } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.postUrl).toBeDefined();
    });

    it('https でない postUrl は invalid', () => {
      const result = validateImage({ imageMode: 'none', postUrl: 'http://x.com/foo/status/123' } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.postUrl).toBeDefined();
    });
  });

  it('正常な sns 入力は ok', () => {
    expect(validateImage(base as any).ok).toBe(true);
  });

  it('postUrl が https でないと invalid', () => {
    expect(validateImage({ ...base, postUrl: 'http://x.com/u/status/123' } as any).ok).toBe(false);
  });

  it('ogImageUrl が pbs.twimg.com 以外のホストだと invalid', () => {
    expect(validateImage({ ...base, ogImageUrl: 'https://evil.example.com/a.jpg' } as any).ok).toBe(false);
  });

  it('tweetId が数字でないと invalid', () => {
    expect(validateImage({ ...base, tweetId: 'abc' } as any).ok).toBe(false);
  });

  it('sns なのにフィールド欠落は invalid', () => {
    expect(validateImage({ imageMode: 'sns' } as any).ok).toBe(false);
  });

  // 2026-05-27: OGP 経路 (sourceImageUrls) の検証
  describe('OGP 経路 (sourceImageUrls)', () => {
    const ogpBase = {
      imageMode: 'sns' as const,
      postUrl: 'https://housingsnap.com/12345',
      ogImageUrl: 'https://cdn.example.com/a.jpg',
      sourceImageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    };

    it('正常な OGP 入力は ok', () => {
      expect(validateImage(ogpBase as any).ok).toBe(true);
    });

    it('postUrl が OGP allowlist 外だと invalid', () => {
      expect(
        validateImage({ ...ogpBase, postUrl: 'https://evil.example.com/x' } as any).ok,
      ).toBe(false);
    });

    it('sourceImageUrls の URL が https でないと invalid', () => {
      expect(
        validateImage({
          ...ogpBase,
          ogImageUrl: 'http://cdn.example.com/a.jpg',
          sourceImageUrls: ['http://cdn.example.com/a.jpg'],
        } as any).ok,
      ).toBe(false);
    });

    it('sourceImageUrls が private IP だと invalid (SSRF guard)', () => {
      expect(
        validateImage({
          ...ogpBase,
          ogImageUrl: 'https://10.0.0.5/a.jpg',
          sourceImageUrls: ['https://10.0.0.5/a.jpg'],
        } as any).ok,
      ).toBe(false);
    });

    it('sourceImageUrls 10 件 (上限) は ok (2026-05-27 4→10 拡大)', () => {
      const urls = Array.from({ length: 10 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
      expect(
        validateImage({
          ...ogpBase,
          ogImageUrl: urls[0],
          sourceImageUrls: urls,
        } as any).ok,
      ).toBe(true);
    });

    it('sourceImageUrls 11 件は too_many (2026-05-27 4→10 拡大、 サニティ上限維持)', () => {
      const urls = Array.from({ length: 11 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
      const result = validateImage({
        ...ogpBase,
        ogImageUrl: urls[0],
        sourceImageUrls: urls,
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.sourceImageUrls).toBe('too_many');
    });

    it('sourceImageUrls に重複があると invalid', () => {
      expect(
        validateImage({
          ...ogpBase,
          sourceImageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/a.jpg'],
        } as any).ok,
      ).toBe(false);
    });

    it('ogImageUrl が sourceImageUrls[0] と一致しないと invalid', () => {
      expect(
        validateImage({
          ...ogpBase,
          ogImageUrl: 'https://cdn.example.com/other.jpg',
        } as any).ok,
      ).toBe(false);
    });

    it('youtubeVideoId と OGP経路の sourceImageUrls (pbs.twimg.com以外) の同居は invalid (host不一致で拒否・conflict自体は撤廃済み)', () => {
      expect(
        validateImage({ ...ogpBase, youtubeVideoId: 'abcdefghijk' } as any).ok,
      ).toBe(false);
    });
  });

  // 2026-08-20: youtubeVideoId + sourceImageUrls 排他緩和 (YouTube動画 + Xの静止画)
  describe('YouTube動画 + Xの静止画 (youtubeVideoId + sourceImageUrls 同居)', () => {
    const youtubeBase = {
      imageMode: 'sns' as const,
      postUrl: 'https://youtu.be/abcdefghijk',
      ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
      youtubeVideoId: 'abcdefghijk',
      tags: [],
    };

    it('youtubeVideoId 単独 (画像なし) は従来通り ok', () => {
      expect(validateImage(youtubeBase as any).ok).toBe(true);
    });

    it('youtubeVideoId と pbs.twimg.com の sourceImageUrls 4枚の同居は ok', () => {
      const result = validateImage({
        ...youtubeBase,
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/B.jpg',
          'https://pbs.twimg.com/media/C.jpg',
          'https://pbs.twimg.com/media/D.jpg',
        ],
      } as any);
      expect(result.ok).toBe(true);
    });

    it('ogImageUrlはYouTubeサムネのままでよい (sourceImageUrls[0]と一致必須のTwitter branchとは異なる)', () => {
      const result = validateImage({
        ...youtubeBase,
        ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
        sourceImageUrls: ['https://pbs.twimg.com/media/A.jpg'],
      } as any);
      expect(result.ok).toBe(true);
    });

    it('sourceImageUrlsにpbs.twimg.com以外のホストが混ざるとinvalid', () => {
      const result = validateImage({
        ...youtubeBase,
        sourceImageUrls: ['https://pbs.twimg.com/media/A.jpg', 'https://cdn.example.com/b.jpg'],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.sourceImageUrls).toBe('invalid_url');
    });

    it('sourceImageUrlsが11件はtoo_many', () => {
      const urls = Array.from({ length: 11 }, (_, i) => `https://pbs.twimg.com/media/${i}.jpg`);
      const result = validateImage({ ...youtubeBase, sourceImageUrls: urls } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.sourceImageUrls).toBe('too_many');
    });

    it('youtubeVideoId と tweetId の同居は引き続き conflict (動画が2本になるため)', () => {
      const result = validateImage({ ...youtubeBase, tweetId: '123' } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.imageMode).toBe('conflict_sources');
    });
  });

  // 2026-05-27: tweetId + sourceImageUrls 排他緩和 (Twitter 静止画ツイート 1-4 枚)
  describe('Twitter 静止画ツイート (tweetId + sourceImageUrls 同居)', () => {
    it('tweetId と pbs.twimg.com の sourceImageUrls 4 枚は ok', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/B.jpg',
          'https://pbs.twimg.com/media/C.jpg',
          'https://pbs.twimg.com/media/D.jpg',
        ],
        tags: [],
      } as any);
      expect(result.ok).toBe(true);
    });

    it('tweetId + sourceImageUrls で pbs.twimg.com 以外のホストは reject', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: ['https://evil.example.com/A.jpg'],
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.sourceImageUrls).toBeDefined();
    });

    it('tweetId + sourceImageUrls で ogImageUrl が sourceImageUrls[0] と一致しないと invalid', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/X.jpg',
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/B.jpg',
        ],
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
    });

    it('tweetId + sourceImageUrls で重複は invalid', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/A.jpg',
        ],
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.sourceImageUrls).toBe('duplicate');
    });
  });

  // 2026-05-27: Twitter 動画ツイート (tweetId + videoUrl/Poster/AspectRatio)
  describe('Twitter 動画ツイート (videoUrl)', () => {
    it('videoUrl + videoPosterUrl + videoAspectRatio が正常なら ok', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/1280x720/xxx.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoAspectRatio: 1.78,
        tags: [],
      } as any);
      expect(result.ok).toBe(true);
    });

    it('videoUrl の host が video.twimg.com 以外なら reject', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://evil.example.com/video.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.videoUrl).toBe('invalid_host');
    });

    it('videoPosterUrl の host が pbs.twimg.com 以外なら reject', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/x.mp4',
        videoPosterUrl: 'https://evil.example.com/poster.jpg',
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.videoPosterUrl).toBe('invalid_host');
    });

    it('videoAspectRatio が負数なら reject', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/x.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoAspectRatio: -1,
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.videoAspectRatio).toBe('invalid');
    });

    it('videoUrl と sourceImageUrls の同居は OK (Twitter は実は photos + video が同居する mediaDetails 構造)', () => {
      // 2026-05-27 hotfix: 当初「Twitter 仕様上 photos と video は排他」 と仮定したが、
      // 実際の syndication JSON では mediaDetails:[video, photo, photo] のように同居する。
      // 同居許可で 「画像 + 動画ツイート」 (= ② パターン) が正しく保存されるようになる。
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/x.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: ['https://pbs.twimg.com/media/A.jpg'],
        tags: [],
      } as any);
      expect(result.ok).toBe(true);
    });
  });
});
