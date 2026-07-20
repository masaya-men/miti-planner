import { describe, it, expect } from 'vitest';
import { buildDraftImageFields, EMPTY_SNS_CAPTURE, type SnsCapture } from '../RegisterPage';
import type { CompressedImage } from '../../../../lib/housing/imageCompression';

const FAKE_IMAGE = {} as CompressedImage;

describe('buildDraftImageFields', () => {
  it('localImages も SNS 情報も無ければ {} を返す', () => {
    expect(buildDraftImageFields(EMPTY_SNS_CAPTURE, [], [])).toEqual({});
  });

  it('localImages がある + SNS 情報が無ければ {} を返す (画像は upload-thumbnail 経路)', () => {
    expect(buildDraftImageFields(EMPTY_SNS_CAPTURE, [FAKE_IMAGE], [])).toEqual({});
  });

  it('localImages がある + YouTube URL を捕捉済みなら postUrl だけ返す (2026-07-20 バグ修正)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      youtube: { postUrl: 'https://youtu.be/abcdefghijk', ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg', videoId: 'abcdefghijk' } as any,
    };
    expect(buildDraftImageFields(sns, [FAKE_IMAGE], [])).toEqual({
      postUrl: 'https://youtu.be/abcdefghijk',
    });
  });

  it('localImages がある + Twitter URL を捕捉済みなら postUrl だけ返す (2026-07-20 バグ修正)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      tweetSource: { postUrl: 'https://x.com/foo/status/123', tweetId: '123' },
    };
    expect(buildDraftImageFields(sns, [FAKE_IMAGE], [])).toEqual({
      postUrl: 'https://x.com/foo/status/123',
    });
  });

  it('localImages がある + OGP URL を捕捉済みなら postUrl だけ返す (2026-07-20 バグ修正)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      ogp: { postUrl: 'https://housingsnap.com/12345', data: {} } as any,
    };
    expect(buildDraftImageFields(sns, [FAKE_IMAGE], [])).toEqual({
      postUrl: 'https://housingsnap.com/12345',
    });
  });

  it('localImages が無ければ従来通り YouTube の全フィールドを返す (回帰確認)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      youtube: { postUrl: 'https://youtu.be/abcdefghijk', ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg', videoId: 'abcdefghijk' } as any,
    };
    expect(buildDraftImageFields(sns, [], [])).toEqual({
      imageMode: 'sns',
      postUrl: 'https://youtu.be/abcdefghijk',
      ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
      youtubeVideoId: 'abcdefghijk',
    });
  });

  it('localImages が無ければ従来通り Twitter (静止画のみ) の全フィールドを返す (回帰確認)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      tweetSource: { postUrl: 'https://x.com/foo/status/123', tweetId: '123' },
      tweetData: {
        text: 'hello',
        author: { name: 'Foo', screen_name: 'foo' },
        photos: ['https://pbs.twimg.com/media/1.jpg', 'https://pbs.twimg.com/media/2.jpg'],
        video: null,
      } as any,
    };
    expect(buildDraftImageFields(sns, [], [])).toEqual({
      imageMode: 'sns',
      postUrl: 'https://x.com/foo/status/123',
      ogImageUrl: 'https://pbs.twimg.com/media/1.jpg',
      tweetId: '123',
      sourceImageUrls: ['https://pbs.twimg.com/media/1.jpg', 'https://pbs.twimg.com/media/2.jpg'],
    });
  });

  it('localImages が無ければ従来通り Twitter (動画のみ) の全フィールドを返す (回帰確認)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      tweetSource: { postUrl: 'https://x.com/foo/status/456', tweetId: '456' },
      tweetData: {
        text: 'hello',
        author: { name: 'Foo', screen_name: 'foo' },
        photos: [],
        video: { url: 'https://video.twimg.com/foo.mp4', posterUrl: 'https://pbs.twimg.com/poster.jpg', aspectRatio: null },
      } as any,
    };
    expect(buildDraftImageFields(sns, [], [])).toEqual({
      imageMode: 'sns',
      postUrl: 'https://x.com/foo/status/456',
      ogImageUrl: 'https://pbs.twimg.com/poster.jpg',
      tweetId: '456',
      videoUrl: 'https://video.twimg.com/foo.mp4',
      videoPosterUrl: 'https://pbs.twimg.com/poster.jpg',
    });
  });

  it('localImages が無ければテキストのみツイートは {} を返す (回帰確認)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      tweetSource: { postUrl: 'https://x.com/foo/status/789', tweetId: '789' },
      tweetData: {
        text: 'hello world, no media',
        author: { name: 'Foo', screen_name: 'foo' },
        photos: [],
        video: null,
      } as any,
    };
    expect(buildDraftImageFields(sns, [], [])).toEqual({});
  });

  it('localImages が無ければ従来通り OGP の全フィールドを返す (回帰確認)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      ogp: { postUrl: 'https://housingsnap.com/12345', data: {} } as any,
    };
    const sourceImageUrls = ['https://example.com/a.jpg', 'https://example.com/b.jpg'];
    expect(buildDraftImageFields(sns, [], sourceImageUrls)).toEqual({
      imageMode: 'sns',
      postUrl: 'https://housingsnap.com/12345',
      ogImageUrl: 'https://example.com/a.jpg',
      sourceImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });
  });
});
